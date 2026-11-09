import type { Database, Queries } from '../../../database/client.ts';
import { notFound } from '../../../http/errors.ts';
import {
  companyDirectory,
  companyPage,
  companyIdOf,
  companiesRamping,
  companySignalsOverview,
} from '../repository.ts';
import type { CompaniesQuery } from '../domain.ts';
import type { JobsQuery, JobsPage } from '../../jobs/domain.ts';
export function createCompaniesServices(deps: {
  db: Database;
  queries: Queries;
  listJobs(query: JobsQuery): Promise<JobsPage>;
}) {
  return Object.freeze({
    list: (query: CompaniesQuery) =>
      companyDirectory(deps.queries, deps.db, query),
    signals: () => companySignalsOverview(deps.queries),
    async detail(slug: string) {
      const page = await companyPage(deps.queries, slug);
      if (!page) throw notFound();
      return page;
    },
    async jobs(slug: string, query: JobsQuery) {
      const company = await companyIdOf(deps.queries, slug);
      if (!company) throw notFound();
      return deps.listJobs({ ...query, company });
    },
    ramping: (asOf: Parameters<typeof companiesRamping>[1], limit: number) =>
      companiesRamping(deps.queries, asOf, limit),
  });
}
export type CompaniesServices = ReturnType<typeof createCompaniesServices>;
