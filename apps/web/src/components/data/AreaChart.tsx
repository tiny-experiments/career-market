import { useId, useRef, useState } from "react";
import { useElementWidth } from "@/hooks";
import { linePath } from "@/lib/charts";
import { cn } from "@/lib/utils";

export interface AreaPoint {
  /** An ISO date, used for the axis labels. */
  readonly date: string;
  readonly value: number;
}

export interface AreaChartProps {
  readonly series: readonly AreaPoint[];
  readonly height?: number;
  readonly label: string;
  /** Formats a value; given one, the chart labels its grid and follows the pointer. */
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
const FULL_DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Under two months a month label says nothing: day labels instead. */
const DAY_AXIS_POINTS = 62;
const DAY_AXIS_LABELS = 6;
const GRID_LINES = [0.25, 0.5, 0.75];

/**
 * One series over time, filling the width it is given: three faint grid
 * lines, a soft fill under the line and month labels along the bottom. Drawn
 * by hand, no library.
 */
export function AreaChart({
  series,
  height = 220,
  label,
  formatValue,
  className,
}: AreaChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box);
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const padBottom = 22;
  const padTop = 8;
  const innerH = height - padBottom - padTop;

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

  const labels: { x: number; text: string }[] = [];
  if (series.length <= DAY_AXIS_POINTS) {
    const every = Math.max(1, Math.ceil(series.length / DAY_AXIS_LABELS));
    series.forEach((p, i) => {
      if (i % every === 0) {
        labels.push({ x: i * stepX, text: DAY.format(new Date(p.date)) });
      }
    });
  } else {
    let lastMonth = "";
    series.forEach((p, i) => {
      const month = MONTH.format(new Date(p.date));
      if (month !== lastMonth) {
        labels.push({ x: i * stepX, text: month });
        lastMonth = month;
      }
    });
  }

  const hovered = hover === null ? undefined : series[hover];
  const hoveredPoint = hover === null ? undefined : points[hover];

  return (
    <div
      ref={box}
      className={cn("relative w-full", className)}
      onPointerLeave={() => setHover(null)}
      onPointerMove={
        formatValue && stepX > 0
          ? (event) => {
              const left = event.currentTarget.getBoundingClientRect().left;
              const index = Math.round((event.clientX - left) / stepX);
              setHover(Math.min(Math.max(index, 0), series.length - 1));
            }
          : undefined
      }
    >
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={label}
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
          {GRID_LINES.map((t) => (
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
          {formatValue
            ? GRID_LINES.map((t) => (
                <text
                  key={t}
                  x={0}
                  y={padTop + innerH * t - 4}
                  className="fill-muted-foreground text-eyebrow"
                >
                  {formatValue(max - span * t)}
                </text>
              ))
            : null}
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
              x={Math.min(item.x, width - 24)}
              y={height - 4}
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
      {hovered && hoveredPoint && formatValue ? (
        <div
          role="status"
          className={cn(
            "pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 rounded-lg bg-popover px-3 py-2 text-small shadow-float",
            hoveredPoint.x > width / 2 ? "-translate-x-full -ml-3" : "ml-3",
          )}
          style={{ left: hoveredPoint.x }}
        >
          <span className="text-muted-foreground">
            {FULL_DAY.format(new Date(hovered.date))}
          </span>
          <span className="font-semibold">{formatValue(hovered.value)}</span>
        </div>
      ) : null}
    </div>
  );
}
