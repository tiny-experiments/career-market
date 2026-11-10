import { useId, useRef } from "react";
import { useChartScrub, useElementWidth } from "@/hooks";
import { linePath } from "@/lib/charts";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./ChartTooltip";

export interface AreaPoint {
  /** An ISO date, used for the axis labels. */
  readonly date: string;
  readonly value: number;
}

export interface AreaChartProps {
  readonly series: readonly AreaPoint[];
  readonly height?: number;
  readonly label: string;
  /** Formats a value on the grid and in the reading; whole counts by default. */
  readonly formatValue?: (value: number) => string;
  readonly className?: string;
}

const MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Under two months a month label says nothing: day labels instead. */
const DAY_AXIS_POINTS = 62;
const DAY_AXIS_LABELS = 6;
const GRID_LINES = [0.25, 0.5, 0.75];
/** A short chart keeps two labelled lines so their values never touch. */
const SHORT_GRID_LINES = [0.25, 0.75];
const SHORT_PLOT = 90;
/** Room a date label needs before the right edge; nearer, it ends at the edge. */
const LABEL_ROOM = 44;
/** Width given to each day label, so a narrow chart shows fewer of them. */
const DAY_LABEL_WIDTH = 72;
/** Clear space kept between two date labels. */
const LABEL_GAP = 8;
/** A date label's rough width per character, at the eyebrow size. */
const LABEL_CHAR = 6.5;

/**
 * One series over time, filling the width it is given: faint grid
 * lines labelled with their values, a soft fill under the line and dates
 * along the bottom. Hover, tap or arrow keys read a day's figure. Drawn by
 * hand, no library.
 */
export function AreaChart({
  series,
  height = 220,
  label,
  formatValue = formatCount,
  className,
}: AreaChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box);
  const gradient = useId();
  const { index: hover, handlers, keys } = useChartScrub(series.length);
  const padBottom = 22;
  const padTop = 8;
  const innerH = height - padBottom - padTop;
  const grid = innerH < SHORT_PLOT ? SHORT_GRID_LINES : GRID_LINES;

  // The axis hugs the series: a market line is read for its shape, not from zero.
  const values = series.map((p) => p.value);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const range = high - low || Math.max(Math.abs(high), 1);
  const min = low - range * 0.2;
  const max = high + range * 0.08;
  const span = max - min || 1;
  const stepX = series.length > 1 ? width / (series.length - 1) : 0;
  const points = series.map((p, i) => ({
    x: i * stepX,
    y: padTop + innerH * (1 - (p.value - min) / span),
  }));
  const area =
    points.length > 1
      ? `${linePath(points)} L${width} ${padTop + innerH} L0 ${padTop + innerH} Z`
      : "";

  const candidates: { x: number; text: string }[] = [];
  if (series.length <= DAY_AXIS_POINTS) {
    const room = Math.max(2, Math.floor(width / DAY_LABEL_WIDTH));
    const every = Math.max(
      1,
      Math.ceil(series.length / Math.min(DAY_AXIS_LABELS, room)),
    );
    series.forEach((p, i) => {
      if (i % every === 0) {
        candidates.push({
          x: i * stepX,
          text: DAY.format(new Date(p.date)),
        });
      }
    });
  } else {
    let lastMonth = "";
    series.forEach((p, i) => {
      const month = MONTH.format(new Date(p.date));
      if (month !== lastMonth) {
        candidates.push({ x: i * stepX, text: month });
        lastMonth = month;
      }
    });
  }

  // A label near the right edge ends there; one that would touch the label
  // before it is left out.
  const labels: { x: number; text: string; end: boolean }[] = [];
  let taken = -Infinity;
  for (const item of candidates) {
    const end = item.x > width - LABEL_ROOM;
    const size = item.text.length * LABEL_CHAR;
    const start = end ? width - size : item.x;
    if (start < taken + LABEL_GAP) continue;
    labels.push({ x: end ? width : item.x, text: item.text, end });
    taken = start + size;
  }

  const hovered = hover === null ? undefined : series[hover];
  const hoveredPoint = hover === null ? undefined : points[hover];

  return (
    <div
      {...handlers}
      {...keys}
      ref={(element) => {
        box.current = element;
        handlers.ref(element);
      }}
      data-chart="area"
      role="group"
      aria-label={label}
      tabIndex={series.length > 1 ? 0 : undefined}
      className={cn(
        "relative w-full touch-pan-y rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card",
        className,
      )}
    >
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          className="block overflow-visible"
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                className="[stop-color:var(--primary)]"
                stopOpacity={0.3}
              />
              <stop
                offset="1"
                className="[stop-color:var(--primary)]"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          {grid.map((t) => (
            <line
              key={t}
              x1={0}
              x2={width}
              y1={padTop + innerH * t}
              y2={padTop + innerH * t}
              className="stroke-border"
              strokeWidth={1}
            />
          ))}
          {grid.map((t) => (
            <text
              key={t}
              x={0}
              y={padTop + innerH * t - 4}
              className="fill-muted-foreground text-eyebrow"
            >
              {formatValue(max - span * t)}
            </text>
          ))}
          {area ? <path d={area} fill={`url(#${gradient})`} /> : null}
          {points.length > 1 ? (
            <path
              d={linePath(points)}
              fill="none"
              className="stroke-primary"
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
          ) : null}
          {labels.map((item) => (
            <text
              key={item.x}
              x={item.x}
              y={height - 4}
              textAnchor={item.end ? "end" : "start"}
              className="fill-muted-foreground text-eyebrow"
            >
              {item.text}
            </text>
          ))}
          {hoveredPoint ? (
            <>
              <line
                x1={hoveredPoint.x}
                x2={hoveredPoint.x}
                y1={padTop}
                y2={padTop + innerH}
                className="stroke-muted-foreground"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r={4}
                className="fill-primary stroke-card"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hovered && hoveredPoint ? (
        <ChartTooltip
          live
          date={hovered.date}
          readings={[{ value: formatValue(hovered.value) }]}
          className={cn(
            "absolute top-0",
            hoveredPoint.x > width / 2 ? "-ml-3 -translate-x-full" : "ml-3",
          )}
          style={{ left: hoveredPoint.x }}
        />
      ) : null}
    </div>
  );
}
