/**
 * What the page says when there is nothing to show, when something broke,
 * and while it waits (UI-RULEBOOK.md §9). Empty states say what to do next;
 * error states say what broke and offer a retry. Never an API code.
 */

export interface StateCopy {
  readonly title: string;
  readonly description: string;
}

/** The retry button. */
export const TRY_AGAIN = "Try again";

/** The line under every error title when nothing more specific applies. */
export const ERROR_DETAIL =
  "Something went wrong on our side. Trying again usually works.";

export const EMPTY = {
  jobs: {
    title: "No jobs match these filters",
    description: "Try widening the region or clearing a filter.",
  },
  companyJobs: {
    title: "No open roles right now",
    description: "New roles appear here as soon as the company posts them.",
  },
  companies: {
    title: "No companies match",
    description: "Try another name, or clear the signal filter.",
  },
  professions: {
    title: "No professions match",
    description: "Try another name.",
  },
  skills: {
    title: "No skills match",
    description: "Try another name.",
  },
  history: {
    title: "Not enough history yet",
    description: "Changes show once there is a full week to compare against.",
  },
  ramping: {
    title: "No large company is ramping this week",
    description:
      "Companies appear here when their open roles climb clearly over 30 days.",
  },
  preparing: {
    title: "We're preparing today's numbers",
    description: "Check back in a few minutes.",
  },
  closedJob: {
    title: "This role has closed",
    description:
      "The employer took the listing down. Similar open roles are below.",
  },
  comingSoon: {
    title: "This page is on its way",
    description: "It will open here as soon as it is ready.",
  },
  notFound: {
    title: "We couldn't find that page",
    description: "The link may be old, or the page may have moved.",
  },
} as const satisfies Record<string, StateCopy>;

export type EmptyKey = keyof typeof EMPTY;

/** A search with no hit: "Nothing found for “rust”". */
export function nothingFound(query: string): StateCopy {
  return {
    title: `Nothing found for “${query.trim()}”`,
    description: "Try a profession, a company or a skill.",
  };
}

/** A read that failed: "Companies could not be loaded." */
export function couldNotLoad(what: string): StateCopy {
  return {
    title: `${what} could not be loaded.`,
    description: ERROR_DETAIL,
  };
}

export const ERROR = {
  page: {
    title: "Something went wrong loading this page.",
    description: ERROR_DETAIL,
  },
  market: couldNotLoad("The market"),
  professions: couldNotLoad("Professions"),
  profession: couldNotLoad("This profession"),
  companies: couldNotLoad("Companies"),
  company: couldNotLoad("This company"),
  skills: couldNotLoad("Skills"),
  skill: couldNotLoad("This skill"),
  jobs: couldNotLoad("Jobs"),
  job: couldNotLoad("This job"),
  search: couldNotLoad("Search"),
} as const satisfies Record<string, StateCopy>;

export type ErrorKey = keyof typeof ERROR;

/** The back link from a dead end. */
export const BACK_TO_MARKET = "Back to the market";
