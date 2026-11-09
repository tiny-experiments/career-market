import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { formatCount } from "@/lib/format";
import { MARKET_COPY, METRICS } from "@/content";

export interface FlowDay {
  readonly date: string;
  readonly opened: number;
  readonly closed: number;
}

/** Pairs of bars, one day to a pair: how many roles opened against how many closed. */
export function FlowBars({ days }: { readonly days: readonly FlowDay[] }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.opened, d.closed]));

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
      <div className="flex h-10 items-end gap-2" aria-hidden>
        {days.map((day) => (
          <div
            key={day.date}
            title={`${formatCount(day.opened)} opened, ${formatCount(day.closed)} closed`}
            className="flex h-full flex-1 items-end justify-center gap-px"
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
      </div>
    </div>
  );
}
