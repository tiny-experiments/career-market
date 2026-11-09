import type { JobListItem, RoleHit } from "@/lib/api";
import { formatListedPay, type ListedPay } from "@/lib/format";

/** What a posting's yearly figures read as: "$190K–$240K", or null. */
export function yearlyPay(
  pay: Pick<ListedPay, "currency" | "annualMin" | "annualMax"> | null,
): string | null {
  return pay
    ? formatListedPay({ ...pay, min: null, max: null, period: null })
    : null;
}

/** One job as a row, however the list that holds it was read. */
export interface JobRow {
  readonly id: string;
  readonly title: string;
  readonly companyName: string;
  readonly domain: string | null;
  readonly location: string | null;
  readonly moreLocations: number;
  readonly workMode: string | null;
  readonly level: string | null;
  readonly salary: ListedPay | null;
  readonly ageDays: number | null;
  readonly href: string;
  readonly familyName: string | null;
  readonly repostCount: number;
}

export const jobRowFromList = (job: JobListItem): JobRow => ({
  id: job.id,
  title: job.title,
  companyName: job.company.name,
  domain: job.company.domain,
  location: job.location,
  moreLocations: job.moreLocations,
  workMode: job.workMode,
  level: job.level,
  salary: job.salary,
  ageDays: job.ageDays,
  href: job.href,
  familyName: job.familyName,
  repostCount: job.repostCount,
});

export const jobRowFromHit = (hit: RoleHit): JobRow => ({
  id: hit.id,
  title: hit.title,
  companyName: hit.company,
  domain: hit.domain,
  location: hit.location,
  moreLocations: 0,
  workMode: hit.workMode,
  level: hit.level,
  salary: hit.salary && { ...hit.salary, min: null, max: null, period: null },
  ageDays: hit.ageDays,
  href: hit.url,
  familyName: null,
  repostCount: 0,
});
