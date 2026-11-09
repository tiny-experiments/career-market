import { addDays, type IsoDay } from '@cm/core/dates';
import { z } from 'zod';
import { KrillClient, KrillHttpError, type Params } from './client.ts';
import {
  changePageSchema,
  companyDailySchema,
  companyDetailSchema,
  companyPageSchema,
  dailyStatsSchema,
  facetsSchema,
  jobListSchema,
  metaSchema,
  openJobStatusSchema,
  panelDailySchema,
  taxonomySchema,
  type KrillChangePage,
  type KrillCompanyDailyItem,
  type KrillCompanyDetail,
  type KrillCompanyPage,
  type KrillDailyItem,
  type KrillFacets,
  type KrillJobItem,
  type KrillMeta,
  type KrillPanelItem,
  type KrillTaxonomy,
  type KrillTombstone,
  tombstoneSchema,
} from './schemas.ts';

/** krill endpoints the builder reads. Endpoints krill does not serve yet (K2, K4-K7) plug in here later. */
export class KrillApi {
  constructor(readonly client: KrillClient) {}

  async meta(): Promise<KrillMeta> {
    return (await this.client.get('/v1/meta', {}, metaSchema, { cache: false })).data;
  }

  async taxonomy(): Promise<KrillTaxonomy> {
    return (await this.client.get('/v1/taxonomy', {}, taxonomySchema)).data;
  }

  /** /v1/stats/daily over any span, fetched in windows of at most 31 days. */
  async dailyStats(from: IsoDay, to: IsoDay, groupBy: string[] = []): Promise<KrillDailyItem[]> {
    const items: KrillDailyItem[] = [];
    for (let start = from; start <= to; start = addDays(start, 31)) {
      const end = minDay(addDays(start, 30), to);
      const params: Params = { from: start, to: end, groupBy: groupBy.join(',') || undefined };
      items.push(...(await this.client.get('/v1/stats/daily', params, dailyStatsSchema)).data.items);
    }
    return items;
  }

  async panelDaily(from: IsoDay, to: IsoDay): Promise<KrillPanelItem[]> {
    const items: KrillPanelItem[] = [];
    for (let start = from; start <= to; start = addDays(start, 31)) {
      const end = minDay(addDays(start, 30), to);
      items.push(...(await this.client.get('/v1/stats/panel/daily', { from: start, to: end }, panelDailySchema)).data.items);
    }
    return items;
  }

  async facets(params: Params, facetDimensions?: string[]): Promise<KrillFacets> {
    return (await this.client.get('/v1/facets', params, facetsSchema, { facetDimensions })).data;
  }

  /**
   * Total open jobs for a filter over the given families. krill answers 500
   * when some facet queries get heavy, so a failing family list is split in
   * halves; a single failing family is split by ATS (every job has one), and a
   * single failing (family, ATS) pair is counted at the nearest date within 3
   * days that answers. Returns the total and the family groups that answered
   * (reuse them for the next filter), or null when nothing answers.
   */
  async facetTotal(
    params: Params,
    families: readonly string[],
    atsList: readonly string[] = [],
  ): Promise<{ total: number; groups: string[][] } | null> {
    const total = await this.tryTotal({ ...params, family: families.join(',') });
    if (total !== null) return { total, groups: [[...families]] };
    if (families.length === 1) {
      const byAts = await this.totalSplit(params, families[0] as string, atsList);
      return byAts === null ? null : { total: byAts, groups: [[...families]] };
    }
    const mid = Math.ceil(families.length / 2);
    const left = await this.facetTotal(params, families.slice(0, mid), atsList);
    if (left === null) return null;
    const right = await this.facetTotal(params, families.slice(mid), atsList);
    if (right === null) return null;
    return { total: left.total + right.total, groups: [...left.groups, ...right.groups] };
  }

  /** A facet total, or null when krill answers 500 for it. */
  private async tryTotal(params: Params): Promise<number | null> {
    try {
      return (await this.client.get('/v1/facets', { ...params, limit: 1 }, facetsSchema, { countOnly: true })).data.total;
    } catch (err) {
      if (err instanceof KrillHttpError && err.status === 500) return null;
      throw err;
    }
  }

  private async totalSplit(params: Params, family: string, atsList: readonly string[]): Promise<number | null> {
    if (atsList.length === 0) return this.totalNearby(params, family, undefined);
    const whole = atsList.length > 1 ? await this.tryTotal({ ...params, family, ats: atsList.join(',') }) : null;
    if (whole !== null) return whole;
    if (atsList.length === 1) return this.totalNearby(params, family, atsList[0]);
    const mid = Math.ceil(atsList.length / 2);
    const left = await this.totalSplit(params, family, atsList.slice(0, mid));
    if (left === null) return null;
    const right = await this.totalSplit(params, family, atsList.slice(mid));
    return right === null ? null : left + right;
  }

  /**
   * krill's facets answer 500 for some (filter, date) pairs (a krill bug seen
   * since 2026-11-05). Count at the nearest date within 3 days that answers;
   * the error is a few days of postings in one small slice.
   */
  private async totalNearby(params: Params, family: string, ats: string | undefined): Promise<number | null> {
    const base = { ...params, family, ats };
    const direct = await this.tryTotal(base);
    if (direct !== null) return direct;
    const key = DATE_FILTERS.find((k) => typeof params[k] === 'string');
    if (!key) return null;
    for (const offset of [1, -1, 2, -2, 3, -3]) {
      const total = await this.tryTotal({ ...base, [key]: addDays(params[key] as string, offset) });
      if (total !== null) return total;
    }
    return null;
  }

  /** facetTotal over a partition of families (groups that answered before are tried first). */
  async facetTotalOver(
    params: Params,
    groups: readonly string[][],
    atsList: readonly string[] = [],
  ): Promise<{ total: number; groups: string[][] } | null> {
    let total = 0;
    const used: string[][] = [];
    for (const group of groups) {
      const part = await this.facetTotal(params, group, atsList);
      if (part === null) return null;
      total += part.total;
      used.push(...part.groups);
    }
    return { total, groups: used };
  }

  async companies(params: { sort: 'openJobs' | 'name'; pageSize: number; cursor?: string }): Promise<KrillCompanyPage> {
    return (await this.client.get('/v1/companies', params, companyPageSchema)).data;
  }

  /**
   * /v1/stats/companies/daily (krill K2) over a span, every page. `groupBy: 'family'`
   * adds the family; `family` and `company` filter. Pages hold up to 1000 rows.
   */
  async companyDaily(params: {
    from: IsoDay;
    to: IsoDay;
    groupBy?: 'family';
    family?: string;
    company?: string;
  }): Promise<KrillCompanyDailyItem[]> {
    const out: KrillCompanyDailyItem[] = [];
    let cursor: string | undefined;
    do {
      const page = (
        await this.client.get(
          '/v1/stats/companies/daily',
          // The cursor does not carry the filters: send them again with every page.
          { ...params, cursor, pageSize: 1000 },
          companyDailySchema,
        )
      ).data;
      out.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  }

  /** One company: name and the registrable domain krill holds for its logo. */
  async company(id: string): Promise<KrillCompanyDetail | null> {
    try {
      return (await this.client.get(`/v1/companies/${encodeURIComponent(id)}`, {}, companyDetailSchema)).data;
    } catch (err) {
      if (err instanceof KrillHttpError && err.status === 404) return null;
      throw err;
    }
  }

  /** Open jobs for a filter, up to `pages` pages (sort: newest | posted | salary). */
  async jobs(params: Params, pages: number, pageSize = 100): Promise<KrillJobItem[]> {
    const out: KrillJobItem[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < pages; page++) {
      const res = (
        await this.client.get('/v1/jobs', { ...params, cursor, pageSize }, jobListSchema)
      ).data;
      out.push(...res.items);
      cursor = res.nextCursor ?? undefined;
      if (!cursor) break;
    }
    return out;
  }

  /** Every 'closed' change event detected on `day`, in feed order. */
  async closedOn(day: IsoDay): Promise<KrillChangePage['items']> {
    const out: KrillChangePage['items'] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = (
        await this.client.get(
          '/v1/changes',
          // krill takes either since (first page) or cursor (later pages), not both.
          cursor ? { kind: 'closed', pageSize: 100, cursor } : { kind: 'closed', since: day, pageSize: 100 },
          changePageSchema,
        )
      ).data;
      let pastDay = false;
      for (const item of page.items) {
        if (item.date > day) {
          pastDay = true;
          break;
        }
        if (item.date === day && item.kind === 'closed') out.push(item);
      }
      if (pastDay || !page.nextCursor || page.items.length === 0) return out;
      cursor = page.nextCursor;
    }
  }

  /** A job's tombstone; null when the job is open again or unknown. */
  async tombstone(jobId: string): Promise<KrillTombstone | null> {
    const schema = z.union([tombstoneSchema, openJobStatusSchema]);
    try {
      const res = await this.client.get(`/v1/jobs/${encodeURIComponent(jobId)}`, {}, schema, { acceptStatuses: [410] });
      return res.data.status === 'closed' ? (res.data as KrillTombstone) : null;
    } catch (err) {
      if (err instanceof KrillHttpError && err.status === 404) return null;
      throw err;
    }
  }
}

const DATE_FILTERS = ['openedSince', 'postedSince'] as const;

function minDay(a: IsoDay, b: IsoDay): IsoDay {
  return a < b ? a : b;
}
