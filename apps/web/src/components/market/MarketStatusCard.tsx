import { KpiTile } from "@/components/data/KpiTile";
import { MarketCard } from "@/components/data/MarketCard";
import type { MarketOverview } from "@/lib/api";
import { formatCount, formatDays, formatShare } from "@/lib/format";
import { daysOld, MARKET_COPY, METRICS, NO_FIGURE } from "@/content";
import { AgeTimeline } from "./AgeTimeline";
import { FlowBars } from "./FlowBars";
import { HiringIndexPanel } from "./HiringIndexPanel";

const FLOW_DAYS = 7;

/** The market at a glance: the headline and its trend, the day's facts and the week's flow. */
export function MarketStatusCard({
  market,
}: {
  readonly market: MarketOverview;
}) {
  const flow = market.series
    .filter((point) => !point.estimated && !point.bootstrap)
    .slice(-FLOW_DAYS)
    .map((point) => ({
      date: point.date,
      opened: point.new,
      closed: point.closed,
    }));
  const typicalAge = market.stats.medianDaysOpen;

  return (
    <MarketCard title={MARKET_COPY.status} to="/jobs">
      <HiringIndexPanel market={market} />
      <div className="grid grid-cols-2 gap-2">
        <KpiTile
          label={METRICS.newToday.title}
          value={formatCount(market.stats.newToday)}
          caption={MARKET_COPY.newlyPosted}
          hint={METRICS.newToday}
        />
        <KpiTile
          label={METRICS.closedToday.title}
          value={formatCount(market.stats.closedToday)}
          hint={METRICS.closedToday}
        />
        <KpiTile
          label={METRICS.typicalAge.title}
          value={
            typicalAge === null ? NO_FIGURE : daysOld(formatDays(typicalAge))
          }
          hint={METRICS.typicalAge}
        >
          {typicalAge === null ? null : <AgeTimeline />}
        </KpiTile>
        <KpiTile
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
