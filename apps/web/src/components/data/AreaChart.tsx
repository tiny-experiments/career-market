import { useId, useRef } from "react";
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
  readonly className?: string;
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/**
 * One series over time, filling the width it is given: three faint grid
 * lines, a soft fill under the line and month labels along the bottom. Drawn
 * by hand, no library.
 */
export function AreaChart({
  series,
  height = 220,
  label,
  className,
}: AreaChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box);
  const gradient = useId();
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
  let lastMonth = "";
  series.forEach((p, i) => {
    const month = MONTH.format(new Date(p.date));
    if (month !== lastMonth) {
      labels.push({ x: i * stepX, text: month });
      lastMonth = month;
    }
  });

  return (
    <div ref={box} className={cn("w-full", className)}>
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
          {[0.25, 0.5, 0.75].map((t) => (
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
        </svg>
      ) : (
        <div style={{ height }} />
      )}
    </div>
  );
}
