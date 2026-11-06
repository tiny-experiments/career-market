import { countryName } from '@cm/core/codes';
import type { CompanyJob, CompanyJobsPayload } from '@cm/core/company';
import type { Logger } from '@cm/core/logger';
import { z } from 'zod';

/**
 * Current roles of one company, read live from krill and cached for an hour
 * (job lists are the one thing Career Market does not store). Every krill
 * response is parsed with zod; when krill is slow, busy or down the page shows
 * an honest empty state instead of failing.
 */
const CACHE_MS = 60 * 60 * 1000;
const MAX_CACHE = 500;
const TIMEOUT_MS = 8_000;

const jobPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      team: z.string().nullable().optional(),
      department: z.string().nullable().optional(),
      workMode: z.enum(['onsite', 'hybrid', 'remote']).nullable().optional(),
      locations: z.array(z.string()).optional(),
      places: z
        .array(z.object({ label: z.string(), countryCode: z.string().nullable(), admin1Code: z.string().nullable(), city: z.string().nullable() }))
        .optional(),
      level: z.string().nullable().optional(),
      ageDays: z.number().int().nonnegative().optional(),
      url: z.string(),
      applyUrl: z.string().nullable().optional(),
    }),
  ),
});
const totalSchema = z.object({ total: z.number().int().nonnegative() });

export interface JobFilter {
  /** krill family id, e.g. "software". */
  profession?: string | undefined;
  /** ISO country code. */
  country?: string | undefined;
  remote?: boolean | undefined;
  limit: number;
}

export const FAMILY_RE = /^[a-z][a-z-]{1,40}$/;
export const COUNTRY_RE = /^[A-Z]{2}$/;

export function createCompanyJobs(deps: { baseUrl: string; apiKey: string | undefined; log: Logger; fetchImpl?: typeof fetch; now?: () => number }) {
  const cache = new Map<string, { at: number; payload: CompanyJobsPayload }>();
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;

  async function krill<S extends z.ZodTypeAny>(pathname: string, params: Record<string, string | number>, schema: S): Promise<z.infer<S>> {
    const url = new URL(pathname, `${deps.baseUrl}/`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await doFetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'career-market-read-api', ...(deps.apiKey ? { authorization: `Bearer ${deps.apiKey}` } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`krill answered ${res.status}`);
    return schema.parse(await res.json());
  }

  return async function companyJobs(companyId: string, filter: JobFilter): Promise<CompanyJobsPayload> {
    const params: Record<string, string | number> = { company: companyId };
    if (filter.profession && FAMILY_RE.test(filter.profession)) params.family = filter.profession;
    if (filter.country && COUNTRY_RE.test(filter.country)) params.country = filter.country;
    if (filter.remote) params.workMode = 'remote';
    const key = JSON.stringify([params, filter.limit]);
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.payload;

    let payload: CompanyJobsPayload;
    try {
      const [page, count] = await Promise.all([
        krill('/v1/jobs', { ...params, sort: 'opened', pageSize: filter.limit }, jobPageSchema),
        krill('/v1/facets', { ...params, limit: 1 }, totalSchema),
      ]);
      payload = { available: true, total: count.total, items: page.items.map(toJob) };
    } catch (err) {
      deps.log.warn({ err: String(err) }, 'live job list from krill failed');
      return { available: false, reason: 'The live role list from krill did not answer. Try again in a few minutes.' };
    }
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: now(), payload });
    return payload;
  };
}

function toJob(j: z.infer<typeof jobPageSchema>['items'][number]): CompanyJob {
  const place = j.places?.[0];
  let location = j.locations?.[0] ?? 'Location not stated';
  if (place?.countryCode) {
    const country = countryName(place.countryCode);
    // Only letter codes are readable regions (US states); numeric geonames codes are not.
    if (place.admin1Code && /^[A-Z]{2,3}$/.test(place.admin1Code)) location = `${country} (${place.admin1Code})`;
    else location = place.city ? `${place.city}, ${country}` : country;
  }
  return {
    id: j.id,
    title: j.title,
    team: j.team ?? j.department ?? null,
    location,
    workMode: j.workMode ?? null,
    level: j.level ?? null,
    ageDays: j.ageDays ?? 0,
    url: j.url,
  };
}
