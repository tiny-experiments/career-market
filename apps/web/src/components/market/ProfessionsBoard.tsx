import { Search } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { TableFilter } from "@/components/data/TableFilter";
import {
  EMPTY,
  FILTER_LABEL,
  MARKET_COPY,
  PROFESSION_FILTERS,
} from "@/content";
import { useTableFilter } from "@/hooks";
import {
  PROFESSION_VIEWS,
  professionsInView,
  REGIONAL_PROFESSION_VIEWS,
  type ProfessionRow,
  type ProfessionView,
} from "@/lib/professions";
import { ProfessionsTable } from "./ProfessionsTable";

const NOTHING_IN_VIEW: Partial<Record<ProfessionView, string>> = {
  gaining: MARKET_COPY.noneGaining,
  cooling: MARKET_COPY.noneCooling,
  "best-paid": MARKET_COPY.noPay,
};

/** A filter change starts the table from the filter's own order again. */
const RESET = ["page", "sort", "dir"] as const;

/**
 * The professions table with its filter row on top, on Market and on
 * Professions: the filter lives in the address as `?view=`.
 */
export function ProfessionsBoard({
  rows,
  regional = false,
}: {
  readonly rows: readonly ProfessionRow[];
  /** Scoped to a region: filters only known worldwide step aside. */
  readonly regional?: boolean;
}) {
  const views = regional ? REGIONAL_PROFESSION_VIEWS : PROFESSION_VIEWS;
  const [view, setView] = useTableFilter("view", views, "overview", RESET);
  const shown = useMemo(() => professionsInView(rows, view), [rows, view]);
  const options = PROFESSION_FILTERS.filter((option) =>
    views.includes(option.value),
  );

  return (
    <div className="flex flex-col gap-4">
      <TableFilter
        label={FILTER_LABEL.professions}
        options={options}
        value={view}
        onChange={setView}
      />
      {shown.length === 0 ? (
        <EmptyState
          icon={Search}
          title={NOTHING_IN_VIEW[view] ?? EMPTY.professions.title}
        />
      ) : (
        <ProfessionsTable
          key={view}
          rows={shown}
          rankFrom={rows}
          view={view}
          regional={regional}
        />
      )}
    </div>
  );
}
