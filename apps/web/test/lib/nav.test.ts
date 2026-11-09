import { describe, expect, it } from "vitest";
import { isTabActive, MARKET_TABS, PROFESSIONS_TABS, tabHref } from "@/lib/nav";

const at = (pathname: string, search = "") => ({ pathname, search });

describe("nav", () => {
  it("matches a sub-bar tab on path and query", () => {
    const [overview, gaining] = MARKET_TABS;
    expect(isTabActive(overview!, at("/"))).toBe(true);
    expect(isTabActive(overview!, at("/", "?view=gaining"))).toBe(false);
    expect(isTabActive(gaining!, at("/", "?view=gaining"))).toBe(true);
    expect(isTabActive(gaining!, at("/professions", "?view=gaining"))).toBe(
      false,
    );
  });

  it("ignores the order of query parameters", () => {
    const gaining = PROFESSIONS_TABS[1]!;
    expect(
      isTabActive(gaining, at("/professions", "?view=gaining&page=2")),
    ).toBe(false);
    expect(isTabActive(gaining, at("/professions", "?view=gaining"))).toBe(
      true,
    );
  });
});

describe("tabHref", () => {
  const tab = {
    label: "Gaining",
    to: "/professions?view=gaining",
    exact: true,
  };

  it("keeps the page's region and drops the old view", () => {
    expect(tabHref(tab, "?view=cooling&region=europe")).toBe(
      "/professions?view=gaining&region=europe",
    );
  });

  it("leaves a plain tab plain", () => {
    expect(tabHref({ label: "All", to: "/professions" }, "")).toBe(
      "/professions",
    );
  });

  it("still marks the view as current under a region", () => {
    expect(
      isTabActive(tab, {
        pathname: "/professions",
        search: "?view=gaining&region=europe",
      }),
    ).toBe(true);
  });
});
