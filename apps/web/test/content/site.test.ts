import { describe, expect, it } from "vitest";
import {
  ABOUT,
  FOOTER_LINE,
  PAGES,
  companyPage,
  documentTitle,
  jobPage,
  professionPage,
  skillPage,
} from "@/content";

describe("site copy", () => {
  it("carries the approved footer line", () => {
    expect(FOOTER_LINE).toBe(
      "Open roles from 48,000+ company career pages, updated through the day.",
    );
  });

  it("says About in two short sentences", () => {
    expect(ABOUT.sentences).toHaveLength(2);
    for (const sentence of ABOUT.sentences) {
      expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(30);
      expect(sentence).toMatch(/\.$/);
    }
    expect(ABOUT.sentences.join(" ")).not.toMatch(
      /\d|night|method|count|gather|collect|crawl|read/i,
    );
  });

  it("builds the browser title from the page and the site", () => {
    expect(documentTitle("Software Engineering")).toBe(
      "Software Engineering · Career Market",
    );
    expect(documentTitle()).toBe("Career Market");
    expect(documentTitle("  ")).toBe("Career Market");
  });

  it("gives every page a title, a line and a meta description", () => {
    for (const page of Object.values(PAGES)) {
      expect(page.title).toBeTruthy();
      expect(page.description.length).toBeGreaterThan(20);
      expect(page.meta.length).toBeGreaterThan(40);
      expect(page.meta.length).toBeLessThanOrEqual(160);
    }
  });

  it("names the thing on a detail page", () => {
    expect(professionPage("Software Engineering").title).toBe(
      "Software Engineering",
    );
    expect(companyPage("Stripe").meta).toContain("Stripe");
    expect(skillPage("Python").description).toContain("Python");
    expect(jobPage("Staff Engineer", "Stripe").title).toBe(
      "Staff Engineer at Stripe",
    );
  });
});
