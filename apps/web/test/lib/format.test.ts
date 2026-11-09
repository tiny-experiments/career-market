import { describe, expect, it } from "vitest";
import {
  direction,
  formatCount,
  formatDays,
  formatPay,
  formatPayRange,
  formatPercent,
  formatShare,
  monogram,
} from "@/lib/format";

describe("format", () => {
  it("writes whole counts with thousands separators", () => {
    expect(formatCount(99_923)).toBe("99,923");
    expect(formatCount(661)).toBe("661");
    expect(formatCount(262_845.4)).toBe("262,845");
  });

  it("writes a change as an unsigned percentage with one decimal", () => {
    expect(formatPercent(0.037)).toBe("3.7%");
    expect(formatPercent(-0.007)).toBe("0.7%");
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatPercent(0.12)).toBe("12.0%");
  });

  it("writes a share as a whole percentage", () => {
    expect(formatShare(0.27)).toBe("27%");
    expect(formatShare(0.085)).toBe("9%");
  });

  it("writes pay in thousands and millions", () => {
    expect(formatPay(144_000)).toBe("$144K");
    expect(formatPay(1_250_000)).toBe("$1.25M");
    expect(formatPay(12_000_000)).toBe("$12M");
    expect(formatPayRange(144_000, 157_000)).toBe("$144K–$157K");
    expect(formatPayRange(150_000, 150_400)).toBe("$150K");
  });

  it("writes days with their unit", () => {
    expect(formatDays(38)).toBe("38 days");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(41.6)).toBe("42 days");
  });

  it("builds a monogram from the first letters", () => {
    expect(monogram("Software")).toBe("S");
    expect(monogram("Platform & Infra")).toBe("PI");
    expect(monogram("AI & ML")).toBe("AM");
    expect(monogram("")).toBe("?");
  });

  it("reads tiny changes as flat", () => {
    expect(direction(0.037)).toBe("up");
    expect(direction(-0.007)).toBe("down");
    expect(direction(0.0002)).toBe("flat");
  });
});
