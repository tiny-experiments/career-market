import { concurrentMap } from '../concurrent.ts';
import { addDays, FIRST_OBSERVED_DAY, type IsoDay } from '@cm/core/dates';
import type { Logger } from '@cm/core/logger';
import { DEFAULT_AGE_EDGES } from '../compute/backcast.ts';
import type { KrillApi } from '../krill/api.ts';
import { KrillHttpError } from '../krill/client.ts';
import type { KrillCompanyDailyItem, KrillJobItem } from '../krill/schemas.ts';

/** Everything the Profession page reads from krill for one snapshot day. */
export interface ProfessionInputs {
  /** Open jobs per family at each age cut; '1970-01-01' under 'posted' counts every dated job. */
  cuts: { family: string; kind: 'opened' | 'posted'; cutDate: IsoDay; count: number }[];
  workModes: Map<string, { remote: number; hybrid: number; onsite: number; total: number }>;
  /** Companies with an open role, per family. */
  companyCount: Map<string, number>;
  topCompanies: Map<string, { companyId: string; open: number }[]>;
  companyInfo: Map<string, { name: string; domain: string | null }>;
  /** Family-grouped daily rows of every top company since the first observed day. */
  companyHistory: Map<string, KrillCompanyDailyItem[]>;
  /** US senior roles with listed pay (newest first), per family. */
  salaryJobs: Map<string, KrillJobItem[]>;
  latestRoles: Map<string, KrillJobItem[]>;
  failed: string[];
}

export const POSTED_EVER = '1970-01-01';
export const TOP_COMPANIES_PER_FAMILY = 6;
export const LATEST_ROLES_PER_FAMILY = 8;
/** Pages of 100 US senior roles with pay that feed a family's salary band. */
const SALARY_PAGES = 3;

export async function pullProfessions(
  api: KrillApi,
  T: IsoDay,
  families: readonly string[],
  atsList: readonly string[],
  log: Logger,
): Promise<ProfessionInputs> {
  const out: ProfessionInputs = {
    cuts: [],
    workModes: new Map(),
    companyCount: new Map(),
    topCompanies: new Map(),
    companyInfo: new Map(),
    companyHistory: new Map(),
    salaryJobs: new Map(),
    latestRoles: new Map(),
    failed: [],
  };

  // Work mode per family (the main pull already fetched these facets: no new krill call).
  for (const family of families) {
    try {
      const f = await api.facets({ family, limit: 300 });
      const mode = (v: string) => f.facets.workMode.find((x) => x.value === v)?.count ?? 0;
      out.workModes.set(family, { remote: mode('remote'), hybrid: mode('hybrid'), onsite: mode('onsite'), total: f.total });
    } catch (err) {
      if (!(err instanceof KrillHttpError) || err.status !== 500) throw err;
      out.failed.push(`workMode:${family}`);
    }
  }

  // Open jobs per family by age: one facet call per cut answers for every family.
  log.info('pulling per-family age cuts');
  const cutSpecs: { kind: 'opened' | 'posted'; cutDate: IsoDay; param: string }[] = [];
  for (const kind of ['opened', 'posted'] as const) {
    for (const age of DEFAULT_AGE_EDGES) {
      cutSpecs.push({ kind, cutDate: addDays(T, -age), param: kind === 'opened' ? 'openedSince' : 'postedSince' });
    }
  }
  cutSpecs.push({ kind: 'posted', cutDate: POSTED_EVER, param: 'postedSince' });
  for (const spec of cutSpecs) {
    const counts = await familyTotals(api, { [spec.param]: spec.cutDate }, families, atsList, log);
    if (!counts) {
      out.failed.push(`cut:${spec.kind}:${spec.cutDate}`);
      continue;
    }
    for (const [family, count] of counts) out.cuts.push({ family, kind: spec.kind, cutDate: spec.cutDate, count });
  }

  // Companies: today's open roles per company and family, then the history of the top ones.
  log.info('pulling company statistics');
  const today = await api.companyDaily({ from: T, to: T, groupBy: 'family' });
  const byFamily = new Map<string, { companyId: string; open: number }[]>();
  for (const row of today) {
    if (!row.family || row.open <= 0) continue;
    const list = byFamily.get(row.family);
    if (list) list.push({ companyId: row.companyId, open: row.open });
    else byFamily.set(row.family, [{ companyId: row.companyId, open: row.open }]);
  }
  const wanted = new Set<string>();
  for (const [family, list] of byFamily) {
    out.companyCount.set(family, list.length);
    const top = list.sort((a, b) => b.open - a.open || (a.companyId < b.companyId ? -1 : 1)).slice(0, TOP_COMPANIES_PER_FAMILY);
    out.topCompanies.set(family, top);
    for (const c of top) wanted.add(c.companyId);
  }
  log.info({ companies: wanted.size }, 'pulling top company details and history');
  await concurrentMap([...wanted], async (id) => {
    const detail = await api.company(id);
    out.companyInfo.set(id, { name: detail?.name ?? id, domain: detail?.domain ?? null });
    out.companyHistory.set(id, await api.companyDaily({ from: FIRST_OBSERVED_DAY, to: T, groupBy: 'family', company: id }));
  });

  // Pay and newest roles per family (live job lists; krill dates are days).
  log.info('pulling pay samples and latest roles');
  for (const family of families) {
    try {
      out.salaryJobs.set(
        family,
        await api.jobs({ family, country: 'US', level: 'senior', salaryMin: 1, currency: 'USD', sort: 'newest' }, SALARY_PAGES),
      );
      const latest = await api.jobs({ family, sort: 'posted' }, 1, LATEST_ROLES_PER_FAMILY);
      out.latestRoles.set(family, latest);
      // The page shows the first five: look up their logo domain.
      for (const job of latest.slice(0, 5)) {
        if (out.companyInfo.has(job.company.id)) continue;
        const detail = await api.company(job.company.id);
        out.companyInfo.set(job.company.id, { name: detail?.name ?? job.company.name, domain: detail?.domain ?? null });
      }
    } catch (err) {
      if (!(err instanceof KrillHttpError) || err.status !== 500) throw err;
      out.failed.push(`jobs:${family}`);
    }
  }
  return out;
}

/**
 * Open jobs per family for one filter. One unfiltered facet call lists every
 * family; krill answers 500 for some heavy filter and date pairs (seen since
 * 2026-11-05), so a failing call falls back to one count per family.
 */
async function familyTotals(
  api: KrillApi,
  params: Record<string, string>,
  families: readonly string[],
  atsList: readonly string[],
  log: Logger,
): Promise<Map<string, number> | null> {
  try {
    const f = await api.facets({ ...params, limit: 100 });
    return new Map(families.map((fam) => [fam, f.facets.family.find((x) => x.value === fam)?.count ?? 0]));
  } catch (err) {
    if (!(err instanceof KrillHttpError) || err.status !== 500) throw err;
  }
  log.warn({ params }, 'krill facets failed for this cut; counting family by family');
  const out = new Map<string, number>();
  for (const family of families) {
    const res = await api.facetTotal(params, [family], atsList);
    if (res === null) return null;
    out.set(family, res.total);
  }
  return out;
}
