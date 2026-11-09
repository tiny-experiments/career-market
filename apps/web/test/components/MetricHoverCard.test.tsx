import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MetricHoverCard } from "@/components/common";

describe("MetricHoverCard", () => {
  it("names its trigger after the figure", () => {
    render(
      <MetricHoverCard title="7-day change">
        Change in open roles compared with a week ago.
      </MetricHoverCard>,
    );
    expect(
      screen.getByRole("button", { name: "About 7-day change" }),
    ).toBeInTheDocument();
  });

  it("opens on keyboard focus with the title, one sentence and the formula", async () => {
    const user = userEvent.setup();
    render(
      <MetricHoverCard
        title="7-day change"
        formula="open roles now ÷ a week ago − 1"
      >
        Change in open roles compared with a week ago.
      </MetricHoverCard>,
    );
    await user.tab();
    expect(
      await screen.findByText("Change in open roles compared with a week ago."),
    ).toBeVisible();
    expect(
      screen.getByText("open roles now ÷ a week ago − 1"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "About 7-day change" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
