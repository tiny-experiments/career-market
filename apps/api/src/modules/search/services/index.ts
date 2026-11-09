import type { Queries } from '../../../database/client.ts';
import type { JobsQuery, JobsPage } from '../../jobs/domain.ts';
import { search } from '../repository.ts';
export function createSearchServices(deps: {
  queries: Queries;
  listJobs(query: JobsQuery): Promise<JobsPage>;
}) {
  return Object.freeze({
    async search(query: { q: string; limit: number; roles: '0' | '1' }) {
      const result = await search(deps.queries, query.q, query.limit);
      if (query.roles !== '1' || query.q.length < 2)
        return { ...result, roles: [], rolesUnavailable: false };
      const roles = await deps
        .listJobs({
          q: query.q,
          page: 1,
          pageSize: 8,
          sort: 'opened',
          currency: 'USD',
        })
        .catch(() => null);
      return {
        ...result,
        roles:
          roles?.items.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company.name,
            location: j.location,
            url: j.href,
          })) ?? [],
        rolesUnavailable: roles === null,
      };
    },
  });
}
export type SearchServices = ReturnType<typeof createSearchServices>;
