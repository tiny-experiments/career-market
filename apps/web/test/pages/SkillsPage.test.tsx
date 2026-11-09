import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearResources } from "@/lib/api";
import { SkillsPage } from "@/pages/SkillsPage";
import { skillRow } from "../support/directoryFixtures";
import { stubFetch } from "../support/fetchStub";
import { renderWithRouter } from "../support/renderWithRouter";

const skills = [
  skillRow(),
  skillRow({
    id: "ml:pytorch",
    slug: "pytorch",
    label: "PyTorch",
    open: 8208,
    pay: { roles: 900, low: 170000, median: 209000, high: 250000 },
    remoteShare: 0.27,
  }),
  skillRow({
    id: "lang:c",
    slug: "c",
    label: "C",
    open: 16037,
    pay: null,
    change: null,
    topPair: null,
  }),
];

function tableNames(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("link")
    .map((link) => link.getAttribute("aria-label") ?? "");
}

describe("SkillsPage", () => {
  beforeEach(() => {
    clearResources();
    stubFetch({ "/api/skills": { body: { asOf: "2026-11-09", skills } } });
  });

  it("links the whole row to the skill", async () => {
    renderWithRouter(<SkillsPage />, { path: "/skills" });
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: "Python" })).toHaveAttribute(
      "href",
      "/skills/python",
    );
  });

  it("orders the highest paid tab by pay and drops skills with none", async () => {
    renderWithRouter(<SkillsPage />, { path: "/skills?view=best-paid" });
    await screen.findByRole("table");
    expect(tableNames()).toEqual(["PyTorch", "Python"]);
  });

  it("narrows by name from the address", async () => {
    renderWithRouter(<SkillsPage />, { path: "/skills?q=pyt" });
    await screen.findByRole("table");
    expect(tableNames()).toEqual(["Python", "PyTorch"]);
  });

  it("says so when nothing matches", async () => {
    renderWithRouter(<SkillsPage />, { path: "/skills?q=zzz" });
    expect(await screen.findByText("No skills match")).toBeInTheDocument();
  });
});
