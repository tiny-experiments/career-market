import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Delta } from "@/components/data";

describe("Delta", () => {
  it("reads an increase as a caret, the number and the comparison in words", () => {
    render(<Delta value={0.037} suffix="this week" />);
    const delta = screen.getByText("▲ 3.7% this week");
    expect(delta).toHaveAttribute("data-direction", "up");
    expect(delta).toHaveClass("text-up");
    expect(delta).toHaveAccessibleName("Up 3.7% this week");
  });

  it("reads a fall in red with a down caret", () => {
    render(<Delta value={-0.049} />);
    const delta = screen.getByText("▼ 4.9%");
    expect(delta).toHaveAttribute("data-direction", "down");
    expect(delta).toHaveClass("text-down");
  });

  it("shows no caret when nothing moved", () => {
    render(<Delta value={0} />);
    const delta = screen.getByText("0.0%");
    expect(delta).toHaveAttribute("data-direction", "flat");
    expect(delta).toHaveClass("text-subtle");
  });

  it("can be a soft pill", () => {
    render(<Delta value={0.013} suffix="this week" variant="pill" />);
    const pill = screen.getByText("▲ 1.3% this week");
    expect(pill).toHaveAttribute("data-slot", "badge");
    expect(pill).toHaveAttribute("data-variant", "up");
  });
});
