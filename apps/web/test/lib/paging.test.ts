import { describe, expect, it } from "vitest";
import { pageWindow, rowsThatFit } from "@/lib/paging";

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the first and last pages with a gap around the window", () => {
    expect(pageWindow(180, 366)).toEqual([1, null, 179, 180, 181, null, 366]);
  });

  it("widens the window at either end so it never jumps", () => {
    expect(pageWindow(1, 366)).toEqual([1, 2, 3, 4, null, 366]);
    expect(pageWindow(366, 366)).toEqual([1, null, 363, 364, 365, 366]);
  });
});

describe("rowsThatFit", () => {
  it("counts the whole rows the height holds", () => {
    expect(rowsThatFit(452, 40, 5)).toBe(11);
    expect(rowsThatFit(524, 52, 5)).toBe(10);
  });

  it("absorbs sub-pixel layout", () => {
    expect(rowsThatFit(519.6, 52, 5)).toBe(10);
  });

  it("never drops below the minimum, nor guesses before layout", () => {
    expect(rowsThatFit(120, 40, 5)).toBe(5);
    expect(rowsThatFit(0, 40, 5)).toBe(5);
    expect(rowsThatFit(400, 0, 5)).toBe(5);
  });
});
