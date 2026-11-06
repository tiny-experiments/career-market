import { countryName } from '@cm/core/codes';
import type { CompanyJob, CompanyJobsPayload } from '@cm/core/company';
import { z } from 'zod';
import type { KrillLive } from './krillLive.ts';

/**
 * Current roles of one company, read live from krill through the shared
 * `KrillLive` client (its pacing, 429 wait and hour cache; job lists are the one
 * thing Career Market does not store). Every krill response is parsed with zod;
 * when krill is slow, busy or down the page shows an honest empty state instead
 * of failing.
 */

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

export async function companyJobs(live: KrillLive, companyId: string, filter: JobFilter): Promise<CompanyJobsPayload> {
  const params: Record<string, string | number> = { company: companyId };
  if (filter.profession && FAMILY_RE.test(filter.profession)) params.family = filter.profession;
  if (filter.country && COUNTRY_RE.test(filter.country)) params.country = filter.country;
  if (filter.remote) params.workMode = 'remote';
  try {
    const [page, count] = await Promise.all([
      live.get('/v1/jobs', { ...params, sort: 'opened', pageSize: filter.limit }, jobPageSchema),
      live.get('/v1/facets', { ...params, limit: 1 }, totalSchema),
    ]);
    return { available: true, total: count.total, items: page.items.map(toJob) };
  } catch {
    return { available: false, reason: 'The live role list from krill did not answer. Try again in a few minutes.' };
  }
}

/** Only http(s) links are ever rendered; anything else (javascript:, data:) is dropped. */
function httpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
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
    url: httpUrl(j.url),
  };
}
