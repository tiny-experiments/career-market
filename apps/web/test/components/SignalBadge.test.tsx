import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalBadge } from "@/components/data";

describe("SignalBadge", () => {
  it("says the signal as a word in its colour", () => {
    render(
      <>
        <SignalBadge signal="ramping" />
        <SignalBadge signal="steady" />
        <SignalBadge signal="cooling" />
        <SignalBadge signal="freezing" />
      </>,
    );
    expect(screen.getByText("Ramping")).toHaveAttribute("data-variant", "up");
    expect(screen.getByText("Steady")).toHaveAttribute("data-variant", "flat");
    expect(screen.getByText("Cooling")).toHaveAttribute("data-variant", "warn");
    expect(screen.getByText("Freezing")).toHaveAttribute(
      "data-variant",
      "down",
    );
  });
});
