import type { JobFacet } from "@/lib/api";

/** The Jobs filter rail's vocabulary, and how an address reads as chips. */

export const SENIORITY_OPTIONS = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff+" },
  { value: "management", label: "Management" },
] as const;

export const WORK_MODE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const;

export const POSTED_OPTIONS = [
  { value: "1d", label: "1d", name: "Posted today" },
  { value: "3d", label: "3d", name: "Posted in 3 days" },
  { value: "7d", label: "7d", name: "Posted this week" },
  { value: "14d", label: "14d", name: "Posted in 2 weeks" },
  { value: "30d", label: "30d", name: "Posted this month" },
] as const;

export const REGION_OPTIONS = [
  { value: "north-america", label: "North America" },
  { value: "europe", label: "Europe" },
  { value: "eu", label: "European Union" },
  { value: "dach", label: "DACH" },
  { value: "nordics", label: "Nordics" },
  { value: "benelux", label: "Benelux" },
  { value: "apac", label: "Asia-Pacific" },
  { value: "latam", label: "Latin America" },
  { value: "mena", label: "Middle East & North Africa" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "salary", label: "Highest pay" },
  { value: "oldest", label: "Longest open" },
] as const;

/** A change to the address: a value sets a parameter, null clears it. */
export type FilterPatch = Readonly<Record<string, string | null>>;

/** Adds or removes a value in a comma list; an empty list clears the parameter. */
export function toggled(current: string | null, value: string): string | null {
  const values = (current ?? "").split(",").filter(Boolean);
  const next = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
  return next.length > 0 ? next.join(",") : null;
}

export const COUNTRY_TOP = 20;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "DE" → "Germany"; an unknown code stays as it is. */
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const facetsOf = (
  facets: readonly JobFacet[] | undefined,
  kind: string,
): readonly JobFacet[] =>
  (facets ?? []).filter((facet) => facet.kind === kind && facet.value !== "");

export interface FilterChip {
  readonly key: string;
  readonly label: string;
  /** What removes this filter from the address. */
  readonly patch: FilterPatch;
}

const labelOf = (
  options: readonly { readonly value: string; readonly label: string }[],
  value: string,
) => options.find((option) => option.value === value)?.label ?? value;

/** One chip per filter in force, each knowing how to take itself off. */
export function filterChips(
  params: URLSearchParams,
  facets: readonly JobFacet[] | undefined,
  companyName: string | null = null,
): readonly FilterChip[] {
  const chips: FilterChip[] = [];
  const families = facetsOf(facets, "family");
  const add = (key: string, label: string, patch: FilterPatch) =>
    chips.push({ key, label, patch });
  const eachOf = (param: string, label: (value: string) => string) => {
    const raw = params.get(param);
    for (const value of (raw ?? "").split(",").filter(Boolean)) {
      add(`${param}:${value}`, label(value), {
        [param]: toggled(raw, value),
      });
    }
  };

  const q = params.get("q");
  if (q) add("q", `“${q}”`, { q: null });
  const company = params.get("company");
  if (company) add("company", companyName ?? company, { company: null });
  eachOf(
    "family",
    (value) => families.find((f) => f.value === value)?.label ?? value,
  );
  const region = params.get("region");
  if (region) add("region", labelOf(REGION_OPTIONS, region), { region: null });
  const country = params.get("country");
  if (country) add("country", countryName(country), { country: null });
  eachOf("mode", (value) => labelOf(WORK_MODE_OPTIONS, value));
  eachOf("level", (value) => labelOf(SENIORITY_OPTIONS, value));
  const posted = params.get("posted");
  if (posted) {
    const days = posted.endsWith("d") ? posted : `${posted}d`;
    add(
      "posted",
      POSTED_OPTIONS.find((option) => option.value === days)?.name ??
        `Posted in ${days.slice(0, -1)} days`,
      { posted: null },
    );
  }
  const salary = params.get("salary");
  if (salary) {
    const currency = params.get("currency") ?? "USD";
    const unit = currency === "USD" ? "$" : `${currency} `;
    add("salary", `From ${unit}${Number(salary).toLocaleString("en-US")}`, {
      salary: null,
      currency: null,
    });
  }
  if (params.get("pay") === "listed") add("pay", "Pay listed", { pay: null });
  return chips;
}

/** Every parameter a filter can set: clearing them keeps only the sort. */
export const FILTER_PARAMS = [
  "q",
  "company",
  "family",
  "specialty",
  "skill",
  "region",
  "country",
  "mode",
  "level",
  "posted",
  "salary",
  "pay",
  "currency",
] as const;

/** The one-click filters on the Jobs table; each is also a filter in the rail. */
export type QuickFilter = "today" | "remote" | "pay";

const QUICK_FILTER_ON: Record<
  QuickFilter,
  (params: URLSearchParams) => boolean
> = {
  today: (params) => /^1d?$/.test(params.get("posted") ?? ""),
  remote: (params) => params.get("mode") === "remote",
  pay: (params) => params.get("pay") === "listed",
};

const QUICK_FILTER_PATCH: Record<QuickFilter, (on: boolean) => FilterPatch> = {
  today: (on) => ({ posted: on ? "1d" : null }),
  remote: (on) => ({ mode: on ? "remote" : null }),
  pay: (on) => ({ pay: on ? "listed" : null }),
};

export const QUICK_FILTERS: readonly QuickFilter[] = ["today", "remote", "pay"];

/** The quick filters the address has on. */
export function quickFiltersOn(params: URLSearchParams): QuickFilter[] {
  return QUICK_FILTERS.filter((filter) => QUICK_FILTER_ON[filter](params));
}

/** The change that turns the quick filters to exactly `on`, leaving the ones that did not move alone. */
export function quickFilterPatch(
  params: URLSearchParams,
  on: readonly string[],
): FilterPatch {
  const patch: Record<string, string | null> = {};
  for (const filter of QUICK_FILTERS) {
    const wanted = on.includes(filter);
    if (wanted !== QUICK_FILTER_ON[filter](params))
      Object.assign(patch, QUICK_FILTER_PATCH[filter](wanted));
  }
  return patch;
}
