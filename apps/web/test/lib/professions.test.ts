import { describe, expect, it } from "vitest";
import {
  bestPaidProfessions,
  coolingProfessions,
  gainingProfessions,
  marketBreadth,
  professionHref,
  professionRegionFrom,
  professionViewFrom,
  sortProfessions,
  type ProfessionRow,
} from "@/lib/professions";

function row(family: string, change: number | null, median?: number) {
  return {
    family,
    code: family.toUpperCase(),
    name: family,
    longName: family,
    open: 100,
    change:
      change === null
        ? null
        : {
            range: "1W",
            value: change,
            baseDate: "2026-11-02",
            partial: false,
            estimated: false,
          },
    change1d: null,
    change1m: null,
    newThisWeek: 0,
    companies: null,
    pay: median ? { low: median, median, high: median } : null,
    remoteShare: null,
    spark: [],
  } satisfies ProfessionRow;
}

const rows = [row("a", 0.1, 100), row("b", -0.2), row("c", null, 200)];
const families = (list: readonly ProfessionRow[]) => list.map((r) => r.family);

describe("views and regions", () => {
  it("reads a known view and falls back to the overview", () => {
    expect(professionViewFrom(new URLSearchParams("view=cooling"))).toBe(
      "cooling",
    );
    expect(professionViewFrom(new URLSearchParams("view=nope"))).toBe(
      "overview",
    );
  });

  it("drops an unknown region so the API is never asked for it", () => {
    expect(professionRegionFrom(new URLSearchParams("region=apac"))).toBe(
      "apac",
    );
    expect(
      professionRegionFrom(new URLSearchParams("region=mars")),
    ).toBeUndefined();
  });

  it("links by the lower-case code", () => {
    expect(professionHref("SWE")).toBe("/professions/swe");
  });
});

describe("ordering", () => {
  it("sinks a row with no figure whichever way the column runs", () => {
    expect(families(sortProfessions(rows, "change7d", "desc"))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(families(sortProfessions(rows, "change7d", "asc"))).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("splits gainers, fallers and the paid", () => {
    expect(families(gainingProfessions(rows))).toEqual(["a"]);
    expect(families(coolingProfessions(rows))).toEqual(["b"]);
    expect(families(bestPaidProfessions(rows))).toEqual(["c", "a"]);
  });

  it("counts breadth only over professions with a comparison", () => {
    expect(marketBreadth(rows)).toEqual({ up: 1, total: 2, share: 0.5 });
    expect(marketBreadth([]).share).toBe(0);
  });
});
