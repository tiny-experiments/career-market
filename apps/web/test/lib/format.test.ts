import { describe, expect, it } from "vitest";
import {
  daysSince,
  direction,
  formatCount,
  formatDay,
  formatDays,
  formatListedPay,
  formatMoney,
  formatMoneyRange,
  formatPay,
  formatPayRange,
  formatPercent,
  formatRelativeDay,
  formatRelativeDays,
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
    expect(formatPay(999_400)).toBe("$999K");
    expect(formatPay(999_600)).toBe("$1M");
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

  it("writes a day as a date, not a qualifier", () => {
    expect(formatDay("2026-11-09")).toBe("9 Nov 2026");
    expect(formatDay("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDay("not a day")).toBe("not a day");
  });

  it("says how long ago in words", () => {
    expect(formatRelativeDays(0)).toBe("today");
    expect(formatRelativeDays(1)).toBe("yesterday");
    expect(formatRelativeDays(3)).toBe("3 days ago");
    expect(formatRelativeDays(6)).toBe("6 days ago");
    expect(formatRelativeDays(7)).toBe("a week ago");
    expect(formatRelativeDays(12)).toBe("2 weeks ago");
    expect(formatRelativeDays(29)).toBe("4 weeks ago");
    expect(formatRelativeDays(30)).toBe("a month ago");
    expect(formatRelativeDays(100)).toBe("3 months ago");
    expect(formatRelativeDays(365)).toBe("a year ago");
    expect(formatRelativeDays(800)).toBe("2 years ago");
    expect(formatRelativeDays(-2)).toBe("today");
  });

  it("counts the days since an ISO day in UTC", () => {
    const today = new Date("2026-11-09T23:30:00Z");
    expect(daysSince("2026-11-09", today)).toBe(0);
    expect(daysSince("2026-11-06", today)).toBe(3);
    expect(daysSince("2026-11-10", today)).toBe(0);
    expect(daysSince("garbage", today)).toBe(0);
    expect(formatRelativeDay("2026-11-06", today)).toBe("3 days ago");
  });

  it("writes money in any currency in the same shape as pay", () => {
    expect(formatMoney(144_000)).toBe("$144K");
    expect(formatMoney(80_000, "EUR")).toBe("€80K");
    expect(formatMoney(1_250_000, "GBP")).toBe("£1.25M");
    expect(formatMoney(90_000, "CHF")).toBe("CHF 90K");
    expect(formatMoneyRange(144_000, 157_000)).toBe("$144K–$157K");
    expect(formatMoneyRange(80_000, 80_000, "EUR")).toBe("€80K");
  });

  it("writes the pay a posting lists, or nothing", () => {
    expect(
      formatListedPay({
        min: 144_000,
        max: 157_000,
        currency: "USD",
        period: "year",
        annualMin: 144_000,
        annualMax: 157_000,
      }),
    ).toBe("$144K–$157K");
    expect(
      formatListedPay({
        min: 45,
        max: 60,
        currency: "USD",
        period: "hour",
        annualMin: null,
        annualMax: null,
      }),
    ).toBe("$45–$60 an hour");
    expect(
      formatListedPay({
        min: 45.5,
        max: null,
        currency: null,
        period: "hourly",
      }),
    ).toBe("$45.50 an hour");
    expect(
      formatListedPay({
        min: 8_000,
        max: 10_000,
        currency: "EUR",
        period: "month",
      }),
    ).toBe("€8,000–€10,000 a month");
    expect(
      formatListedPay({
        min: 120_000,
        max: null,
        currency: "GBP",
        period: null,
      }),
    ).toBe("£120K");
    expect(
      formatListedPay({
        min: null,
        max: null,
        currency: "USD",
        period: "year",
      }),
    ).toBeNull();
    expect(formatListedPay(null)).toBeNull();
  });
});
