import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Gauge } from "@/components/data";

const arcs = (container: HTMLElement) =>
  [...container.querySelectorAll("path")].map(
    (path) => path.getAttribute("d") ?? "",
  );

describe("Gauge", () => {
  it("fills a half ring to the value without passing half a turn", () => {
    const { container } = render(<Gauge value={0.68} tone="up" />);
    const [track, fill] = arcs(container);
    expect(track).toMatch(/A51 51 0 0 1 110 60$/);
    expect(fill).toMatch(/^M8 60 A51 51 0 0 1 /);
    expect(container.querySelector("path:nth-of-type(2)")).toHaveClass(
      "stroke-up",
    );
  });

  it("draws only the track at zero and clamps above one", () => {
    const { container: empty } = render(<Gauge value={0} />);
    expect(arcs(empty)).toHaveLength(1);
    const { container: full } = render(<Gauge value={1.4} tone="down" />);
    const [, fill] = arcs(full);
    expect(fill).toMatch(/A51 51 0 0 1 110.00 60.00$/);
  });
});
