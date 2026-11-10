import type { CSSProperties } from "react";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChartReading {
  readonly value: string;
  /** Names the figure when the chart draws more than one. */
  readonly label?: string;
  /** A `bg-*` class matching the mark the figure is drawn with. */
  readonly swatch?: string;
}

export interface ChartTooltipProps {
  /** The ISO day being read; left out when the chart does not know it. */
  readonly date?: string | null;
  readonly readings: readonly ChartReading[];
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Announced as it changes, for a chart the reader can tab to. */
  readonly live?: boolean;
}

/** What every chart shows under the pointer: the day, then its figures. */
export function ChartTooltip({
  date,
  readings,
  className,
  style,
  live = false,
}: ChartTooltipProps) {
  return (
    <div
      data-chart-tooltip=""
      {...(live ? { role: "status" } : { "aria-hidden": true })}
      className={cn(
        "pointer-events-none z-50 flex flex-col gap-0.5 rounded-lg bg-popover px-3 py-2 text-small whitespace-nowrap text-popover-foreground shadow-float",
        className,
      )}
      style={style}
    >
      {date ? (
        <span className="text-muted-foreground">{formatDay(date)}</span>
      ) : null}
      {readings.map((reading) => (
        <span
          key={reading.label ?? "value"}
          className="inline-flex items-center gap-1.5"
        >
          {reading.swatch ? (
            <span
              aria-hidden
              className={cn("size-2 rounded-sm", reading.swatch)}
            />
          ) : null}
          {reading.label ? (
            <span className="text-muted-foreground">{reading.label}</span>
          ) : null}
          <span className="font-semibold">{reading.value}</span>
        </span>
      ))}
    </div>
  );
}
