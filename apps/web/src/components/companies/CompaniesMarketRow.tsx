import { DIRECTORY_COPY, METRICS, SIGNALS, type SignalState } from "@/content";
import { CompanySignalsCard } from "@/components/companies/CompanySignalsCard";
import {
  Logo,
  MiniList,
  MiniRow,
  MiniStat,
  PagedRankedCard,
  Sparkline,
  type RankedItem,
} from "@/components/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataDay, useIsMobile } from "@/hooks";
import type { CompanyMover, CompanySignalsOverview } from "@/lib/api";
import { formatCount } from "@/lib/format";

function ranked(
  movers: readonly CompanyMover[],
  day: string | null,
): RankedItem[] {
  return movers.map((mover, index) => ({
    rank: index + 1,
    logo: <Logo name={mover.name} domain={mover.domain} size="sm" />,
    name: mover.name,
    value: formatCount(mover.open),
    ...(mover.change ? { change: mover.change.value } : {}),
    trend: (
      <Sparkline
        values={mover.spark}
        end={day}
        width={56}
        height={22}
        className="hidden xl:block"
      />
    ),
    to: `/companies/${mover.slug}`,
  }));
}

const GRID = "grid gap-4 lg:grid-cols-3";

const SIGNAL_TILES: readonly {
  readonly state: SignalState;
  readonly tone?: "up" | "down" | "warn";
}[] = [
  { state: "RAMPING", tone: "up" },
  { state: "STEADY" },
  { state: "COOLING", tone: "warn" },
  { state: "FREEZING", tone: "down" },
];

/** The same three cards on a phone: a tile per hiring signal, then the fastest movers either way. */
function CompaniesMiniBoard({
  overview,
  day,
}: {
  readonly overview: CompanySignalsOverview;
  readonly day: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <MiniRow label={DIRECTORY_COPY.hiringSignals}>
        {SIGNAL_TILES.map(({ state, tone }, index) => (
          <MiniStat
            key={state}
            label={SIGNALS[state].label}
            value={formatCount(overview.counts[state])}
            to={`/companies?signal=${state.toLowerCase()}`}
            className="w-32"
            {...(tone ? { tone } : {})}
            {...(index === 0 ? { hint: METRICS.hiringSignals } : {})}
          />
        ))}
      </MiniRow>
      <MiniRow label={DIRECTORY_COPY.rampingFastest}>
        <MiniList
          title={DIRECTORY_COPY.rampingFastest}
          to="/companies?signal=ramping"
          items={ranked(overview.ramping, day)}
          empty={DIRECTORY_COPY.noMovers}
        />
        <MiniList
          title={DIRECTORY_COPY.coolingFastest}
          to="/companies?signal=cooling"
          items={ranked(overview.cooling, day)}
          empty={DIRECTORY_COPY.noMovers}
        />
      </MiniRow>
    </div>
  );
}

/** The three cards above the table: where hiring leans, who is ramping, who is cooling. */
export function CompaniesMarketRow({
  overview,
}: {
  readonly overview: CompanySignalsOverview | null;
}) {
  const day = useDataDay();
  const mobile = useIsMobile();
  if (overview === null) {
    if (mobile) {
      return (
        <Skeleton
          role="status"
          aria-label="Loading"
          className="h-48 rounded-lg"
        />
      );
    }
    return (
      <div className={GRID} role="status" aria-label="Loading">
        {["signals", "ramping", "cooling"].map((card) => (
          <Skeleton key={card} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }
  if (mobile) return <CompaniesMiniBoard overview={overview} day={day} />;
  return (
    <div className={GRID}>
      <CompanySignalsCard counts={overview.counts} />
      <PagedRankedCard
        title={DIRECTORY_COPY.rampingFastest}
        to="/companies?signal=ramping"
        items={ranked(overview.ramping, day)}
        empty={DIRECTORY_COPY.noMovers}
      />
      <PagedRankedCard
        title={DIRECTORY_COPY.coolingFastest}
        to="/companies?signal=cooling"
        items={ranked(overview.cooling, day)}
        empty={DIRECTORY_COPY.noMovers}
      />
    </div>
  );
}
