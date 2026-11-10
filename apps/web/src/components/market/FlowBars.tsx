import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { ChartTooltip } from "@/components/data/ChartTooltip";
import { useChartScrub } from "@/hooks";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MARKET_COPY, METRICS } from "@/content";

export interface FlowDay {
  readonly date: string;
  readonly opened: number;
  readonly closed: number;
}

/**
 * Pairs of bars, one day to a pair: how many roles opened against how many
 * closed. Hover, tap or arrow keys read a day's two figures.
 */
export function FlowBars({ days }: { readonly days: readonly FlowDay[] }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.opened, d.closed]));
  const { index, handlers, keys } = useChartScrub(days.length);
  const read = index === null ? undefined : days[index];

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-tile px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-eyebrow font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {METRICS.dailyFlow.title}
          <MetricHoverCard title={METRICS.dailyFlow.title}>
            {METRICS.dailyFlow.text}
          </MetricHoverCard>
        </span>
        <span className="inline-flex items-center gap-3 font-medium">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-sm bg-up" />
            {MARKET_COPY.opened}
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-sm bg-down" />
            {MARKET_COPY.closed}
          </span>
        </span>
      </div>
      <div
        {...handlers}
        {...keys}
        data-chart="flow"
        role="group"
        aria-label={METRICS.dailyFlow.title}
        tabIndex={0}
        className="relative flex h-10 touch-pan-y items-end gap-2 rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-tile"
      >
        {days.map((day, at) => (
          <div
            key={day.date}
            aria-hidden
            className={cn(
              "flex h-full flex-1 items-end justify-center gap-px transition-opacity",
              index !== null && at !== index && "opacity-40",
            )}
          >
            <span
              className="w-full rounded-t-sm bg-up"
              style={{ height: `${Math.max((day.opened / max) * 100, 4)}%` }}
            />
            <span
              className="w-full rounded-t-sm bg-down"
              style={{ height: `${Math.max((day.closed / max) * 100, 4)}%` }}
            />
          </div>
        ))}
        {read && index !== null ? (
          <ChartTooltip
            live
            date={read.date}
            readings={[
              {
                label: MARKET_COPY.opened,
                value: formatCount(read.opened),
                swatch: "bg-up",
              },
              {
                label: MARKET_COPY.closed,
                value: formatCount(read.closed),
                swatch: "bg-down",
              },
            ]}
            className={cn(
              "absolute bottom-full mb-2",
              index >= days.length / 2 && "-translate-x-full",
            )}
            style={{
              left: `${((index + (index >= days.length / 2 ? 0 : 1)) / days.length) * 100}%`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
