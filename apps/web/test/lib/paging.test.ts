import { describe, expect, it } from "vitest";
import { pageWindow } from "@/lib/paging";

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
