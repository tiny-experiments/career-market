import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Delta } from "@/components/data/Delta";
import { Gauge } from "@/components/data/Gauge";
import { KpiTile } from "@/components/data/KpiTile";
import { MarketCard } from "@/components/data/MarketCard";
import type { MarketOverview } from "@/lib/api";
import { formatCount, formatDays, formatShare } from "@/lib/format";
import { HINTS } from "@/lib/marketCopy";
import { marketBreadth, type ProfessionRow } from "@/lib/professions";
import { FlowBars } from "./FlowBars";

const FLOW_DAYS = 7;
const NO_FIGURE = "—";

/** The market at a glance: the headline, the breadth behind it and the day's flow. */
export function MarketStatusCard({
  market,
  professions,
}: {
  readonly market: MarketOverview;
  readonly professions: readonly ProfessionRow[];
}) {
  const breadth = marketBreadth(professions);
  const tone =
    breadth.share >= 0.55 ? "up" : breadth.share <= 0.45 ? "down" : "flat";
  const flow = market.series
    .filter((point) => !point.estimated && !point.bootstrap)
    .slice(-FLOW_DAYS)
    .map((point) => ({
      date: point.date,
      opened: point.new,
      closed: point.closed,
    }));

  return (
    <MarketCard title="Market status" to="/jobs">
      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-6 row-span-2 flex flex-col items-center justify-center gap-1 rounded-lg bg-tile px-2 py-3 text-center sm:col-span-2">
          <span className="inline-flex items-center gap-1.5 text-eyebrow font-semibold text-muted-foreground">
            Tech Hiring Index
            <MetricHoverCard title="Tech Hiring Index">
              {HINTS.openRoles.text}
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
              suffix="this week"
              variant="pill"
            />
          ) : null}
          <span className="mt-1 inline-flex items-center gap-1 text-eyebrow text-muted-foreground">
            {breadth.up} of {breadth.total} growing
            <MetricHoverCard title={HINTS.breadth.title}>
              {HINTS.breadth.text}
            </MetricHoverCard>
          </span>
        </div>
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={HINTS.newToday.title}
          value={formatCount(market.stats.newToday)}
          hint={HINTS.newToday}
        />
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={HINTS.closedToday.title}
          value={formatCount(market.stats.closedToday)}
          hint={HINTS.closedToday}
        />
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={HINTS.typicalTimeOpen.title}
          value={
            market.stats.medianDaysOpen === null
              ? NO_FIGURE
              : formatDays(market.stats.medianDaysOpen)
          }
          hint={HINTS.typicalTimeOpen}
        />
        <KpiTile
          className="col-span-3 sm:col-span-2"
          label={HINTS.remoteShare.title}
          value={
            market.stats.remoteShare === null
              ? NO_FIGURE
              : formatShare(market.stats.remoteShare)
          }
          hint={HINTS.remoteShare}
        />
      </div>
      {flow.length > 1 ? <FlowBars days={flow} /> : null}
    </MarketCard>
  );
}
