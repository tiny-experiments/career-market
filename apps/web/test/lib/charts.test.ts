import { describe, expect, it } from "vitest";
import { daysEndingOn } from "@/lib/charts";

describe("daysEndingOn", () => {
  it("dates a daily series back from its last day, oldest first", () => {
    expect(daysEndingOn("2026-11-10", 3)).toEqual([
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
    ]);
  });

  it("crosses month and year ends", () => {
    expect(daysEndingOn("2027-01-01", 3)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("reads the day from a timestamp", () => {
    expect(daysEndingOn("2026-11-10T14:30:00Z", 1)).toEqual(["2026-11-10"]);
  });

  it("has nothing to date for an empty series or an unreadable day", () => {
    expect(daysEndingOn("2026-11-10", 0)).toEqual([]);
    expect(daysEndingOn("soon", 3)).toEqual([]);
  });
});
