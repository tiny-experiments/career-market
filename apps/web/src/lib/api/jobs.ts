import { read } from "./resource";
import type {
  ClosedJobPayload,
  JobFacets,
  JobPagePayload,
  JobsListing,
  JobsPulse,
  PageQuery,
} from "./types";

export interface JobsQuery {
  readonly q?: string | undefined;
  readonly company?: string | undefined;
  /** One family, or several joined by commas. */
  readonly family?: string | undefined;
  readonly specialty?: string | undefined;
  readonly skill?: string | undefined;
  readonly region?: string | undefined;
  readonly country?: string | undefined;
  /** One work mode, or several joined by commas. */
  readonly workMode?: string | undefined;
  /** One seniority, or several joined by commas. */
  readonly level?: string | undefined;
  readonly postedWithin?: number | undefined;
  readonly salaryMin?: number | undefined;
  readonly hasPay?: "true" | undefined;
  readonly currency?: string | undefined;
  readonly sort?: "newest" | "opened" | "oldest" | "salary" | undefined;
}

export const jobsList = (query: JobsQuery & PageQuery) =>
  read<JobsListing>("/api/jobs", { ...query });

export const jobFacets = () => read<JobFacets>("/api/jobs/facets");

export const jobsPulse = () => read<JobsPulse>("/api/jobs/pulse");

/** A closed job answers 410 with its own page, so that status is an answer. */
export const jobDetail = (id: string) =>
  read<JobPagePayload | ClosedJobPayload>(
    `/api/jobs/${encodeURIComponent(id)}`,
    undefined,
    { accept: [410] },
  );
