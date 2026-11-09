import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/data/DataTable";
import { Logo } from "@/components/data/Logo";
import { ShareBar } from "@/components/data/ShareBar";
import { Sparkline } from "@/components/data/Sparkline";
import { formatCount, formatPayRange, formatShare } from "@/lib/format";
import { METRICS, NO_FIGURE, WINDOW_HEADER } from "@/content";
import {
  professionHref,
  sortProfessions,
  VIEW_SORT,
  type ProfessionRow,
  type ProfessionSortKey,
  type ProfessionView,
} from "@/lib/professions";
import { ChangeCell } from "./ChangeCell";

export interface ProfessionsTableProps {
  readonly rows: readonly ProfessionRow[];
  readonly view: ProfessionView;
  /** Scoped to a region: columns only known worldwide step aside. */
  readonly regional?: boolean;
}

const dash = <span className="text-subtle">{NO_FIGURE}</span>;

/**
 * The market's main table: every profession, full width, the whole row a link.
 * A view picks the opening order; a column header can still re-sort it.
 */
export function ProfessionsTable({
  rows,
  view,
  regional = false,
}: ProfessionsTableProps) {
  const [sort, setSort] = useState(VIEW_SORT[view]);

  const rankOf = useMemo(() => {
    const ranks = new Map<string, number>();
    sortProfessions(rows, "open", "desc").forEach((row, index) =>
      ranks.set(row.family, index + 1),
    );
    return ranks;
  }, [rows]);

  const sorted = useMemo(
    () => sortProfessions(rows, sort.key, sort.direction),
    [rows, sort],
  );

  const columns: Column<ProfessionRow>[] = [
    {
      key: "rank",
      header: "#",
      className: "w-12 text-muted-foreground",
      cell: (row) => rankOf.get(row.family),
    },
    {
      key: "name",
      header: "Profession",
      sortable: true,
      cell: (row) => (
        <span className="flex items-center gap-3">
          <Logo name={row.name} shape="square" size="sm" />
          <span className="truncate font-bold">{row.name}</span>
          <span className="hidden text-small font-medium text-muted-foreground sm:inline">
            {row.code}
          </span>
        </span>
      ),
    },
    {
      key: "open",
      header: "Open roles",
      align: "right",
      sortable: true,
      hint: METRICS.openRolesProfession,
      cell: (row) => formatCount(row.open),
    },
    {
      key: "change1d",
      header: WINDOW_HEADER.day,
      align: "right",
      sortable: true,
      from: "lg",
      hint: METRICS.changeDay,
      cell: (row) => <ChangeCell value={row.change1d} />,
    },
    {
      key: "change7d",
      header: WINDOW_HEADER.week,
      align: "right",
      sortable: true,
      hint: METRICS.changeWeek,
      cell: (row) => <ChangeCell value={row.change?.value ?? null} />,
    },
    ...(regional
      ? []
      : [
          {
            key: "change1m",
            header: WINDOW_HEADER.month,
            align: "right",
            sortable: true,
            from: "md",
            hint: METRICS.changeMonth,
            cell: (row) => <ChangeCell value={row.change1m} />,
          } satisfies Column<ProfessionRow>,
        ]),
    ...(view === "new"
      ? [
          {
            key: "new",
            header: "New this week",
            align: "right",
            sortable: true,
            from: "sm",
            hint: METRICS.newThisWeek,
            cell: (row) => formatCount(row.newThisWeek),
          } satisfies Column<ProfessionRow>,
        ]
      : []),
    ...(regional
      ? []
      : [
          {
            key: "companies",
            header: "Companies",
            align: "right",
            sortable: true,
            from: "xl",
            hint: METRICS.companiesHiring,
            cell: (row) =>
              row.companies === null ? dash : formatCount(row.companies),
          } satisfies Column<ProfessionRow>,
        ]),
    {
      key: "pay",
      header: "Pay range",
      align: "right",
      sortable: true,
      from: "lg",
      hint: METRICS.payRange,
      cell: (row) =>
        row.pay ? formatPayRange(row.pay.low, row.pay.high) : dash,
    },
    ...(regional
      ? []
      : [
          {
            key: "remote",
            header: "Remote",
            align: "right",
            sortable: true,
            from: "xl",
            hint: METRICS.remoteShare,
            cell: (row) =>
              row.remoteShare === null ? (
                dash
              ) : (
                <span className="ml-auto flex w-16 flex-col items-end gap-1">
                  {formatShare(row.remoteShare)}
                  <ShareBar value={row.remoteShare} />
                </span>
              ),
          } satisfies Column<ProfessionRow>,
        ]),
    {
      key: "trend",
      header: "30 days",
      align: "right",
      from: "md",
      hint: METRICS.trend,
      cell: (row) => <Sparkline values={row.spark} className="ml-auto" />,
    },
  ];

  return (
    <div className="-mx-gutter">
      <DataTable
        caption="Professions by open roles"
        columns={columns}
        rows={sorted}
        rowKey={(row) => row.family}
        rowHref={(row) => professionHref(row.code)}
        rowLabel={(row) => row.name}
        linkColumn="name"
        sort={sort}
        onSort={(key) =>
          setSort((current) => ({
            key: key as ProfessionSortKey,
            direction:
              current.key === key && current.direction === "desc"
                ? "asc"
                : "desc",
          }))
        }
      />
    </div>
  );
}
