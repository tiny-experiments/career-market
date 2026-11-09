import type { Queries } from '../../../database/client.ts';
import { AppError, notFound, sourceUnavailable } from '../../../http/errors.ts';
import {
  jobPage,
  companyDomains,
  resolveCompany,
  jobFacets,
} from '../repository.ts';
import type { JobsRepository, JobsQuery, JobsPage } from '../domain.ts';
export function createJobsServices(deps: {
  queries: Queries;
  jobs: JobsRepository;
}) {
  return Object.freeze({
    async list(query: JobsQuery): Promise<JobsPage> {
      let company: string | undefined;
      if (query.company) {
        company =
          (await resolveCompany(deps.queries, query.company)) ?? undefined;
        if (!company)
          return {
            items: [],
            page: query.page,
            pageSize: query.pageSize,
            total: 0,
          };
      }
      const page = await deps.jobs.list({ ...query, company }).catch((err) => {
        throw err instanceof AppError ? err : sourceUnavailable();
      });
      const domains = await companyDomains(
        deps.queries,
        page.items.map((j) => j.company.id),
      );
      return {
        ...page,
        items: page.items.map((j) => ({
          id: j.id,
          title: j.title,
          company: { ...j.company, domain: domains.get(j.company.id) ?? null },
          location: j.places[0]?.label ?? j.locations[0] ?? null,
          workMode: j.workMode,
          level: j.level,
          salary: j.salary,
          openedAt: j.openedAt,
          ageDays: j.ageDays,
          href: `/jobs/${encodeURIComponent(j.id)}`,
        })),
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
  });
}
export type JobsServices = ReturnType<typeof createJobsServices>;
