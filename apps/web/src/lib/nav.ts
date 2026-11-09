/**
 * The two levels of navigation (UI-RULEBOOK.md §4): the top bar's five
 * sections, and each section's sub-bar. A route declares its sub-bar in its
 * `handle`, so the bar follows the page without the page drawing it.
 */

export interface NavItem {
  readonly label: string;
  readonly to: string;
}

export interface SubBarTab {
  readonly label: string;
  /** Path with optional query, e.g. `/professions?view=gaining`. */
  readonly to: string;
  /** Match on the whole URL (path + search); defaults to the pathname only. */
  readonly exact?: boolean;
}

export interface RouteHandle {
  readonly subBar?: readonly SubBarTab[];
  /** The document title's first part; the site name follows it. */
  readonly title?: string;
  /** The page's `<meta name="description">`. */
  readonly meta?: string;
}

export const SECTIONS: readonly NavItem[] = [
  { label: "Market", to: "/" },
  { label: "Professions", to: "/professions" },
  { label: "Companies", to: "/companies" },
  { label: "Skills", to: "/skills" },
  { label: "Jobs", to: "/jobs" },
];

/** Tabs by section, as the page map has them. A view is a query parameter so links share it. */
export const MARKET_TABS: readonly SubBarTab[] = [
  { label: "Overview", to: "/", exact: true },
  { label: "Gaining", to: "/?view=gaining", exact: true },
  { label: "Cooling", to: "/?view=cooling", exact: true },
  { label: "Remote", to: "/?view=remote", exact: true },
  { label: "Best paid", to: "/?view=best-paid", exact: true },
  { label: "New this week", to: "/?view=new", exact: true },
];

export const PROFESSIONS_TABS: readonly SubBarTab[] = [
  { label: "All", to: "/professions", exact: true },
  { label: "Gaining", to: "/professions?view=gaining", exact: true },
  { label: "Cooling", to: "/professions?view=cooling", exact: true },
  { label: "Remote-friendly", to: "/professions?view=remote", exact: true },
  { label: "Best paid", to: "/professions?view=best-paid", exact: true },
];

export const COMPANIES_TABS: readonly SubBarTab[] = [
  { label: "All", to: "/companies", exact: true },
  { label: "Ramping", to: "/companies?signal=ramping", exact: true },
  { label: "Steady", to: "/companies?signal=steady", exact: true },
  { label: "Cooling", to: "/companies?signal=cooling", exact: true },
  { label: "Freezing", to: "/companies?signal=freezing", exact: true },
];

export const SKILLS_TABS: readonly SubBarTab[] = [
  { label: "All", to: "/skills", exact: true },
  { label: "Fastest growing", to: "/skills?view=growing", exact: true },
  { label: "Highest paid", to: "/skills?view=best-paid", exact: true },
  { label: "Most paired", to: "/skills?view=paired", exact: true },
  { label: "Remote-friendly", to: "/skills?view=remote", exact: true },
];

export const JOBS_TABS: readonly SubBarTab[] = [
  { label: "All jobs", to: "/jobs", exact: true },
  { label: "New today", to: "/jobs?posted=1d", exact: true },
  { label: "Remote", to: "/jobs?mode=remote", exact: true },
  { label: "With pay", to: "/jobs?pay=listed", exact: true },
];

/** Whether a sub-bar tab is the current one for this location. */
export function isTabActive(
  tab: SubBarTab,
  location: { pathname: string; search: string },
): boolean {
  const [path, query = ""] = tab.to.split("?");
  if (location.pathname !== path) return false;
  if (!tab.exact) return true;
  return normaliseQuery(location.search) === normaliseQuery(query);
}

function normaliseQuery(search: string): string {
  const params = new URLSearchParams(search);
  const pairs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(pairs).toString();
}
