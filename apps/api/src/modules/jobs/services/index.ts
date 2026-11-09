import type { Queries } from '../../../database/client.ts';
import { AppError, notFound, sourceUnavailable } from '../../../http/errors.ts';
import { familyInfo } from '@cm/core/codes';
import { shortLocation, splitLocations } from '@cm/core/job';
import {
  jobPage,
  companyIdentities,
  resolveCompany,
  jobFacets,
  jobsPulse,
  type JobsPulse,
} from '../repository.ts';
import type { JobsRepository, JobsQuery, JobsPage } from '../domain.ts';
/** The strip above the Jobs table is the same for everyone; a minute old is fine. */
const PULSE_TTL_MS = 60_000;

export function createJobsServices(deps: {
  queries: Queries;
  jobs: JobsRepository;
}) {
  let pulse: { at: number; value: Promise<JobsPulse> } | null = null;
  return Object.freeze({
    async list(query: JobsQuery): Promise<JobsPage> {
      const resolved = query.company
        ? await resolveCompany(deps.queries, query.company)
        : null;
      const page = await deps.jobs
        .list({
          ...query,
          company: resolved?.id,
          // Words that are no company's id or slug match inside employer names.
          companyContains: resolved ? undefined : query.company,
        })
        .catch((err) => {
          throw err instanceof AppError ? err : sourceUnavailable();
        });
      const identities = await companyIdentities(
        deps.queries,
        page.items.map((j) => j.company.id),
      );
      return {
        ...page,
        filterCompany: resolved ?? null,
        items: page.items.map((j) => {
          const places = splitLocations(
            j.locations.length > 0 ? j.locations : j.places.map((p) => p.label),
          );
          const identity = identities.get(j.company.id);
          return {
            id: j.id,
            title: j.title,
            company: {
              ...j.company,
              name: identity?.name ?? j.company.name,
              domain: identity?.domain ?? null,
            },
            location: places[0] ? shortLocation(places[0]) : null,
            moreLocations: Math.max(0, places.length - 1),
            workMode: j.workMode,
            level: j.level,
            family: j.family,
            familyName: j.family ? familyInfo(j.family).name : null,
            salary: j.salary,
            openedAt: j.openedAt,
            ageDays: j.ageDays,
            repostCount: j.repostCount,
            href: `/jobs/${encodeURIComponent(j.id)}`,
          };
        }),
      };
    },
    async detail(id: string) {
      const result = await jobPage(
        { sql: deps.queries, jobs: deps.jobs, withLogos: true },
        id,
      );
      if (result.kind === 'missing') throw notFound();
      return result;
    },
    facets: () => jobFacets(deps.queries),
    pulse: () => {
      if (!pulse || Date.now() - pulse.at > PULSE_TTL_MS) {
        const value = jobsPulse(deps.queries, deps.jobs);
        const entry = { at: Date.now(), value };
        pulse = entry;
        // A failed read is not worth remembering.
        value.catch(() => {
          if (pulse === entry) pulse = null;
        });
      }
      return pulse.value;
    },
  });
}
export type JobsServices = ReturnType<typeof createJobsServices>;
