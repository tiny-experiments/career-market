import { signalOf } from "@/components/companies/signal";
import {
  ChangeCell,
  DataTable,
  Logo,
  ShareBar,
  SignalBadge,
  Sparkline,
  type Column,
  type SortDirection,
} from "@/components/data";
import {
  DIRECTORY_COPY,
  METRICS,
  NO_FIGURE,
  WINDOW_HEADER,
  PHONE_OPEN_HEADER,
} from "@/content";
import { useDataDay } from "@/hooks";
import type { CompanyDirectoryRow } from "@/lib/api";
import { formatCount, formatShare } from "@/lib/format";

const dash = <span className="text-subtle">{NO_FIGURE}</span>;

function columns(
  rows: readonly CompanyDirectoryRow[],
  day: string | null,
): Column<CompanyDirectoryRow>[] {
  return [
    {
      key: "rank",
      header: DIRECTORY_COPY.columns.rank,
      hint: METRICS.rank,
      cell: (row) => (
        <span className="text-muted-foreground">{formatCount(row.rank)}</span>
      ),
    },
    {
      key: "name",
      header: DIRECTORY_COPY.columns.company,
      sortable: true,
      className: "max-w-44 sm:max-w-72",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          <Logo name={row.name} domain={row.domain} size="sm" />
          <span className="truncate font-bold">{row.name}</span>
        </span>
      ),
    },
    {
      key: "open",
      header: DIRECTORY_COPY.columns.openRoles,
      align: "right",
      sortable: true,
      hint: METRICS.openRolesCompany,
      cell: (row) => formatCount(row.open),
      phoneLine: (row) => <ChangeCell change={row.change} size="sm" />,
      phoneHeader: PHONE_OPEN_HEADER,
    },
    {
      key: "change1w",
      header: WINDOW_HEADER.week,
      align: "right",
      sortable: true,
      from: "md",
      hint: METRICS.changeWeek,
      cell: (row) => <ChangeCell change={row.change} />,
    },
    {
      key: "change30d",
      header: WINDOW_HEADER.month,
      align: "right",
      from: "md",
      // Nothing to order by until a full month exists.
      sortable: rows.some((row) => row.change30d !== null),
      hint: METRICS.changeMonth,
      cell: (row) => <ChangeCell change={row.change30d} />,
    },
    {
      key: "signal",
      header: DIRECTORY_COPY.columns.signal,
      from: "lg",
      hint: METRICS.signal,
      cell: (row) =>
        row.state ? <SignalBadge signal={signalOf(row.state)} /> : dash,
    },
    {
      key: "profession",
      header: METRICS.topProfession.title,
      from: "xl",
      hint: METRICS.topProfession,
      cell: (row) =>
        row.topProfession ? (
          <span className="text-muted-foreground">
            {row.topProfession.name}
          </span>
        ) : (
          dash
        ),
    },
    {
      key: "remote",
      header: DIRECTORY_COPY.columns.remote,
      align: "right",
      from: "xl",
      hint: METRICS.remoteShare,
      cell: (row) =>
        row.remoteShare === null ? (
          dash
        ) : (
          <span className="ml-auto flex w-16 flex-col gap-1">
            {formatShare(row.remoteShare)}
            <ShareBar value={row.remoteShare} />
          </span>
        ),
    },
    {
      key: "trend",
      header: METRICS.trend.title,
      align: "right",
      from: "md",
      hint: METRICS.trend,
      cell: (row) => (
        <Sparkline values={row.spark} end={day} className="ml-auto block" />
      ),
    },
  ];
}

/** Every company as one bold, full-width table; the whole row opens the company. */
export function CompaniesTable({
  rows,
  sort,
  onSort,
}: {
  readonly rows: readonly CompanyDirectoryRow[];
  readonly sort: { readonly key: string; readonly direction: SortDirection };
  readonly onSort: (key: string) => void;
}) {
  const day = useDataDay();
  return (
    <DataTable
      columns={columns(rows, day)}
      rows={rows}
      rowKey={(row) => row.slug}
      rowHref={(row) => `/companies/${row.slug}`}
      linkColumn="name"
      sort={sort}
      onSort={onSort}
      caption={DIRECTORY_COPY.companiesCaption}
    />
  );
}
