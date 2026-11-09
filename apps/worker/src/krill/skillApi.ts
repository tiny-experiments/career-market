import { z } from 'zod';
import type { KrillApi } from './api.ts';
import { KrillHttpError, type Params } from './client.ts';

/**
 * krill reads the Skill page needs beyond the Market overview: facets with the
 * company facet, one company, and job listings. Every response is parsed with
 * zod; extra fields are ignored, a missing or mistyped one fails the build.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();
const facetList = z.array(z.object({ value: z.string(), count }));

export const skillFacetsSchema = z.object({
  total: count,
  facets: z.object({
    family: facetList,
    skill: facetList,
    company: facetList,
  }),
});
export type SkillFacets = z.infer<typeof skillFacetsSchema>;

export const companyDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable().optional(),
});
export type CompanyDetail = z.infer<typeof companyDetailSchema>;

const jobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.object({ id: z.string(), name: z.string() }),
  salary: z
    .object({
      currency: z.string().nullable().optional(),
      annualMin: z.number().nullable().optional(),
      annualMax: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  places: z
    .array(
      z.object({
        label: z.string(),
        countryCode: z.string().nullable().optional(),
        admin1Code: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
      }),
    )
    .default([]),
  workMode: z.string().nullable().optional(),
  openedAt: day,
  skills: z.array(z.string()).default([]),
});
export type KrillJob = z.infer<typeof jobSchema>;

export const jobPageSchema = z.object({
  items: z.array(jobSchema),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type KrillJobPage = z.infer<typeof jobPageSchema>;

export class SkillKrill {
  constructor(private readonly api: KrillApi) {}

  /** Facets for a filter, or null when krill answers 500 for it (a known krill bug on some filters). */
  async facets(params: Params): Promise<SkillFacets | null> {
    try {
      return (await this.api.client.get('/v1/facets', { limit: 20, ...params }, skillFacetsSchema, { facetDimensions: params.postedSince ? ['family'] : ['family', 'skill', 'company'] })).data;
    } catch (err) {
      if (err instanceof KrillHttpError && err.status === 500) return null;
      throw err;
    }
  }

  async company(id: string): Promise<CompanyDetail | null> {
    try {
      return (await this.api.client.get(`/v1/companies/${encodeURIComponent(id)}`, {}, companyDetailSchema)).data;
    } catch (err) {
      if (err instanceof KrillHttpError && err.status === 404) return null;
      throw err;
    }
  }

  async jobs(params: Params): Promise<KrillJobPage> {
    return (await this.api.client.get('/v1/jobs', params, jobPageSchema)).data;
  }

  /** Roles naming the skill, newest posting first. */
  async latestRoles(skill: string, pageSize: number): Promise<KrillJob[]> {
    return (await this.jobs({ skills: skill, sort: 'posted', pageSize })).items;
  }

  /**
   * Up to `pages` x 100 of the newest roles in a profession with listed annual
   * pay in one country and currency. One sample serves every skill of the profession.
   */
  async pricedRoles(family: string, country: string, currency: string, pages: number): Promise<KrillJob[]> {
    const out: KrillJob[] = [];
    // krill's cursor holds only the position: every page repeats the filters.
    const filters: Params = { family, country, currency, salaryMin: 1, sort: 'newest', pageSize: 100 };
    let cursor: string | undefined;
    for (let i = 0; i < pages; i++) {
      const page = await this.jobs(cursor ? { ...filters, cursor } : filters);
      out.push(...page.items);
      if (!page.nextCursor || page.items.length === 0) break;
      cursor = page.nextCursor;
    }
    return out;
  }
}

