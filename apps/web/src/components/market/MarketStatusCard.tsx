import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Delta } from "@/components/data/Delta";
import { Gauge } from "@/components/data/Gauge";
import { KpiTile } from "@/components/data/KpiTile";
import { MarketCard } from "@/components/data/MarketCard";
import type { MarketOverview } from "@/lib/api";
import { direction, formatCount, formatDays, formatShare } from "@/lib/format";
import {
  changeSuffix,
  MARKET_COPY,
  METRICS,
  NO_FIGURE,
  professionsGrowing,
} from "@/content";
import { marketBreadth, type ProfessionRow } from "@/lib/professions";
import { FlowBars } from "./FlowBars";

const FLOW_DAYS = 7;

/** The market at a glance: the headline, the breadth behind it and the day's flow. */
export function MarketStatusCard({
  market,
  professions,
}: {
  readonly market: MarketOverview;
  readonly professions: readonly ProfessionRow[];
}) {
  const breadth = marketBreadth(professions);
  const change = market.headline.change?.value;
  const tone = change === undefined ? "flat" : direction(change);
  const flow = market.series
    .filter((point) => !point.estimated && !point.bootstrap)
    .slice(-FLOW_DAYS)
    .map((point) => ({
      date: point.date,
      opened: point.new,
      closed: point.closed,
    }));

  return (
    <MarketCard title={MARKET_COPY.status} to="/jobs">
      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-6 row-span-2 flex flex-col items-center justify-center gap-1 rounded-lg bg-tile px-2 py-3 text-center sm:col-span-2">
          <span className="inline-flex items-center gap-1.5 text-eyebrow font-semibold text-muted-foreground">
            {MARKET_COPY.hiringIndex}
            <MetricHoverCard title={METRICS.hiringIndex.title}>
              {METRICS.hiringIndex.text}
            </MetricHoverCard>
          </span>
          <Gauge
            value={breadth.share}
            tone={tone}
            className="h-auto w-full max-w-28"
          />
          <span className="text-h2 font-extrabold">
            {formatCount(market.headline.open)}
          </span>
          {market.headline.change ? (
            <Delta
              value={market.headline.change.value}
              suffix={changeSuffix("week")}
              variant="pill"
            />
          ) : null}
          <span className="mt-1 inline-flex items-center gap-1 text-eyebrow text-muted-foreground">
            {professionsGrowing(breadth.up, breadth.total)}
            <MetricHoverCard title={METRICS.professionsGrowing.title}>
              {METRICS.professionsGrowing.text}
            </MetricHoverCard>
          </span>
        </div>
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={METRICS.newToday.title}
          value={formatCount(market.stats.newToday)}
          hint={METRICS.newToday}
        />
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={METRICS.closedToday.title}
          value={formatCount(market.stats.closedToday)}
          hint={METRICS.closedToday}
        />
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={METRICS.typicalTimeOpen.title}
          value={
            market.stats.medianDaysOpen === null
              ? NO_FIGURE
              : formatDays(market.stats.medianDaysOpen)
          }
          hint={METRICS.typicalTimeOpen}
        />
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={METRICS.remoteShare.title}
          value={
            market.stats.remoteShare === null
              ? NO_FIGURE
              : formatShare(market.stats.remoteShare)
          }
          hint={METRICS.remoteShare}
        />
      </div>
      {flow.length > 1 ? <FlowBars days={flow} /> : null}
    </MarketCard>
  );
}
