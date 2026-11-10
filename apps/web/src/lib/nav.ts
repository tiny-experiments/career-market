/**
 * The site's one level of navigation (UI-RULEBOOK.md §4): the top bar's five
 * sections. A section's views are filters on its own table, never a bar of
 * their own.
 */

export interface NavItem {
  readonly label: string;
  readonly to: string;
}

export interface RouteHandle {
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
