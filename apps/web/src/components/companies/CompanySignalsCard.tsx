import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common";
import { Gauge, MarketCard } from "@/components/data";
import { DIRECTORY_COPY, METRICS, SIGNALS, type SignalState } from "@/content";
import type { CompanySignalsOverview } from "@/lib/api";
import { formatCount, type Direction } from "@/lib/format";
import { cn } from "@/lib/utils";

const TILES: readonly { state: SignalState; tone: string }[] = [
  { state: "RAMPING", tone: "text-up" },
  { state: "STEADY", tone: "text-foreground" },
  { state: "COOLING", tone: "text-warn" },
  { state: "FREEZING", tone: "text-down" },
];

/** Where the market leans: a gauge of ramping against cooling, and a door into each signal. */
export function CompanySignalsCard({
  counts,
}: {
  readonly counts: CompanySignalsOverview["counts"];
}) {
  const moving = counts.RAMPING + counts.COOLING + counts.FREEZING;
  const lean = moving === 0 ? 0.5 : counts.RAMPING / moving;
  const tone: Direction = lean > 0.55 ? "up" : lean < 0.45 ? "down" : "flat";
  const sentence =
    tone === "up"
      ? DIRECTORY_COPY.mostlyRamping
      : tone === "down"
        ? DIRECTORY_COPY.mostlyCooling
        : DIRECTORY_COPY.balanced;

  return (
    <MarketCard
      title={DIRECTORY_COPY.hiringSignals}
      to="/companies?signal=ramping"
    >
      <div className="flex items-center gap-4">
        <Gauge value={lean} tone={tone} className="shrink-0" />
        <p className="flex items-start gap-1.5 text-sm font-semibold">
          {sentence}
          <MetricHoverCard title={METRICS.hiringSignals.title}>
            {METRICS.hiringSignals.text}
          </MetricHoverCard>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TILES.map(({ state, tone: colour }) => (
          <Link
            key={state}
            to={`/companies?signal=${state.toLowerCase()}`}
            className="flex flex-col gap-1 rounded-lg bg-tile px-3 py-2.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-eyebrow font-semibold text-muted-foreground">
              {SIGNALS[state].label}
            </span>
            <span className={cn("text-sm font-bold", colour)}>
              {formatCount(counts[state])}
            </span>
          </Link>
        ))}
      </div>
    </MarketCard>
  );
}
