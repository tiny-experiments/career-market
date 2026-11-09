import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubBar } from "@/components/layout";
import { PROFESSIONS_TABS } from "@/lib/nav";
import { renderWithRouter } from "../support/renderWithRouter";

describe("SubBar", () => {
  it("marks the tab that matches the URL, query included", () => {
    renderWithRouter(<SubBar tabs={PROFESSIONS_TABS} />, {
      path: "/professions?view=gaining",
    });
    expect(screen.getByRole("link", { name: "Gaining" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Gaining" })).toHaveAttribute(
      "href",
      "/professions?view=gaining",
    );
  });

  it("draws one underline indicator for the row", () => {
    renderWithRouter(<SubBar tabs={PROFESSIONS_TABS} />, {
      path: "/professions",
    });
    expect(
      document.querySelectorAll('[data-slot="underline-indicator"]'),
    ).toHaveLength(1);
  });
});
