/**
 * The Jobs list, the job page and search, in words. A verdict is a bold line
 * and one plain sentence; neither ever says how it was worked out.
 */
import type { JobPagePayload } from "@/lib/api";
import { formatDays, formatRelativeDays } from "@/lib/format";
import { VERDICT_LABEL } from "./phrasing";

export type JobVerdict = JobPagePayload["context"]["verdict"];

const times = (n: number) => (n === 1 ? "once" : `${n} times`);

/** "First time posted · 5 days ago", "Reposted once · 30 days open". */
export function verdictHeadline(verdict: JobVerdict): string {
  const { kind, ageDays, repostCount } = verdict;
  const open = ageDays === null ? null : `${formatDays(ageDays)} open`;
  const parts: (string | null)[] = (() => {
    switch (kind) {
      case "first-time":
        return [
          VERDICT_LABEL[kind],
          ageDays === null ? null : formatRelativeDays(ageDays),
        ];
      case "reposted":
        return [`Reposted ${times(repostCount)}`, open];
      case "evergreen":
        return [
          VERDICT_LABEL[kind],
          repostCount > 0 ? `reposted ${times(repostCount)}` : null,
          open,
        ];
      case "closing-soon":
        return [VERDICT_LABEL[kind], open];
    }
  })();
  return parts.filter(Boolean).join(" · ");
}

/** The plain sentence under the verdict's bold line. */
export function verdictDetail(verdict: JobVerdict): string {
  const { kind, ageDays, typical } = verdict;
  const usually = typical
    ? `Roles like this are usually filled within ${formatDays(typical.medianDays)}`
    : null;
  switch (kind) {
    case "first-time": {
      if (!usually) return "Not reposted so far.";
      const early =
        ageDays !== null && typical && ageDays <= typical.medianDays;
      return `Not reposted. ${usually}${early ? ", so this one is early in its window." : "."}`;
    }
    case "reposted":
      return usually
        ? `The employer took this down and posted it again. ${usually}.`
        : "The employer took this down and posted it again.";
    case "evergreen":
      return usually
        ? `This looks like a standing opening rather than one seat. ${usually}.`
        : "This looks like a standing opening rather than one seat.";
    case "closing-soon":
      return "Most roles like this have closed by now, so it may not stay open much longer.";
  }
}

/** "Apply on Stripe’s site": the one outbound link, named for the employer. */
export const applyAt = (company: string) => `Apply on ${company}’s site`;

/** How far along its usual life a role is, for the bar and its hover card. */
export const usualWindow = (low: number, high: number) => ({
  label: `Usually ${low}–${high} days`,
  hint: `Most roles like this close between ${low} and ${high} days after they go up.`,
});

/** "Reposted: Never / Once / 3 times", for a posting's facts. */
export function repostedTimes(count: number): string {
  if (count === 0) return "Never";
  return count === 1 ? "Once" : `${count} times`;
}

/** Where a role's pay sits against the usual range for roles like it. */
export const PAY_POSITION = {
  "below band": "Below the usual range",
  "below median": "A little below the middle",
  "at market median": "Right at the middle",
  "above median": "A little above the middle",
  "above band": "Above the usual range",
} as const;

export const JOB_PAGE = {
  about: "About this role",
  atAGlance: "At a glance",
  noDescription: "The full description is on the employer’s site.",
  noPay: "This employer does not list pay for the role.",
  notListed: "Not listed",
  seeCompanyJobs: "See all jobs here",
  companyPage: "Company page",
  seeProfessionJobs: "See all jobs in this field",
  professionPage: "Profession page",
  similar: "Similar roles",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  verdictRegion: "What kind of posting this is",
  pay: "Pay",
  company: "Company",
  profession: "Profession",
  keyFacts: "This role at a glance",
} as const;

/** "It was open for 37 days." or, when only the closing is known, the plain fact. */
export function closedDetail(openDays: number | null): string {
  return openDays === null
    ? "The employer took the listing down."
    : `It was open for ${formatDays(openDays)}.`;
}

/** "See open roles in Software". */
export const seeOpenRoles = (profession: string | null) =>
  profession ? `See open roles in ${profession}` : "See open roles";

export const JOBS_LIST = {
  pulse: "Jobs at a glance",
  pulseOpen: "Open roles",
  pulseNew: "New today",
  pulseNewCaption: "New roles posted each day, over the last month.",
  pulseRemote: "Remote roles",
  pulseBusiest: "Busiest professions",
  listPay: (share: string) => `${share} list their pay`,
  clearAll: "Clear all",
  clearAllFilters: "Clear all filters",
  anyCompany: "Any company",
  noCompany: "No company by that name.",
  companyContaining: (text: string) => `Companies with “${text}” in the name`,
} as const;

/** "About 180,000 jobs" for a count we only estimated; "4,213 jobs" otherwise. */
export function jobsFound(
  figure: string,
  one: boolean,
  about: boolean,
): string {
  return `${about ? "About " : ""}${figure} ${one ? "job" : "jobs"}`;
}

export const SEARCH_PAGE = {
  title: "Search",
  prompt: "Find a profession, a company, a skill or a job by name.",
  blankTitle: "Search the market",
  results: (query: string) => `Results for “${query}”`,
} as const;
