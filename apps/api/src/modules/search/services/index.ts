import type { Queries } from '../../../database/client.ts';
import type { JobsQuery, JobsPage } from '../../jobs/domain.ts';
import { search } from '../repository.ts';
/** The results page asks for this many per kind; the nav's typeahead asks for fewer. */
const FULL_PAGE_LIMIT = 10;

export function createSearchServices(deps: {
  queries: Queries;
  listJobs(query: JobsQuery): Promise<JobsPage>;
}) {
  return Object.freeze({
    async search(query: { q: string; limit: number; roles: '0' | '1' }) {
      const result = await search(deps.queries, query.q, query.limit);
      if (query.roles !== '1' || query.q.length < 2)
        return { ...result, roles: [], rolesTotal: 0, rolesUnavailable: false };
      const roles = await deps
        .listJobs({
          q: query.q,
          page: 1,
          pageSize: query.limit >= FULL_PAGE_LIMIT ? 20 : 8,
          sort: 'opened',
        })
        .catch(() => null);
      return {
        ...result,
        roles:
          roles?.items.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company.name,
            domain: j.company.domain,
            location: j.location,
            url: j.href,
            level: j.level,
            workMode: j.workMode,
            salary: j.salary
              ? {
                  currency: j.salary.currency,
                  annualMin: j.salary.annualMin,
                  annualMax: j.salary.annualMax,
                }
              : null,
            ageDays: j.ageDays,
          })) ?? [],
        rolesTotal: roles?.total ?? 0,
        rolesUnavailable: roles === null,
      };
    },
  });
}
export type SearchServices = ReturnType<typeof createSearchServices>;
