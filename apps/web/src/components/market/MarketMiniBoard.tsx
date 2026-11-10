import { MiniList, MiniRow, MiniStat, Sparkline } from "@/components/data";
import {
  changeSuffix,
  daysOld,
  MARKET_COPY,
  METRICS,
  NO_FIGURE,
} from "@/content";
import type { MarketOverview } from "@/lib/api";
import { formatCount, formatDays, formatShare } from "@/lib/format";
import { gainingProfessions, type ProfessionRow } from "@/lib/professions";
import { professionItems, rampingCompanyItems } from "./MarketRankedItems";

const TREND_DAYS = 30;

/**
 * The Market cards shrunk for a phone: a row of mini tiles with the day's
 * figures, then the professions gaining and the companies ramping as short
 * lists, both rows sliding sideways so the table starts on the first screen.
 */
export function MarketMiniBoard({
  market,
  professions,
}: {
  readonly market: MarketOverview;
  readonly professions: readonly ProfessionRow[];
}) {
  const { stats, headline } = market;
  const recent = market.series.slice(-TREND_DAYS);
  const trend = recent.map((point) => point.open);
  const ramping = market.companiesRamping.available
    ? market.companiesRamping.rows
    : [];

  return (
    <div className="flex flex-col gap-3">
      <MiniRow label={MARKET_COPY.atAGlance}>
        <MiniStat
          label={MARKET_COPY.hiringIndex}
          value={formatCount(headline.open)}
          hint={METRICS.hiringIndex}
          to="/jobs"
          {...(headline.change
            ? { change: headline.change.value, suffix: changeSuffix("week") }
            : {})}
        >
          {trend.length > 1 ? (
            <Sparkline
              values={trend}
              end={recent.at(-1)?.date ?? null}
              width={112}
              height={18}
              className="mt-1"
            />
          ) : null}
        </MiniStat>
        <MiniStat
          label={METRICS.newToday.title}
          value={formatCount(stats.newToday)}
          caption={MARKET_COPY.newlyPosted}
          hint={METRICS.newToday}
          to="/jobs?posted=1d"
        />
        <MiniStat
          label={METRICS.closedToday.title}
          value={formatCount(stats.closedToday)}
          hint={METRICS.closedToday}
        />
        <MiniStat
          label={METRICS.typicalAge.title}
          value={
            stats.medianDaysOpen === null
              ? NO_FIGURE
              : daysOld(formatDays(stats.medianDaysOpen))
          }
          hint={METRICS.typicalAge}
        />
        <MiniStat
          label={METRICS.remoteShare.title}
          value={
            stats.remoteShare === null
              ? NO_FIGURE
              : formatShare(stats.remoteShare)
          }
          hint={METRICS.remoteShare}
          to="/jobs?mode=remote"
        />
      </MiniRow>
      <MiniRow label={MARKET_COPY.movers}>
        <MiniList
          title={MARKET_COPY.professionsGaining}
          to="/professions?view=gaining"
          items={professionItems(gainingProfessions(professions), {
            value: (row) => formatCount(row.open),
            change: (row) => row.change?.value,
          })}
          empty={MARKET_COPY.noneGaining}
        />
        <MiniList
          title={MARKET_COPY.companiesRamping}
          to="/companies?signal=ramping"
          items={rampingCompanyItems(ramping)}
          empty={MARKET_COPY.noneRamping}
        />
      </MiniRow>
    </div>
  );
}
