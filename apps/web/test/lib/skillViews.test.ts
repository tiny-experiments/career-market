import { describe, expect, it } from "vitest";
import {
  filterSkills,
  naturalSkillDirection,
  skillViewFrom,
  sortSkills,
  viewSort,
} from "@/lib/skillViews";
import { skillRow } from "../support/directoryFixtures";

const a = skillRow({ id: "a", label: "Alpha", open: 10, remoteShare: 0.5 });
const b = skillRow({ id: "b", label: "beta", open: 30, remoteShare: null });
const c = skillRow({ id: "c", label: "Gamma", open: 20, remoteShare: 0.1 });

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe("skill views", () => {
  it("reads the tab from the address and falls back to all", () => {
    expect(skillViewFrom(new URLSearchParams("view=remote"))).toBe("remote");
    expect(skillViewFrom(new URLSearchParams("view=nonsense"))).toBe("all");
    expect(viewSort("growing")).toEqual({
      key: "change30d",
      direction: "desc",
    });
  });

  it("puts a skill with no figure last in either direction", () => {
    expect(ids(sortSkills([a, b, c], "remote", "desc"))).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(ids(sortSkills([a, b, c], "remote", "asc"))).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("sorts names without regard to case, ascending by nature", () => {
    expect(ids(sortSkills([c, b, a], "label", "asc"))).toEqual(["a", "b", "c"]);
    expect(naturalSkillDirection("label")).toBe("asc");
    expect(naturalSkillDirection("open")).toBe("desc");
  });

  it("filters on any part of the name", () => {
    expect(ids(filterSkills([a, b, c], " MM "))).toEqual(["c"]);
    expect(filterSkills([a, b], "")).toHaveLength(2);
  });
});
