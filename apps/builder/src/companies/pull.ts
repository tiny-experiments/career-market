import { addDays, FIRST_OBSERVED_DAY, type IsoDay } from '@cm/core/dates';
import type { Logger } from '@cm/core/logger';
import { KrillHttpError } from '../krill/client.ts';
import {
  COMPANY_FILTER_MAX,
  type KrillCompanyApi,
  type KrillCompanyDetail,
  type KrillCompanyFacets,
  type KrillCompanyListing,
  type KrillCompanyStatRow,
} from '../krill/companyApi.ts';

/** Companies need this many open tech roles to get a page. */
export const MIN_DIRECTORY_OPEN = 10;
/** Cut ages (days) for a company's median days open. */
export const COMPANY_AGE_EDGES = [7, 14, 30, 60, 120, 240] as const;

export interface CompanyPlan {
  /** Days whose daily statistics are (re)fetched. */
  days: IsoDay[];
  /** How many of the largest companies get a profile. */
  profiles: number;
}

export interface ProfilePull {
  detail: KrillCompanyDetail | null;
  facets: KrillCompanyFacets;
  /** Open roles opened within `age` days, per cut age; a cut krill could not count is missing. */
  cuts: { age: number; countLE: number }[];
}

export interface CompanyPull {
  asOf: IsoDay;
  days: IsoDay[];
  directory: KrillCompanyListing[];
  /** Daily statistics per company, one row per company-day, refreshed days only. */
  stats: KrillCompanyStatRow[];
  /** The same by family and level, profiled companies only. */
  slices: KrillCompanyStatRow[];
  profiles: Map<string, ProfilePull>;
}

/** Days to fetch: the recent window plus any day not yet stored (or all of them with `full`). */
export function planCompanyDays(
  observed: readonly IsoDay[],
  have: ReadonlySet<IsoDay>,
  asOf: IsoDay,
  refreshDays: number,
  full: boolean,
): IsoDay[] {
  const recentFrom = addDays(asOf, -(refreshDays - 1));
  return observed.filter((d) => d >= FIRST_OBSERVED_DAY && (full || d >= recentFrom || !have.has(d)));
}

export async function pullCompanies(
  api: KrillCompanyApi,
  asOf: IsoDay,
  plan: CompanyPlan,
  log: Logger,
): Promise<CompanyPull> {
  log.info('pulling the company directory');
  const directory = await api.directory(MIN_DIRECTORY_OPEN);
  const profiled = directory.slice(0, plan.profiles);

  let stats: KrillCompanyStatRow[] = [];
  let slices: KrillCompanyStatRow[] = [];
  if (plan.days.length > 0) {
    const from = plan.days[0] as IsoDay;
    log.info({ from, to: asOf }, 'pulling daily company statistics');
    const wanted = new Set(plan.days);
    stats = (await api.stats(from, asOf)).filter((r) => wanted.has(r.date));
    for (let i = 0; i < profiled.length; i += COMPANY_FILTER_MAX) {
      const ids = profiled.slice(i, i + COMPANY_FILTER_MAX).map((c) => c.id);
      log.info({ companies: ids.length, from }, 'pulling company statistics by family and level');
      slices.push(...(await api.stats(from, asOf, { companies: ids, groupBy: ['family', 'level'] })).filter((r) => wanted.has(r.date)));
    }
  }

  const profiles = new Map<string, ProfilePull>();
  for (const [i, c] of profiled.entries()) {
    try {
      profiles.set(c.id, await pullProfile(api, c, asOf));
    } catch (err) {
      if (!(err instanceof KrillHttpError) || err.status !== 500) throw err;
      log.warn({ company: c.name }, 'krill failed for this company profile; it is skipped today');
    }
    if ((i + 1) % 25 === 0) log.info({ done: i + 1, of: profiled.length }, 'company profiles pulled');
  }
  return { asOf, days: plan.days, directory, stats, slices, profiles };
}

async function pullProfile(api: KrillCompanyApi, c: KrillCompanyListing, asOf: IsoDay): Promise<ProfilePull> {
  const facets = await api.facets(c.id);
  let detail: KrillCompanyDetail | null = null;
  try {
    detail = await api.detail(c.id);
  } catch (err) {
    if (!(err instanceof KrillHttpError) || err.status !== 404) throw err;
  }
  const cuts: ProfilePull['cuts'] = [];
  for (const age of COMPANY_AGE_EDGES) {
    const total = await api.total(c.id, { openedSince: addDays(asOf, -age) });
    if (total !== null) cuts.push({ age, countLE: total });
  }
  return { detail, facets, cuts };
}
