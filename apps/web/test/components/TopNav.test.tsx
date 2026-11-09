import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopNav } from "@/components/layout";
import { renderWithRouter } from "../support/renderWithRouter";

describe("TopNav", () => {
  it("lists the five sections and marks the one the page is in", () => {
    renderWithRouter(<TopNav />, { path: "/companies/amazon" });
    const sections = screen.getAllByRole("navigation", {
      name: "Sections",
    })[0]!;
    const links = ["Market", "Professions", "Companies", "Skills", "Jobs"];
    for (const label of links) {
      expect(
        screen.getAllByRole("link", { name: label })[0],
      ).toBeInTheDocument();
    }
    expect(sections.querySelector('[aria-current="page"]')).toHaveTextContent(
      "Companies",
    );
  });

  it("does not light the Market section on other pages", () => {
    renderWithRouter(<TopNav />, { path: "/skills" });
    const sections = screen.getAllByRole("navigation", {
      name: "Sections",
    })[0]!;
    expect(sections.querySelector('[aria-current="page"]')).toHaveTextContent(
      "Skills",
    );
  });
});
