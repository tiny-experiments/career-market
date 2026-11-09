import { describe, expect, it } from "vitest";
import {
  COMPARISON,
  WINDOW_HEADER,
  changeSuffix,
  companiesHiring,
  countOf,
  describeChange,
  levelLabel,
  notStated,
  openRoles,
  postedAgo,
  seeAll,
  seeAllAt,
  sentence,
  showing,
  sortedBy,
  verdictFacts,
  verdictSummary,
  workModeLabel,
} from "@/content";

describe("phrasing", () => {
  it("says a change as a window, never a date", () => {
    expect(describeChange(0.013, "week")).toBe("up 1.3% this week");
    expect(describeChange(-0.04, "day")).toBe("down 4.0% vs yesterday");
    expect(describeChange(0.0002, "month")).toBe("unchanged over 30 days");
    expect(describeChange(0.21, "quarter")).toBe("up 21.0% over 3 months");
    expect(sentence(describeChange(0, "week"))).toBe("Unchanged this week");
  });

  it("gives Delta the same words", () => {
    for (const window of Object.keys(
      COMPARISON,
    ) as (keyof typeof COMPARISON)[]) {
      expect(changeSuffix(window)).toBe(COMPARISON[window]);
      expect(WINDOW_HEADER[window]).toMatch(/^\d/);
    }
  });

  it("counts with the right noun", () => {
    expect(countOf(1, "role")).toBe("1 role");
    expect(countOf(99_923, "role")).toBe("99,923 roles");
    expect(countOf(2, "company", "companies")).toBe("2 companies");
    expect(openRoles(262_845)).toBe("262,845 open roles");
    expect(companiesHiring(9_815)).toBe("9,815 companies hiring");
    expect(companiesHiring(1)).toBe("1 company hiring");
    expect(showing(8, 3_223)).toBe("8 of 3,223 open roles");
  });

  it("says where a link goes", () => {
    expect(seeAll(99_923)).toBe("See all 99,923 jobs");
    expect(seeAll(1)).toBe("See all 1 job");
    expect(seeAllAt("Amazon")).toBe("See all jobs at Amazon");
    expect(sortedBy("Open roles")).toBe("sorted by open roles");
  });

  it("names what a posting leaves out", () => {
    expect(notStated("location")).toBe("No location stated.");
    expect(workModeLabel("onsite")).toBe("On-site");
    expect(workModeLabel(null)).toBe("Not stated");
    expect(workModeLabel("unknown")).toBe("Not stated");
    expect(levelLabel("mid")).toBe("Mid-level");
    expect(levelLabel(undefined)).toBe("Not stated");
  });

  it("says when a role was posted", () => {
    expect(postedAgo(0)).toBe("Posted today");
    expect(postedAgo(3)).toBe("Posted 3 days ago");
  });

  it("reads a job in one line", () => {
    expect(
      verdictSummary({
        kind: "first-time",
        daysOpen: 12,
        repostCount: 0,
        typicalDays: 41,
      }),
    ).toBe(
      "Posted 2 weeks ago for the first time. Roles like this are usually filled within 41 days.",
    );
    expect(
      verdictSummary({ kind: "first-time", daysOpen: 0, repostCount: 0 }),
    ).toBe("Posted today for the first time.");
    expect(
      verdictSummary({ kind: "reposted", daysOpen: 12, repostCount: 2 }),
    ).toBe("Posted 3 times; this listing has been up 12 days.");
    expect(
      verdictSummary({ kind: "evergreen", daysOpen: 120, repostCount: 4 }),
    ).toBe(
      "Up 120 days and posted 5 times, which usually means a standing opening rather than one seat.",
    );
    expect(
      verdictSummary({
        kind: "closing-soon",
        daysOpen: 38,
        repostCount: 0,
        typicalDays: 41,
      }),
    ).toBe(
      "Up 38 days, close to the 41 days roles like this usually stay open.",
    );
    expect(
      verdictSummary({ kind: "closing-soon", daysOpen: 38, repostCount: 0 }),
    ).toBe("Up 38 days, about as long as roles like this usually stay open.");
  });

  it("lists the verdict's facts", () => {
    expect(
      verdictFacts({ daysOpen: 12, repostCount: 0, typicalDays: 41 }),
    ).toEqual([
      { label: "Days open", value: "12 days" },
      { label: "Reposted", value: "Never" },
      { label: "Usually filled within", value: "41 days" },
    ]);
    expect(verdictFacts({ daysOpen: 1, repostCount: 2 })).toEqual([
      { label: "Days open", value: "1 day" },
      { label: "Reposted", value: "2×" },
    ]);
  });
});
