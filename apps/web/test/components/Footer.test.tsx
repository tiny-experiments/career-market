import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout";
import { FOOTER_LINE } from "@/content";
import { renderWithRouter } from "../support/renderWithRouter";

describe("Footer", () => {
  it("carries the approved line and nothing about where the data comes from", () => {
    const { container } = renderWithRouter(<Footer />);
    expect(screen.getByText(FOOTER_LINE)).toBeInTheDocument();
    expect(FOOTER_LINE).toBe(
      "Open roles from 48,000+ company career pages, updated through the day.",
    );
    expect(container.textContent).not.toMatch(/krill|updated \d{2}:\d{2}/i);
  });
});
