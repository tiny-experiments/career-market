import { describe, expect, it } from "vitest";
import {
  breakInlineBullets,
  breakNumberedLists,
  lostBullets,
  parseJobText,
  splitLong,
} from "@/lib/jobText";

const words = (text: string) => text.replace(/[\s:]+/g, " ").trim();
const rebuilt = (blocks: ReturnType<typeof parseJobText>) =>
  blocks
    .map((block) =>
      block.type === "list" ? block.items.join(" ") : block.text,
    )
    .join(" ");

describe("parseJobText", () => {
  it("turns section labels in one long run into headings, and keeps every word", () => {
    const text =
      "Join the team. You will build things. Responsibilities: Develop models. Advance research. Minimum qualifications: A degree. Preferred qualifications: Experience.";
    const blocks = parseJobText(text);
    expect(
      blocks.flatMap((block) => (block.type === "heading" ? [block.text] : [])),
    ).toEqual([
      "Responsibilities",
      "Minimum qualifications",
      "Preferred qualifications",
    ]);
    expect(words(rebuilt(blocks))).toBe(words(text));
  });

  it("keeps the paragraphs and lists the employer's text has", () => {
    expect(
      parseJobText(
        "About the role\nWe build speech models.\n\nSecond paragraph here.\n\nWhat you'll do:\n- Train models\n- Ship them",
      ),
    ).toEqual([
      { type: "heading", text: "About the role" },
      { type: "paragraph", text: "We build speech models." },
      { type: "paragraph", text: "Second paragraph here." },
      { type: "heading", text: "What you'll do" },
      { type: "list", items: ["Train models", "Ship them"] },
    ]);
  });

  it("puts a list back together when its line breaks are gone", () => {
    const text =
      "You'll own major parts of it: Agents that source, vet and staff with minimal human input Pay and incentives models that hire and retain the best experts Experiments and workflows that keep huge projects running smoothly Who We're Looking For We want engineers with 5+ years of experience.";
    const blocks = parseJobText(text);
    expect(blocks).toEqual([
      { type: "paragraph", text: "You'll own major parts of it:" },
      {
        type: "list",
        items: [
          "Agents that source, vet and staff with minimal human input",
          "Pay and incentives models that hire and retain the best experts",
          "Experiments and workflows that keep huge projects running smoothly",
        ],
      },
      { type: "heading", text: "Who We're Looking For" },
      {
        type: "paragraph",
        text: "We want engineers with 5+ years of experience.",
      },
    ]);
  });

  it("does not treat a label word inside a sentence as a heading", () => {
    const blocks = parseJobText(
      "Our benefits: are good. Please review the requirements for this role carefully. Join our Benefits Team today.",
    );
    expect(blocks.some((block) => block.type === "heading")).toBe(false);
  });

  it("does not cut a heading out of a longer phrase", () => {
    const blocks = parseJobText("Rewards. Benefits and Growth: Good ones.");
    expect(blocks.some((block) => block.type === "heading")).toBe(false);
  });

  it("returns nothing for empty text, and markup stays plain text", () => {
    expect(parseJobText("  \n ")).toEqual([]);
    expect(parseJobText("<script>alert(1)</script>")).toEqual([
      { type: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("lostBullets", () => {
  it("finds the items in a run", () => {
    expect(
      lostBullets(
        "Strong Python skills across services Deep automation experience in teams Clear written notes for everyone",
      ),
    ).toEqual([
      "Strong Python skills across services",
      "Deep automation experience in teams",
      "Clear written notes for everyone",
    ]);
  });

  it("leaves ordinary sentences alone", () => {
    expect(
      lostBullets(
        "we work with Google Cloud and strong Python teams across London and Berlin every day",
      ),
    ).toBeNull();
  });

  it("wants at least three real items", () => {
    expect(
      lostBullets("one long item here Another long item there"),
    ).toBeNull();
    expect(lostBullets("short word Ab cd ef gh Ij kl mn")).toBeNull();
  });

  it("never breaks inside brackets", () => {
    expect(
      lostBullets(
        "Experience with AQL (Acceptable Quality Limit) sampling methods Familiarity with Lean process improvement Comfort with statistical process control",
      ),
    ).toEqual([
      "Experience with AQL (Acceptable Quality Limit) sampling methods",
      "Familiarity with Lean process improvement",
      "Comfort with statistical process control",
    ]);
  });
});

describe("breakNumberedLists", () => {
  it("gives each counted item its own line, restarting for a new list", () => {
    expect(
      breakNumberedLists(
        "Do: 1. Build it. 2. Ship it. Have: 1. Skill one. 2. Skill two.",
      ),
    ).toBe(
      "Do:\n1. Build it.\n2. Ship it. Have:\n1. Skill one.\n2. Skill two.",
    );
  });

  it("ignores numbers that do not count up from one", () => {
    const text = "We grew by 2. Then by 5. Version 3. Done";
    expect(breakNumberedLists(text)).toBe(text);
  });
});

describe("breakInlineBullets", () => {
  it("restores a dashed list, and keeps its section heading whole", () => {
    expect(
      parseJobText(
        "Minimum Qualifications: - 3+ years building systems - Experience with Go - Clear written notes",
      ),
    ).toEqual([
      { type: "heading", text: "Minimum Qualifications" },
      {
        type: "list",
        items: [
          "3+ years building systems",
          "Experience with Go",
          "Clear written notes",
        ],
      },
    ]);
  });

  it("leaves a lone dash in a sentence alone", () => {
    const text = "Remote - Canada is fine. Hybrid - London also works.";
    expect(breakInlineBullets(text)).toBe(text);
  });
});

describe("splitLong", () => {
  it("keeps short text whole and cuts long text at sentence ends", () => {
    expect(splitLong("One. Two.")).toEqual(["One. Two."]);
    const long = Array.from(
      { length: 40 },
      (_, i) => `Sentence number ${i} is here.`,
    ).join(" ");
    const parts = splitLong(long, 200);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.join(" ")).toBe(long);
  });
});
