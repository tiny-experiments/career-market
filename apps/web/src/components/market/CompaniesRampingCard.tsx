import { useState } from "react";
import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Logo } from "@/components/data/Logo";
import { MarketCard } from "@/components/data/MarketCard";
import { RankedList } from "@/components/data/RankedList";
import type { Signal } from "@/components/data/SignalBadge";
import { Sparkline } from "@/components/data/Sparkline";
import type { MarketOverview } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { MARKET_COPY, METRICS, SIGNALS as SIGNAL_COPY } from "@/content";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

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
  const [page, setPage] = useState(1);
  const rows = market.companiesRamping.available
    ? market.companiesRamping.rows
    : [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;

  return (
    <MarketCard
      title={MARKET_COPY.companiesRamping}
      to="/companies?signal=ramping"
      pager={{
        page,
        pageCount,
        onPrev: () => setPage((p) => Math.max(1, p - 1)),
        onNext: () => setPage((p) => Math.min(pageCount, p + 1)),
      }}
    >
      <div className="grid grid-cols-4 gap-2">
        {SIGNALS.map(({ signal, label, tone }) => (
          <Link
            key={signal}
            to={`/companies?signal=${signal}`}
            className="flex flex-col gap-1 rounded-lg bg-tile px-3 py-2.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="inline-flex items-center gap-1 truncate text-eyebrow font-semibold text-muted-foreground">
              {label}
              {signal === "ramping" ? (
                <MetricHoverCard title={METRICS.signal.title}>
                  {METRICS.signal.text}
                </MetricHoverCard>
              ) : null}
            </span>
            <span className={cn("text-sm font-bold", tone)}>
              {formatCount(market.signalCounts[signal])}
            </span>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-small text-muted-foreground">
          {MARKET_COPY.noneRamping}
        </p>
      ) : (
        <RankedList
          items={rows.slice(start, start + PAGE_SIZE).map((row, index) => ({
            rank: start + index + 1,
            logo: <Logo name={row.name} domain={row.domain} size="sm" />,
            name: row.name,
            value: formatCount(row.open),
            trend: (
              <Sparkline
                values={row.spark}
                width={64}
                height={24}
                className="hidden xl:block"
              />
            ),
            to: `/companies/${row.slug}`,
            ...(row.change ? { change: row.change.value } : {}),
          }))}
        />
      )}
    </MarketCard>
  );
}
