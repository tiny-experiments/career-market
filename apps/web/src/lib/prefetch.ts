import { matchPath } from "react-router";
import { fetchResource, isCovered } from "@/lib/api";
import { pageRoutes } from "@/routes";

/**
 * Fetching ahead of a click. A page's chunk and data are asked for when the
 * pointer rests on its link, within a budget: sweeping down a long table must
 * not spend the visitor's request allowance on rows they never open.
 */

const BUDGET_WINDOW_MS = 60_000;
const BUDGET_REQUESTS = 30;

let spent: number[] = [];

function withinBudget(requests: number): boolean {
  const now = Date.now();
  spent = spent.filter((at) => now - at < BUDGET_WINDOW_MS);
  if (spent.length + requests > BUDGET_REQUESTS) return false;
  for (let i = 0; i < requests; i += 1) spent.push(now);
  return true;
}

function savingData(): boolean {
  const { connection } = navigator as Navigator & {
    readonly connection?: { readonly saveData?: boolean };
  };
  return connection?.saveData === true;
}

/** Warms the page behind an in-app address. Unknown addresses are ignored. */
export function prefetchPath(href: string): void {
  if (savingData()) return;
  const url = new URL(href, window.location.origin);
  for (const route of pageRoutes) {
    const match = matchPath({ path: route.path, end: true }, url.pathname);
    if (match === null) continue;
    void route.page().catch(() => undefined);
    const wanted = (
      route.data?.({ params: match.params, search: url.searchParams }) ?? []
    ).filter((resource) => !isCovered(resource.key));
    if (wanted.length > 0 && withinBudget(wanted.length)) {
      wanted.forEach((resource) => fetchResource(resource));
    }
    return;
  }
}

/** Loads every page's chunk, so no click ever waits on one. */
export function preloadPages(): void {
  if (savingData()) return;
  pageRoutes.forEach((route) => void route.page().catch(() => undefined));
}

/** Restores the budget. For tests. */
export function resetPrefetchBudget(): void {
  spent = [];
}
