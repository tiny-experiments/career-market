import { addDays, type IsoDay } from '@cm/core/dates';
import { z } from 'zod';
import type { KrillClient, Params } from '../krill/client.ts';
import { KrillHttpError } from '../krill/client.ts';

/**
 * krill endpoints the Screener reads beyond the foundation's: the company
 * facet of /v1/facets, company daily statistics (/v1/stats/companies/daily)
 * and the registrable domain on /v1/companies. Every response is parsed with
 * zod; unknown fields are ignored, a missing or mistyped one fails the build.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();
const facetList = z.array(z.object({ value: z.string(), count }));

export const wideFacetsSchema = z.object({
  total: count,
  facets: z.object({
    family: facetList,
    level: facetList,
    skill: facetList,
    country: facetList,
    workMode: facetList,
    company: facetList,
  }),
});
export type WideFacets = z.infer<typeof wideFacetsSchema>;

export const companiesWithDomainSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      domain: z.string().nullable().optional(),
      openJobs: count,
      ats: z.array(z.string()),
    }),
  ),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type KrillCompany = z.infer<typeof companiesWithDomainSchema>['items'][number];

export const companyDailySchema = z.object({
  from: day,
  to: day,
  items: z.array(
    z.object({
      date: day,
      companyId: z.string(),
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
export type CompanyDayItem = z.infer<typeof companyDailySchema>['items'][number];

/** krill's company filter takes at most 100 ids per request. */
export const MAX_COMPANY_IDS = 100;
/** Company-days per page of company daily statistics (krill maximum). */
const COMPANY_DAY_PAGE = 1000;
/** krill's page size ceiling for /v1/companies. */
const COMPANY_PAGE = 100;

export class ScreenerKrill {
  constructor(private readonly client: KrillClient) {}

  /** The largest companies by open roles, `limit` of them. */
  async topCompanies(limit: number): Promise<KrillCompany[]> {
    const out: KrillCompany[] = [];
    let cursor: string | undefined;
    while (out.length < limit) {
      const page = (
        await this.client.get(
          '/v1/companies',
          { sort: 'openJobs', pageSize: Math.min(COMPANY_PAGE, limit - out.length), cursor },
          companiesWithDomainSchema,
        )
      ).data;
      out.push(...page.items);
      if (!page.nextCursor || page.items.length === 0) break;
      cursor = page.nextCursor;
    }
    return out.slice(0, limit);
  }

  /** Company totals per day (no family or level slice) for the given companies, up to 30 days ending on `to`. */
  async companyDays(companyIds: readonly string[], to: IsoDay, days: number): Promise<CompanyDayItem[]> {
    const from = addDays(to, -(days - 1));
    const out: CompanyDayItem[] = [];
    for (let i = 0; i < companyIds.length; i += MAX_COMPANY_IDS) {
      const chunk = companyIds.slice(i, i + MAX_COMPANY_IDS);
      let cursor: string | undefined;
      for (;;) {
        const page = (
          await this.client.get(
            '/v1/stats/companies/daily',
            { from, to, company: chunk.join(','), pageSize: COMPANY_DAY_PAGE, cursor },
            companyDailySchema,
          )
        ).data;
        out.push(...page.items);
        if (!page.nextCursor || page.items.length === 0) break;
        cursor = page.nextCursor;
      }
    }
    return out;
  }

  /** /v1/facets under any filter; null when krill answers 500 for it. */
  async facets(params: Params): Promise<WideFacets | null> {
    try {
      return (await this.client.get('/v1/facets', params, wideFacetsSchema)).data;
    } catch (err) {
      if (err instanceof KrillHttpError && err.status === 500) return null;
      throw err;
    }
  }
}
