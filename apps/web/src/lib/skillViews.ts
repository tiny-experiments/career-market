import type { SortDirection } from "@/components/data/DataTable";
import type { SkillIndexRow } from "@/lib/api";

/** The Skills table's filters, as `?view=`. */
export type SkillView = "all" | "growing" | "best-paid" | "paired" | "remote";

export const SKILL_VIEWS: readonly SkillView[] = [
  "all",
  "growing",
  "best-paid",
  "paired",
  "remote",
];
export type SkillSortKey =
  "open" | "label" | "change7d" | "change30d" | "pay" | "remote" | "pair";

export const SKILL_SORT_KEYS: readonly SkillSortKey[] = [
  "open",
  "label",
  "change7d",
  "change30d",
  "pay",
  "remote",
  "pair",
];

const VIEW_SORT: Record<SkillView, SkillSortKey> = {
  all: "open",
  growing: "change30d",
  "best-paid": "pay",
  paired: "pair",
  remote: "remote",
};

export function skillViewFrom(search: URLSearchParams): SkillView {
  return SKILL_VIEWS.find((view) => view === search.get("view")) ?? "all";
}

export function viewSort(view: SkillView): {
  key: SkillSortKey;
  direction: SortDirection;
} {
  return { key: VIEW_SORT[view], direction: "desc" };
}

export function naturalSkillDirection(key: string): SortDirection {
  return key === "label" ? "asc" : "desc";
}

function figure(row: SkillIndexRow, key: SkillSortKey): number | string | null {
  switch (key) {
    case "open":
      return row.open;
    case "label":
      return row.label.toLowerCase();
    case "change7d":
      return row.change7d?.value ?? null;
    case "change30d":
      return row.change?.value ?? null;
    case "pay":
      return row.pay?.median ?? null;
    case "remote":
      return row.remoteShare;
    case "pair":
      return row.topPair?.share ?? null;
  }
}

/** A sorted copy; a skill without the figure always goes last. */
export function sortSkills(
  rows: readonly SkillIndexRow[],
  key: SkillSortKey,
  direction: SortDirection,
): SkillIndexRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = figure(a, key);
    const y = figure(b, key);
    if (x === null || y === null) {
      if (x === y) return b.open - a.open;
      return x === null ? 1 : -1;
    }
    if (x === y) return b.open - a.open;
    return (x < y ? -1 : 1) * sign;
  });
}

/** The skills whose name holds the query, whatever its case. */
export function filterSkills(
  rows: readonly SkillIndexRow[],
  query: string,
): readonly SkillIndexRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => row.label.toLowerCase().includes(needle));
}
