import type { ProfessionIndex } from "@/lib/api";
import type { SortDirection } from "@/components/data/DataTable";

export type ProfessionRow = ProfessionIndex["rows"][number];

/** A view of the professions table: the sub-bar's `?view=` on Market and Professions. */
export type ProfessionView =
  "overview" | "gaining" | "cooling" | "remote" | "best-paid" | "new";

const VIEWS: readonly ProfessionView[] = [
  "gaining",
  "cooling",
  "remote",
  "best-paid",
  "new",
];

export function professionViewFrom(search: URLSearchParams): ProfessionView {
  return VIEWS.find((view) => view === search.get("view")) ?? "overview";
}

/** The regions the table can be scoped to; the ids match the Jobs region filter. */
export const PROFESSION_REGIONS = [
  { id: "north-america", label: "North America" },
  { id: "europe", label: "Europe" },
  { id: "apac", label: "Asia-Pacific" },
  { id: "latam", label: "Latin America" },
  { id: "mena", label: "Middle East & North Africa" },
] as const;

export type ProfessionRegion = (typeof PROFESSION_REGIONS)[number]["id"];

export function professionRegionFrom(
  search: URLSearchParams,
): ProfessionRegion | undefined {
  return PROFESSION_REGIONS.find((r) => r.id === search.get("region"))?.id;
}

export function professionHref(code: string): string {
  return `/professions/${code.toLowerCase()}`;
}

export type ProfessionSortKey =
  | "name"
  | "open"
  | "change1d"
  | "change7d"
  | "change1m"
  | "companies"
  | "pay"
  | "remote"
  | "new";

const SORT_VALUE: Record<
  ProfessionSortKey,
  (row: ProfessionRow) => number | string | null
> = {
  name: (row) => row.name,
  open: (row) => row.open,
  change1d: (row) => row.change1d,
  change7d: (row) => row.change?.value ?? null,
  change1m: (row) => row.change1m,
  companies: (row) => row.companies,
  pay: (row) => row.pay?.median ?? null,
  remote: (row) => row.remoteShare,
  new: (row) => row.newThisWeek,
};

/** Rows ordered by a column; a row with no figure always sinks to the bottom. */
export function sortProfessions(
  rows: readonly ProfessionRow[],
  key: ProfessionSortKey,
  direction: SortDirection,
): ProfessionRow[] {
  const value = SORT_VALUE[key];
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return typeof left === "string" || typeof right === "string"
      ? sign * String(left).localeCompare(String(right))
      : sign * (left - right);
  });
}

/** The order a view opens in: the column it is about, biggest first. */
export const VIEW_SORT: Record<
  ProfessionView,
  { readonly key: ProfessionSortKey; readonly direction: SortDirection }
> = {
  overview: { key: "open", direction: "desc" },
  gaining: { key: "change7d", direction: "desc" },
  cooling: { key: "change7d", direction: "asc" },
  remote: { key: "remote", direction: "desc" },
  "best-paid": { key: "pay", direction: "desc" },
  new: { key: "new", direction: "desc" },
};

/** Professions up on the week, fastest first. */
export function gainingProfessions(
  rows: readonly ProfessionRow[],
): ProfessionRow[] {
  return sortProfessions(
    rows.filter((row) => (row.change?.value ?? 0) > 0),
    "change7d",
    "desc",
  );
}

/** Professions down on the week, fastest falling first. */
export function coolingProfessions(
  rows: readonly ProfessionRow[],
): ProfessionRow[] {
  return sortProfessions(
    rows.filter((row) => (row.change?.value ?? 0) < 0),
    "change7d",
    "asc",
  );
}

/** Professions with a pay range, highest paid first. */
export function bestPaidProfessions(
  rows: readonly ProfessionRow[],
): ProfessionRow[] {
  return sortProfessions(
    rows.filter((row) => row.pay !== null),
    "pay",
    "desc",
  );
}

/** How many professions are up on the week, of those with a comparison. */
export function marketBreadth(rows: readonly ProfessionRow[]): {
  readonly up: number;
  readonly total: number;
  readonly share: number;
} {
  const known = rows.filter((row) => row.change !== null);
  const up = known.filter((row) => (row.change?.value ?? 0) > 0).length;
  return {
    up,
    total: known.length,
    share: known.length === 0 ? 0 : up / known.length,
  };
}
