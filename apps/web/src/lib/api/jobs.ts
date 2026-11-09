import { read } from "./resource";
import type {
  ClosedJobPayload,
  JobFacets,
  JobListItem,
  JobPagePayload,
  Page,
  PageQuery,
} from "./types";

export interface JobsQuery {
  readonly q?: string | undefined;
  readonly company?: string | undefined;
  readonly family?: string | undefined;
  readonly specialty?: string | undefined;
  readonly skill?: string | undefined;
  readonly region?: string | undefined;
  readonly country?: string | undefined;
  readonly workMode?: "remote" | "hybrid" | "onsite" | undefined;
  readonly level?: string | undefined;
  readonly postedWithin?: number | undefined;
  readonly salaryMin?: number | undefined;
  readonly hasPay?: "true" | undefined;
  readonly currency?: string | undefined;
  readonly sort?: "newest" | "opened" | "salary" | undefined;
}

export const jobsList = (query: JobsQuery & PageQuery) =>
  read<Page<JobListItem>>("/api/jobs", { ...query });

export const jobFacets = () => read<JobFacets>("/api/jobs/facets");

/** A closed job answers 410 with its own page, so that status is an answer. */
export const jobDetail = (id: string) =>
  read<JobPagePayload | ClosedJobPayload>(
    `/api/jobs/${encodeURIComponent(id)}`,
    undefined,
    { accept: [410] },
  );
