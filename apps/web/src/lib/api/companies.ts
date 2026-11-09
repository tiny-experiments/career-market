import type { JobsQuery } from "./jobs";
import { read } from "./resource";
import type {
  CompanyDirectoryRow,
  CompanyPage,
  JobListItem,
  Page,
  PageQuery,
} from "./types";

export type CompanySignalFilter = "ramping" | "steady" | "cooling" | "freezing";

export interface CompaniesFilters {
  readonly q?: string | undefined;
  readonly signal?: CompanySignalFilter | undefined;
  readonly sort?: "open" | "name" | "change1w" | "rank" | undefined;
  readonly dir?: "asc" | "desc" | undefined;
}

export const companiesList = (query: CompaniesFilters & PageQuery) =>
  read<Page<CompanyDirectoryRow>>("/api/companies", { ...query });

export const companyDetail = (slug: string) =>
  read<CompanyPage>(`/api/companies/${encodeURIComponent(slug)}`);

export const companyJobs = (slug: string, query: JobsQuery & PageQuery) =>
  read<Page<JobListItem>>(`/api/companies/${encodeURIComponent(slug)}/jobs`, {
    ...query,
  });
