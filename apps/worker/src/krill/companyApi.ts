import { addDays, type IsoDay } from '@cm/core/dates';
import { z } from 'zod';
import { KrillHttpError, type KrillClient, type Params } from './client.ts';

/**
 * krill endpoints for company data: the company directory, a company's boards,
 * daily company statistics (K2) and a company-filtered facet count. Kept apart
 * from KrillApi so the Company page work does not touch the shared client.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();
const companyId = z.string().regex(/^co_[0-9a-z]{16}$/);

export const companyDirectorySchema = z.object({
  items: z.array(
    z.object({
      id: companyId,
      name: z.string(),
      domain: z.string().nullable(),
      openJobs: count,
      ats: z.array(z.string()),
    }),
  ),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type KrillCompanyListing = z.infer<typeof companyDirectorySchema>['items'][number];

export const companyDetailSchema = z.object({
  id: companyId,
  name: z.string(),
  domain: z.string().nullable(),
  openJobs: count,
  ats: z.array(z.string()),
  boards: z.array(
    z.object({
      ats: z.string(),
      slug: z.string(),
      url: z.string(),
      status: z.string(),
      lastOkOn: day.nullable(),
      openJobs: count,
    }),
  ),
});
export type KrillCompanyDetail = z.infer<typeof companyDetailSchema>;

export const companyStatsSchema = z.object({
  from: day,
  to: day,
  groupBy: z.array(z.string()),
  items: z.array(
    z.object({
      date: day,
      companyId,
      family: z.string().optional(),
      level: z.string().nullable().optional(),
      open: count,
      new: count,
      closed: count,
    }),
  ),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type KrillCompanyStatRow = z.infer<typeof companyStatsSchema>['items'][number];

const facetList = z.array(z.object({ value: z.string(), count }));
export const companyFacetsSchema = z.object({
  total: count,
  facets: z.object({
    family: facetList,
    level: facetList,
    skill: facetList,
    country: facetList,
    workMode: facetList,
  }),
});
export type KrillCompanyFacets = z.infer<typeof companyFacetsSchema>;

/** Pages krill returns company statistics in (the maximum). */
const STATS_PAGE = 1000;
/** krill takes at most 100 company ids per call. */
export const COMPANY_FILTER_MAX = 100;

export class KrillCompanyApi {
  constructor(private readonly client: KrillClient) {}

  /** Companies by open roles, largest first, until one has fewer than `minOpen` roles. */
  async directory(minOpen: number, maxPages = Number.POSITIVE_INFINITY): Promise<KrillCompanyListing[]> {
    const out: KrillCompanyListing[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const res = (
        await this.client.get('/v1/companies', { sort: 'openJobs', pageSize: 100, cursor }, companyDirectorySchema)
      ).data;
      for (const item of res.items) {
        if (item.openJobs < minOpen) return out;
        out.push(item);
      }
      if (!res.nextCursor || res.items.length === 0) return out;
      cursor = res.nextCursor;
    }
    return out;
  }

  async detail(id: string): Promise<KrillCompanyDetail> {
    return (await this.client.get(`/v1/companies/${encodeURIComponent(id)}`, {}, companyDetailSchema)).data;
  }

  /**
   * /v1/stats/companies/daily from `from` to `to`, in windows of at most 31
   * days, every page. `companies` (at most 100 ids) narrows it; `groupBy`
   * slices each company-day by family and/or level.
   */
  async stats(
    from: IsoDay,
    to: IsoDay,
    options: { companies?: readonly string[]; groupBy?: readonly ('family' | 'level')[] } = {},
  ): Promise<KrillCompanyStatRow[]> {
    const items: KrillCompanyStatRow[] = [];
    for (let start = from; start <= to; start = addDays(start, 31)) {
      const end = addDays(start, 30) < to ? addDays(start, 30) : to;
      let cursor: string | undefined;
      do {
        const params: Params = {
          from: start,
          to: end,
          pageSize: STATS_PAGE,
          company: options.companies?.join(','),
          groupBy: options.groupBy?.join(','),
          cursor,
        };
        const page = (await this.client.get('/v1/stats/companies/daily', params, companyStatsSchema)).data;
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    }
    return items;
  }

  /** Facets of one company's open roles. */
  async facets(id: string, filter: Params = {}, limit = 60): Promise<KrillCompanyFacets> {
    return (await this.client.get('/v1/facets', { company: id, limit, ...filter }, companyFacetsSchema)).data;
  }

  /** Open roles of a company that match a filter; null when krill answers 500 for it (a known krill fault). */
  async total(id: string, filter: Params): Promise<number | null> {
    try {
      return (await this.client.get('/v1/facets', { company: id, limit: 1, ...filter }, companyFacetsSchema)).data.total;
    } catch (err) {
      if (err instanceof KrillHttpError && err.status === 500) return null;
      throw err;
    }
  }
}
