import type { CompaniesFilters, JobsQuery } from "@/lib/api";

/**
 * A list's address bar, read into a query the API will accept. The API is
 * strict about its parameters, so anything unknown here is dropped: an old or
 * hand-edited link shows a wider list, never an error.
 */

export const LIST_PAGE_SIZE = 50;

const MAX_PAGE = 1_000_000;
const MAX_SALARY = 10_000_000;
const MAX_POSTED_DAYS = 365;

const REGIONS = [
  "north-america",
  "europe",
  "eu",
  "dach",
  "nordics",
  "benelux",
  "apac",
  "latam",
  "mena",
] as const;
const LEVELS = [
  "entry",
  "mid",
  "senior",
  "staff",
  "management",
  "intern",
  "junior",
  "principal",
  "manager",
  "director",
  "executive",
] as const;
const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "INR",
  "JPY",
  "CHF",
] as const;

function text(value: string | null, max: number): string | undefined {
  const trimmed = value?.trim().slice(0, max).trim();
  return trimmed ? trimmed : undefined;
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function matching(value: string | null, pattern: RegExp): string | undefined {
  return value !== null && pattern.test(value) ? value : undefined;
}

function wholeNumber(
  value: string | null,
  min: number,
  max: number,
): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return number >= min && number <= max ? number : undefined;
}

export function pageFrom(search: URLSearchParams): number {
  return wholeNumber(search.get("page"), 1, MAX_PAGE) ?? 1;
}

export function companiesFiltersFrom(
  search: URLSearchParams,
): CompaniesFilters {
  return {
    q: text(search.get("q"), 160),
    signal: oneOf(search.get("signal"), [
      "ramping",
      "steady",
      "cooling",
      "freezing",
    ]),
    sort: oneOf(search.get("sort"), ["open", "name", "change1w", "rank"]),
    dir: oneOf(search.get("dir"), ["asc", "desc"]),
  };
}

/** `posted` is a day count, with or without its unit: `7`, `7d`. */
function postedWithinFrom(value: string | null): number | undefined {
  return wholeNumber(value?.replace(/d$/, "") ?? null, 1, MAX_POSTED_DAYS);
}

export function jobsFiltersFrom(search: URLSearchParams): JobsQuery {
  return {
    q: text(search.get("q"), 80),
    company: text(search.get("company"), 160),
    family: matching(search.get("family"), /^[a-z0-9-]{1,40}$/),
    specialty: matching(search.get("specialty"), /^[a-z0-9-]{1,60}$/),
    skill: matching(search.get("skill"), /^[a-z0-9:+#._-]{1,80}$/i),
    region: oneOf(search.get("region"), REGIONS),
    country: matching(search.get("country"), /^[A-Z]{2}$/),
    workMode: oneOf(search.get("mode"), ["remote", "hybrid", "onsite"]),
    level: oneOf(search.get("level"), LEVELS),
    postedWithin: postedWithinFrom(search.get("posted")),
    salaryMin: wholeNumber(search.get("salary"), 0, MAX_SALARY),
    hasPay: search.get("pay") === "listed" ? "true" : undefined,
    currency: oneOf(search.get("currency"), CURRENCIES),
    sort: oneOf(search.get("sort"), ["newest", "opened", "salary"]),
  };
}
