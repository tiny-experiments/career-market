import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { AreaChart } from "@/components/data/AreaChart";
import { Delta } from "@/components/data/Delta";
import { changeSuffix, MARKET_COPY, METRICS } from "@/content";
import type { MarketOverview } from "@/lib/api";
import { formatCount } from "@/lib/format";

const TREND_DAYS = 30;

/**
 * The headline of the market: how many tech roles are open, how that moved
 * this week, and the line of the last 30 days under it.
 */
export function HiringIndexPanel({
  market,
}: {
  readonly market: MarketOverview;
}) {
  const trend = market.series
    .slice(-TREND_DAYS)
    .map((point) => ({ date: point.date, value: point.open }));

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-tile px-3 py-3">
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 text-eyebrow font-semibold text-muted-foreground">
          {MARKET_COPY.hiringIndex}
          <MetricHoverCard title={METRICS.hiringIndex.title}>
            {METRICS.hiringIndex.text}
          </MetricHoverCard>
        </span>
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-h1 font-extrabold">
            {formatCount(market.headline.open)}
          </span>
          <span className="text-small text-muted-foreground">
            {MARKET_COPY.openTechRoles}
          </span>
        </span>
        {market.headline.change ? (
          <Delta
            value={market.headline.change.value}
            suffix={changeSuffix("week")}
            variant="pill"
            className="self-start"
          />
        ) : null}
      </div>
      {trend.length > 1 ? (
        <figure className="flex min-w-0 flex-col gap-1">
          <AreaChart
            series={trend}
            height={96}
            label={MARKET_COPY.lastThirtyDays}
          />
          <figcaption className="text-eyebrow text-muted-foreground">
            {MARKET_COPY.lastThirtyDays}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
