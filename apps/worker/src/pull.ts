import { concurrentMap } from './concurrent.ts';
import { addDays, dayRange, FIRST_OBSERVED_DAY, isBootstrapDay, type IsoDay } from '@cm/core/dates';
import type { Logger } from '@cm/core/logger';
import type { KrillApi } from './krill/api.ts';
import { KrillHttpError } from './krill/client.ts';
import type { KrillDailyItem, KrillMeta, KrillPanelItem } from './krill/schemas.ts';
import { DEFAULT_AGE_EDGES } from './compute/backcast.ts';

/** Everything the builder reads from krill for one snapshot day. */
export interface Pulled {
  meta: KrillMeta & { lastSnapshotDate: IsoDay };
  families: string[];
  market: KrillDailyItem[];
  panel: KrillPanelItem[];
  /** krill daily_stat at family x specialty x level x country, per refreshed day. */
  grouped: Map<IsoDay, KrillDailyItem[]>;
  /** Open jobs per family and skill on the snapshot day (facets). */
  familySkills: Map<string, { total: number; skills: { value: string; count: number }[] }>;
  failedFamilies: string[];
  companies: { id: string; name: string; openJobs: number }[];
  cuts: { kind: 'opened' | 'posted'; cutDate: IsoDay; count: number }[];
  /** Open jobs with a posted date (null when krill could not answer). */
  postedTotal: number | null;
  closingSamples: ClosingSampleRow[];
}

export interface ClosingSampleRow {
  jobId: string;
  detectedOn: IsoDay;
  closedOn: IsoDay;
  openedOn: IsoDay;
  openedSource: string;
  family: string | null;
}

export interface PullPlan {
  /** Days whose grouped daily_stat rows are (re)fetched. */
  groupedDays: IsoDay[];
  /** Days that still need a closing sample. */
  closingDays: IsoDay[];
  closingSamplePerDay: number;
  topCompanies: number;
  skillsPerFamily: number;
}

const POSTED_EVER = '1970-01-01';

export async function pull(api: KrillApi, meta: Pulled['meta'], plan: PullPlan, log: Logger, snapshotApi?: Promise<KrillApi>): Promise<Pulled> {
  const T = meta.lastSnapshotDate;
  const taxonomy = await api.taxonomy();
  const families = taxonomy.families.map((f) => f.id);

  log.info('pulling daily stats and panel');
  const market = await api.dailyStats(FIRST_OBSERVED_DAY, T);
  const panel = await api.panelDaily(addDays(FIRST_OBSERVED_DAY, -1), T);

  const grouped = new Map<IsoDay, KrillDailyItem[]>();
  await concurrentMap(plan.groupedDays, async (day) => {
    log.info({ day }, 'pulling grouped daily stats');
    grouped.set(day, await api.dailyStats(day, day, ['family', 'specialty', 'level', 'country']));
  });

  if (snapshotApi) api = await snapshotApi;
  log.info({ families: families.length }, 'pulling facets per family');
  const familySkills: Pulled['familySkills'] = new Map();
  const failedFamilies: string[] = [];
  await concurrentMap(families, async (family) => {
    try {
      const f = await api.facets({ family, limit: plan.skillsPerFamily }, ['skill']);
      familySkills.set(family, { total: f.total, skills: f.facets.skill });
    } catch (err) {
      if (!(err instanceof KrillHttpError) || err.status !== 500) throw err;
      log.warn({ family }, 'krill facets failed for family; skills for it are skipped today');
      failedFamilies.push(family);
    }
  });

  const companies = (await api.companies({ sort: 'openJobs', pageSize: plan.topCompanies })).items;

  log.info('pulling open-age cuts');
  const cuts: Pulled['cuts'] = [];
  let groups: string[][] = [families];
  const atsList = meta.ats.filter((a) => a.openJobs > 0).map((a) => a.ats);
  for (const kind of ['opened', 'posted'] as const) {
    for (const age of DEFAULT_AGE_EDGES) {
      const cutDate = addDays(T, -age);
      const res = await api.facetTotalOver({ [kind === 'opened' ? 'openedSince' : 'postedSince']: cutDate }, groups, atsList);
      if (res === null) {
        log.warn({ kind, cutDate }, 'krill could not count this cut; it is skipped');
        continue;
      }
      groups = res.groups;
      cuts.push({ kind, cutDate, count: res.total });
    }
  }
  const posted = await api.facetTotalOver({ postedSince: POSTED_EVER }, groups, atsList);

  const closingSamples: ClosingSampleRow[] = [];
  for (const day of plan.closingDays) {
    if (plan.closingSamplePerDay === 0 || isBootstrapDay(day)) continue;
    log.info({ day }, 'sampling closings');
    const closed = await api.closedOn(day);
    for (const item of systematicSample(closed, plan.closingSamplePerDay)) {
      const t = await api.tombstone(item.jobId);
      if (!t) continue;
      closingSamples.push({
        jobId: t.id,
        detectedOn: day,
        closedOn: t.closedAt,
        openedOn: t.openedAt,
        openedSource: t.openedSource,
        family: t.family,
      });
    }
  }

  return {
    meta,
    families,
    market,
    panel,
    grouped,
    familySkills,
    failedFamilies,
    companies,
    cuts,
    postedTotal: posted?.total ?? null,
    closingSamples,
  };
}

/** Every k-th item, spread over the whole list. */
export function systematicSample<T>(items: readonly T[], n: number): T[] {
  if (items.length <= n) return [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.floor(((i + 0.5) * items.length) / n)] as T);
  return out;
}

/** Days from the first observed day to T. */
export function observedDays(T: IsoDay): IsoDay[] {
  return dayRange(FIRST_OBSERVED_DAY, T);
}
