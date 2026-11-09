import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ABOUT } from "@/content";
import { AboutPage } from "@/pages/AboutPage";
import { renderWithRouter } from "../support/renderWithRouter";

describe("AboutPage", () => {
  it("shows the two sentences and nothing about the method", () => {
    const { container } = renderWithRouter(<AboutPage />, { path: "/about" });
    expect(
      screen.getByRole("heading", { name: ABOUT.title }),
    ).toBeInTheDocument();
    for (const sentence of ABOUT.sentences) {
      expect(screen.getByText(sentence)).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(
      /krill|night|method|how we count|\d/i,
    );
  });
});
