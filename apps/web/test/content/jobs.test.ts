import { describe, expect, it } from "vitest";
import { verdictDetail, verdictHeadline, type JobVerdict } from "@/content";

const typical = { scope: "Software", medianDays: 34, p25Days: 12, p75Days: 60 };
const verdict = (over: Partial<JobVerdict>): JobVerdict => ({
  kind: "first-time",
  repostCount: 0,
  ageDays: 5,
  openedSource: "posted",
  typical,
  ...over,
});

describe("the verdict in words", () => {
  it("leads with what the posting is", () => {
    expect(verdictHeadline(verdict({}))).toBe("First time posted · 5 days ago");
    expect(
      verdictHeadline(
        verdict({ kind: "reposted", repostCount: 1, ageDays: 30 }),
      ),
    ).toBe("Reposted once · 30 days open");
    expect(
      verdictHeadline(
        verdict({ kind: "evergreen", repostCount: 3, ageDays: 71 }),
      ),
    ).toBe("Likely evergreen · reposted 3 times · 71 days open");
    expect(
      verdictHeadline(verdict({ kind: "closing-soon", ageDays: 70 })),
    ).toBe("Closing soon · 70 days open");
  });

  it("compares with roles like it only when it can", () => {
    expect(verdictDetail(verdict({}))).toBe(
      "Not reposted. Roles like this are usually filled within 34 days, so this one is early in its window.",
    );
    expect(verdictDetail(verdict({ ageDays: 40 }))).toBe(
      "Not reposted. Roles like this are usually filled within 34 days.",
    );
    expect(verdictDetail(verdict({ typical: null }))).toBe(
      "Not reposted so far.",
    );
  });

  it.each(["first-time", "reposted", "evergreen", "closing-soon"] as const)(
    "never says how %s is worked out",
    (kind) => {
      const text = verdictDetail(verdict({ kind, repostCount: 2 }));
      expect(text).not.toMatch(/krill|sample|median|percentile|estimated/i);
    },
  );
});
