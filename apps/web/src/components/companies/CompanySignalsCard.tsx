import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common";
import { MarketCard, SegmentBar } from "@/components/data";
import {
  DIRECTORY_COPY,
  hiringLess,
  hiringMore,
  METRICS,
  SIGNALS,
  type SignalState,
} from "@/content";
import type { CompanySignalsOverview } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

const TILES: readonly { state: SignalState; tone: string }[] = [
  { state: "RAMPING", tone: "text-up" },
  { state: "STEADY", tone: "text-foreground" },
  { state: "COOLING", tone: "text-warn" },
  { state: "FREEZING", tone: "text-down" },
];

/**
 * Where hiring leans: the companies hiring more set against the ones hiring
 * less, in a sentence and one bar, then a door into each signal.
 */
export function CompanySignalsCard({
  counts,
}: {
  readonly counts: CompanySignalsOverview["counts"];
}) {
  const more = counts.RAMPING;
  const less = counts.COOLING + counts.FREEZING;
  const moving = more + less;
  const lean = moving === 0 ? 0.5 : more / moving;
  const sentence =
    lean > 0.55
      ? DIRECTORY_COPY.mostlyRamping
      : lean < 0.45
        ? DIRECTORY_COPY.mostlyCooling
        : DIRECTORY_COPY.balanced;

  return (
    <MarketCard
      title={DIRECTORY_COPY.hiringSignals}
      to="/companies?signal=ramping"
    >
      <div className="flex flex-col gap-3 rounded-lg bg-tile px-3 py-3">
        <p className="flex items-start gap-1.5 text-sm font-semibold">
          {sentence}
          <MetricHoverCard title={METRICS.hiringSignals.title}>
            {METRICS.hiringSignals.text}
          </MetricHoverCard>
        </p>
        <SegmentBar
          legend={false}
          segments={[
            { label: "more", share: lean, swatch: "bg-up" },
            { label: "less", share: 1 - lean, swatch: "bg-down" },
          ]}
        />
        <div className="flex justify-between gap-3 text-small font-semibold">
          <span className="text-up">{hiringMore(formatCount(more))}</span>
          <span className="text-down">{hiringLess(formatCount(less))}</span>
        </div>
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
