import { describe, expect, it } from "vitest";
import { EMPTY, ERROR, couldNotLoad, nothingFound } from "@/content";

describe("state copy", () => {
  it("tells the reader what to do when there is nothing to show", () => {
    for (const [key, state] of Object.entries(EMPTY)) {
      expect(state.title, key).toBeTruthy();
      expect(state.description, key).toMatch(/\.$/);
      expect(state.title, key).not.toMatch(/\.$/);
    }
    expect(EMPTY.jobs.description).toMatch(/^Try /);
  });

  it("says what broke and never an API code", () => {
    for (const [key, state] of Object.entries(ERROR)) {
      expect(state.title, key).toMatch(/could not be loaded\.|went wrong/);
      expect(`${state.title} ${state.description}`, key).not.toMatch(
        /\b(?:4\d\d|5\d\d|ECONN|timeout|fetch|API|null|undefined)\b/,
      );
    }
    expect(couldNotLoad("Companies").title).toBe(
      "Companies could not be loaded.",
    );
  });

  it("quotes the search that found nothing", () => {
    expect(nothingFound(" rust ").title).toBe("Nothing found for “rust”");
  });
});
