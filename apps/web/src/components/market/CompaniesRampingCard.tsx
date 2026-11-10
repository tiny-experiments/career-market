import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Logo } from "@/components/data/Logo";
import { MarketCard } from "@/components/data/MarketCard";
import { RankedList } from "@/components/data/RankedList";
import type { Signal } from "@/components/data/SignalBadge";
import { Sparkline } from "@/components/data/Sparkline";
import { useCardPages } from "@/hooks";
import type { MarketOverview } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { MARKET_COPY, METRICS, SIGNALS as SIGNAL_COPY } from "@/content";
import { cn } from "@/lib/utils";

const SIGNALS: readonly {
  readonly signal: Signal;
  readonly label: string;
  readonly tone: string;
}[] = [
  { signal: "ramping", label: SIGNAL_COPY.RAMPING.label, tone: "text-up" },
  {
    signal: "steady",
    label: SIGNAL_COPY.STEADY.label,
    tone: "text-foreground",
  },
  { signal: "cooling", label: SIGNAL_COPY.COOLING.label, tone: "text-warn" },
  { signal: "freezing", label: SIGNAL_COPY.FREEZING.label, tone: "text-down" },
];

/** Hiring signal counts over the companies moving most, each signal a door. */
export function CompaniesRampingCard({
  market,
}: {
  readonly market: MarketOverview;
}) {
  const rows = market.companiesRamping.available
    ? market.companiesRamping.rows
    : [];
  const { listRef, start, end, pager } = useCardPages(rows.length);

  return (
    <MarketCard
      title={MARKET_COPY.companiesRamping}
      to="/companies?signal=ramping"
      pager={pager}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SIGNALS.map(({ signal, label, tone }) => (
          // The (i) sits beside the link, never inside it: one control per tile.
          <div key={signal} className="relative">
            <Link
              to={`/companies?signal=${signal}`}
              className="flex flex-col gap-1 rounded-lg bg-tile px-3 py-2.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate text-eyebrow font-semibold text-muted-foreground">
                {label}
              </span>
              <span className={cn("text-sm font-bold", tone)}>
                {formatCount(market.signalCounts[signal])}
              </span>
            </Link>
            {signal === "ramping" ? (
              <MetricHoverCard
                title={METRICS.hiringSignals.title}
                className="absolute top-2 right-2"
              >
                {METRICS.hiringSignals.text}
              </MetricHoverCard>
            ) : null}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-small text-muted-foreground">
          {MARKET_COPY.noneRamping}
        </p>
      ) : (
        <div
          ref={listRef}
          className="flex-1 lg:min-h-rows-min-compact lg:contain-size"
        >
          <RankedList
            items={rows.slice(start, end).map((row, index) => ({
              rank: start + index + 1,
              logo: <Logo name={row.name} domain={row.domain} size="sm" />,
              name: row.name,
              value: formatCount(row.open),
              trend: (
                <Sparkline
                  values={row.spark}
                  end={market.asOf}
                  width={64}
                  height={24}
                  className="hidden xl:block"
                />
              ),
              to: `/companies/${row.slug}`,
              ...(row.change ? { change: row.change.value } : {}),
            }))}
          />
        </div>
      )}
    </MarketCard>
  );
}
