import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TickerStrip } from "@/components/layout";
import { renderWithRouter } from "../support/renderWithRouter";

describe("TickerStrip", () => {
  it("reads each figure once and repeats the row only for the eye", () => {
    renderWithRouter(
      <TickerStrip
        items={[
          { label: "Open roles", value: "262,845", change: 0.013, to: "/" },
          { label: "Remote share", value: "27%" },
        ]}
      />,
    );
    const lists = document.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    expect(lists[1]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByText("262,845")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Open roles\s*262,845/ }),
    ).toHaveAttribute("href", "/");
  });

  it("draws nothing without figures", () => {
    const { container } = renderWithRouter(<TickerStrip items={[]} />);
    expect(container.querySelector(".ticker-strip")).toBeNull();
  });
});
