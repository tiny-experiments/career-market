import { describe, expect, it } from "vitest";
import * as content from "@/content";

/**
 * Every string the content module can produce, static or built, is held to
 * the copy rules: no provider or method words, no dates as qualifiers, no
 * asterisks or footnotes, no timestamps, and no company totals.
 */
const RETIRED =
  /\b(?:krill|survival|back-?cast|estimated|bootstrap|chain-linked|comparable days|read model|nightly|refresh(?:ed|es)?|sweep|panel|facet|K2)\b/i;
const DATE_QUALIFIER =
  /\b(?:since|as of|before|after)\s+\d|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\b|\bupdated\s+\d{2}:\d{2}/i;
const FOOTNOTE = /[*†‡]|\(\d\)/;
/** A thousands-separated figure is a total; only the approved "48,000+" may appear. */
const TOTAL = /\d{1,3}(?:,\d{3})+(?!\+)/;

function strings(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value).flatMap((inner) => strings(inner, seen));
}

const built = [
  content.describeChange(0.013, "week"),
  content.describeChange(-0.04, "day"),
  content.describeChange(0, "month"),
  content.companiesHiring(9_815),
  content.seeAll(99_923),
  content.seeAllAt("Amazon"),
  content.showing(8, 3_223),
  content.notStated("location"),
  content.postedAgo(3),
  content.nothingFound("rust").title,
  content.couldNotLoad("Companies").title,
  content.professionPage("Software Engineering").meta,
  content.companyPage("Stripe").meta,
  content.skillPage("Python").meta,
  content.jobPage("Staff Engineer", "Stripe").meta,
  content.verdictSummary({
    kind: "first-time",
    daysOpen: 12,
    repostCount: 0,
    typicalDays: 41,
  }),
  content.verdictSummary({ kind: "reposted", daysOpen: 12, repostCount: 2 }),
  content.verdictSummary({ kind: "evergreen", daysOpen: 120, repostCount: 4 }),
  content.verdictSummary({
    kind: "closing-soon",
    daysOpen: 38,
    repostCount: 0,
    typicalDays: 41,
  }),
  ...content
    .verdictFacts({ daysOpen: 12, repostCount: 0, typicalDays: 41 })
    .map((fact) => `${fact.label} ${fact.value}`),
];

const fixed = strings(content);

describe("content vocabulary", () => {
  it("has something to check", () => {
    expect(fixed.length).toBeGreaterThan(80);
  });

  it.each([...fixed, ...built])("%s", (text) => {
    expect(text).not.toMatch(RETIRED);
    expect(text).not.toMatch(DATE_QUALIFIER);
    expect(text).not.toMatch(FOOTNOTE);
  });

  // A built sentence carries the count it was given; a fixed one never carries a total.
  it.each(fixed)("no total in %s", (text) => {
    expect(text.replace(/48,000\+/g, "")).not.toMatch(TOTAL);
  });

  it("names the source only in the footer line", () => {
    const aboutPages = strings(content).filter((text) =>
      /career pages/i.test(text),
    );
    expect(aboutPages).toEqual([content.FOOTER_LINE]);
  });
});
