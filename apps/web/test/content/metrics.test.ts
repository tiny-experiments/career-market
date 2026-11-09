import { describe, expect, it } from "vitest";
import { METRICS, SIGNALS, metricHint } from "@/content";

describe("metric hints", () => {
  it("explains every figure in one sentence", () => {
    for (const [key, hint] of Object.entries(METRICS)) {
      expect(hint.title, key).toBeTruthy();
      // One sentence: ends with a full stop and has no other sentence break.
      expect(hint.text, key).toMatch(/\.$/);
      expect(hint.text.slice(0, -1), key).not.toMatch(/[.!?](?=\s)/);
      expect(hint.text.split(/\s+/).length, key).toBeLessThanOrEqual(26);
    }
  });

  it("never says how the data is gathered or how much history there is", () => {
    for (const [key, hint] of Object.entries(METRICS)) {
      expect(hint.text, key).not.toMatch(
        /\b(?:we (?:saw|see|read|fetch|crawl|collect)|first saw|detect|fetched|history so far|days of history|matched|both days)\b/i,
      );
    }
  });

  it("never gives a formula, so no figure reveals how it is computed", () => {
    for (const [key, hint] of Object.entries(METRICS)) {
      expect(hint, key).not.toHaveProperty("formula");
    }
  });

  it("says each change in one plain sentence about its window", () => {
    expect(METRICS.changeWeek.text).toBe(
      "How much open roles have grown or shrunk compared with a week ago.",
    );
    for (const key of [
      "changeDay",
      "changeWeek",
      "changeMonth",
      "changeQuarter",
      "changeYear",
    ] as const) {
      expect(METRICS[key].text, key).toMatch(
        /^How much open roles have grown or shrunk compared with .+\.$/,
      );
    }
  });

  it("returns the hint in the shape the components take", () => {
    expect(metricHint("newToday")).toEqual({
      title: "New today",
      text: "Roles first posted today.",
    });
  });

  it("gives each signal a sentence-case word and its rule", () => {
    expect(Object.keys(SIGNALS)).toEqual([
      "RAMPING",
      "STEADY",
      "COOLING",
      "FREEZING",
    ]);
    for (const signal of Object.values(SIGNALS)) {
      expect(signal.label).toMatch(/^[A-Z][a-z]+$/);
      expect(signal.text).toMatch(/\.$/);
    }
    expect(SIGNALS.RAMPING.text).toContain("5%");
    expect(SIGNALS.FREEZING.text).toContain("10%");
  });
});
