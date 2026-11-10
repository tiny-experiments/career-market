import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AreaChart, Sparkline } from "@/components/data";
import { FlowBars } from "@/components/market/FlowBars";

const WIDTH = 300;

// jsdom lays nothing out: give every box a width so the charts draw and a
// pointer's x maps to a day.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: WIDTH,
    bottom: 100,
    width: WIDTH,
    height: 100,
    toJSON: () => ({}),
  });
});
afterEach(() => vi.restoreAllMocks());

const SERIES = [
  { date: "2026-11-08", value: 1_200 },
  { date: "2026-11-09", value: 1_350 },
  { date: "2026-11-10", value: 1_500 },
];

const tooltip = () => document.querySelector("[data-chart-tooltip]");

describe("AreaChart", () => {
  it("labels its value grid with whole counts and its days along the bottom", () => {
    const { container } = render(
      <AreaChart series={SERIES} height={220} label="Open roles" />,
    );
    const labels = [...container.querySelectorAll("text")].map(
      (text) => text.textContent,
    );
    expect(labels).toEqual([
      "1,428",
      "1,332",
      "1,236",
      "8 Nov",
      "9 Nov",
      "10 Nov",
    ]);
  });

  it("reads the day and its figure under the pointer, and lets go on leaving", () => {
    render(<AreaChart series={SERIES} label="Open roles" />);
    const chart = screen.getByRole("group", { name: "Open roles" });
    fireEvent.pointerMove(chart, { clientX: WIDTH, pointerType: "mouse" });
    expect(tooltip()).toHaveTextContent("10 Nov 2026");
    expect(tooltip()).toHaveTextContent("1,500");
    fireEvent.pointerLeave(chart, { pointerType: "mouse" });
    expect(tooltip()).toBeNull();
  });

  it("keeps a tapped reading after the finger lifts, until a tap elsewhere", () => {
    render(<AreaChart series={SERIES} label="Open roles" />);
    const chart = screen.getByRole("group", { name: "Open roles" });
    fireEvent.pointerDown(chart, { clientX: 0, pointerType: "touch" });
    fireEvent.pointerLeave(chart, { pointerType: "touch" });
    expect(tooltip()).toHaveTextContent("8 Nov 2026");
    expect(tooltip()).toHaveTextContent("1,200");
    fireEvent.pointerDown(document.body);
    expect(tooltip()).toBeNull();
  });

  it("steps a day at a time with the arrow keys", () => {
    render(<AreaChart series={SERIES} label="Open roles" />);
    const chart = screen.getByRole("group", { name: "Open roles" });
    chart.focus();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent("1,500");
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent("9 Nov 2026");
    expect(screen.getByRole("status")).toHaveTextContent("1,350");
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Sparkline reading", () => {
  it("shows the day and figure under the pointer when it knows its last day", () => {
    const { container } = render(
      <Sparkline values={[10, 12, 15]} end="2026-11-10" />,
    );
    const line = container.querySelector("[data-chart]")!;
    fireEvent.pointerMove(line, { clientX: 0, pointerType: "mouse" });
    expect(tooltip()).toHaveTextContent("8 Nov 2026");
    expect(tooltip()).toHaveTextContent("10");
    fireEvent.pointerLeave(line, { pointerType: "mouse" });
    expect(tooltip()).toBeNull();
  });

  it("shows the figure alone when its days are unknown", () => {
    const { container } = render(<Sparkline values={[10, 12, 15]} />);
    const line = container.querySelector("[data-chart]")!;
    fireEvent.pointerMove(line, { clientX: WIDTH, pointerType: "mouse" });
    expect(tooltip()?.textContent).toBe("15");
  });

  it("is read by a tap instead of following the link it sits in", () => {
    const follow = vi.fn((event: Event) => event.preventDefault());
    const { container } = render(
      <a href="/companies/acme" onClick={(event) => follow(event.nativeEvent)}>
        <Sparkline values={[10, 12, 15]} end="2026-11-10" />
      </a>,
    );
    const line = container.querySelector("[data-chart]")!;
    fireEvent.pointerDown(line, { clientX: WIDTH, pointerType: "touch" });
    fireEvent.click(line);
    expect(follow).not.toHaveBeenCalled();
    expect(tooltip()).toHaveTextContent("15");
  });

  it("still opens its table row when clicked with a mouse", () => {
    const open = vi.fn((event: Event) => event.preventDefault());
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <td>
              <a
                href="/skills/python"
                onClick={(event) => open(event.nativeEvent)}
              >
                Python
              </a>
            </td>
            <td>
              <Sparkline values={[10, 12, 15]} end="2026-11-10" />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    const line = container.querySelector("[data-chart]")!;
    fireEvent.pointerDown(line, { clientX: 0, pointerType: "mouse" });
    fireEvent.click(line);
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe("FlowBars reading", () => {
  it("reads a day's opened and closed roles", () => {
    render(
      <FlowBars
        days={[
          { date: "2026-11-09", opened: 576, closed: 771 },
          { date: "2026-11-10", opened: 610, closed: 702 },
        ]}
      />,
    );
    const bars = screen.getByRole("group");
    fireEvent.pointerMove(bars, { clientX: WIDTH, pointerType: "mouse" });
    const reading = screen.getByRole("status");
    expect(reading).toHaveTextContent("10 Nov 2026");
    expect(reading).toHaveTextContent("Opened610");
    expect(reading).toHaveTextContent("Closed702");
  });
});
