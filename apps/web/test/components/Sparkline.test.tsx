import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "@/components/data";

describe("Sparkline", () => {
  it("is coloured by where the line ends against where it starts", () => {
    const { container: rising } = render(
      <Sparkline values={[10, 12, 11, 15]} />,
    );
    expect(rising.querySelector("svg")).toHaveAttribute("data-direction", "up");
    expect(rising.querySelector("svg")).toHaveClass("stroke-up");

    const { container: falling } = render(
      <Sparkline values={[15, 14, 12, 10]} />,
    );
    expect(falling.querySelector("svg")).toHaveAttribute(
      "data-direction",
      "down",
    );
    expect(falling.querySelector("svg")).toHaveClass("stroke-down");
  });

  it("draws the estimated start dashed and the rest solid", () => {
    const { container } = render(
      <Sparkline values={[10, 11, 12, 13, 14, 15]} estimatedUntil={3} />,
    );
    const estimated = container.querySelector('path[data-segment="estimated"]');
    const actual = container.querySelector('path[data-segment="actual"]');
    expect(estimated).toHaveAttribute("stroke-dasharray", "3 3");
    expect(actual).not.toHaveAttribute("stroke-dasharray");
  });

  it("is decorative: the number beside it carries the meaning", () => {
    const { container } = render(<Sparkline values={[1, 2]} />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
