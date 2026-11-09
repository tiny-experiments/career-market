import { DIRECTORY_COPY } from "@/content";
import { CompanySignalsCard } from "@/components/companies/CompanySignalsCard";
import {
  Logo,
  PagedRankedCard,
  Sparkline,
  type RankedItem,
} from "@/components/data";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyMover, CompanySignalsOverview } from "@/lib/api";
import { formatCount } from "@/lib/format";

function ranked(movers: readonly CompanyMover[]): RankedItem[] {
  return movers.map((mover, index) => ({
    rank: index + 1,
    logo: <Logo name={mover.name} domain={mover.domain} size="sm" />,
    name: mover.name,
    value: formatCount(mover.open),
    ...(mover.change ? { change: mover.change.value } : {}),
    trend: (
      <Sparkline
        values={mover.spark}
        width={56}
        height={22}
        className="hidden sm:block"
      />
    ),
    to: `/companies/${mover.slug}`,
  }));
}

const GRID = "grid gap-4 lg:grid-cols-3";

/** The three cards above the table: where hiring leans, who is ramping, who is cooling. */
export function CompaniesMarketRow({
  overview,
}: {
  readonly overview: CompanySignalsOverview | null;
}) {
  if (overview === null) {
    return (
      <div className={GRID} role="status" aria-label="Loading">
        {["signals", "ramping", "cooling"].map((card) => (
          <Skeleton key={card} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className={GRID}>
      <CompanySignalsCard counts={overview.counts} />
      <PagedRankedCard
        title={DIRECTORY_COPY.rampingFastest}
        to="/companies?signal=ramping"
        items={ranked(overview.ramping)}
        empty={DIRECTORY_COPY.noMovers}
      />
      <PagedRankedCard
        title={DIRECTORY_COPY.coolingFastest}
        to="/companies?signal=cooling"
        items={ranked(overview.cooling)}
        empty={DIRECTORY_COPY.noMovers}
      />
    </div>
  );
}
