import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useChartScrub } from "@/hooks";
import { daysEndingOn, linePath, sparklinePoints } from "@/lib/charts";
import { direction, formatCount, type Direction } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./ChartTooltip";

export interface SparklineProps {
  readonly values: readonly number[];
  /** The ISO day of the last value; one value a day leads up to it. */
  readonly end?: string | null;
  readonly formatValue?: (value: number) => string;
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
}

const STROKE: Record<Direction, string> = {
  up: "stroke-up",
  down: "stroke-down",
  flat: "stroke-subtle",
};

const FILL: Record<Direction, string> = {
  up: "fill-up",
  down: "fill-down",
  flat: "fill-subtle",
};

/** Where the line sits inside its box: `sparklinePoints` keeps 2 px clear. */
const INSET = 2;
/** Keeps a reading near the window's edge from being cut off. */
const EDGE = 72;

/**
 * A 120×34 line coloured by where it ends against where it starts, small
 * enough for a table row: no axis, but hover or tap reads the day and its
 * figure. The number beside it carries the meaning for everyone else.
 */
export function Sparkline({
  values,
  end,
  formatValue = formatCount,
  width = 120,
  height = 34,
  className,
}: SparklineProps) {
  const points = sparklinePoints(values, width, height);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const tone = direction(first === 0 ? 0 : (last - first) / Math.abs(first));
  const { index, rect, handlers } = useChartScrub(
    points.length > 1 ? values.length : 0,
    { inset: INSET, releaseOnScroll: true },
  );
  const point = index === null ? undefined : points[index];
  const value = index === null ? undefined : values[index];
  const dates = end ? daysEndingOn(end, values.length) : [];

  // In a table the row's link lies over every cell; the line sits above it to
  // be read, so a click on it still opens the row.
  const onClick = (event: MouseEvent<HTMLSpanElement>) => {
    handlers.onClick(event);
    if (event.defaultPrevented || event.currentTarget.closest("a")) return;
    event.currentTarget
      .closest("tr")
      ?.querySelector<HTMLAnchorElement>("a[href]")
      ?.click();
  };

  return (
    <span
      {...handlers}
      onClick={onClick}
      data-chart="spark"
      className={cn(
        "relative inline-block shrink-0 touch-pan-y align-middle",
        className,
      )}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        data-direction={tone}
        className={cn("block overflow-visible", STROKE[tone])}
      >
        {points.length > 1 ? (
          <path
            d={linePath(points)}
            fill="none"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {point ? (
          <circle
            cx={point.x}
            cy={point.y}
            r={3}
            className={cn("stroke-card", FILL[tone])}
            strokeWidth={1.5}
          />
        ) : null}
      </svg>
      {point && rect && value !== undefined
        ? createPortal(
            <ChartTooltip
              date={dates[index ?? 0] ?? null}
              readings={[{ value: formatValue(value) }]}
              className="fixed -translate-x-1/2 -translate-y-full"
              style={{
                left: Math.min(
                  Math.max(rect.left + point.x, EDGE),
                  window.innerWidth - EDGE,
                ),
                top: rect.top - 6,
              }}
            />,
            document.body,
          )
        : null}
    </span>
  );
}
