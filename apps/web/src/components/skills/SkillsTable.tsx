import {
  ChangeCell,
  DataTable,
  ShareBar,
  Sparkline,
  type Column,
  type SortDirection,
} from "@/components/data";
import { skillLogo } from "@/components/skills/SkillRankedItems";
import { DIRECTORY_COPY, METRICS, NO_FIGURE, WINDOW_HEADER } from "@/content";
import type { SkillIndexRow } from "@/lib/api";
import { formatCount, formatPay, formatShare } from "@/lib/format";

const dash = <span className="text-subtle">{NO_FIGURE}</span>;

function columns(rank: ReadonlyMap<string, number>): Column<SkillIndexRow>[] {
  return [
    {
      key: "rank",
      header: DIRECTORY_COPY.columns.rank,
      from: "sm",
      cell: (row) => (
        <span className="text-muted-foreground">{rank.get(row.id)}</span>
      ),
    },
    {
      key: "label",
      header: DIRECTORY_COPY.columns.skill,
      sortable: true,
      className: "max-w-44 sm:max-w-72",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          {skillLogo(row)}
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-bold">{row.label}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {row.category}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "open",
      header: DIRECTORY_COPY.columns.openRoles,
      align: "right",
      sortable: true,
      hint: METRICS.openRolesSkill,
      cell: (row) => formatCount(row.open),
    },
    {
      key: "change7d",
      header: WINDOW_HEADER.week,
      align: "right",
      sortable: true,
      from: "md",
      hint: METRICS.changeWeek,
      cell: (row) => <ChangeCell change={row.change7d} />,
    },
    {
      key: "change30d",
      header: WINDOW_HEADER.month,
      align: "right",
      sortable: true,
      hint: METRICS.changeMonth,
      cell: (row) => <ChangeCell change={row.change} />,
    },
    {
      key: "pay",
      header: METRICS.skillPay.title,
      align: "right",
      sortable: true,
      from: "lg",
      hint: METRICS.skillPay,
      cell: (row) => (row.pay ? formatPay(row.pay.median) : dash),
    },
    {
      key: "remote",
      header: DIRECTORY_COPY.columns.remote,
      align: "right",
      sortable: true,
      from: "lg",
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
      key: "pair",
      header: METRICS.pairedShare.title,
      sortable: true,
      from: "xl",
      hint: METRICS.pairedShare,
      cell: (row) =>
        row.topPair ? (
          <span className="inline-flex items-center gap-2">
            {skillLogo(row.topPair)}
            <span className="font-semibold">{row.topPair.label}</span>
            <span className="text-xs text-muted-foreground">
              {formatShare(row.topPair.share)}
            </span>
          </span>
        ) : (
          dash
        ),
    },
    {
      key: "trend",
      header: METRICS.trend.title,
      align: "right",
      from: "md",
      hint: METRICS.trend,
      cell: (row) => (
        <Sparkline
          values={row.spark}
          end={row.asOf}
          className="ml-auto block"
        />
      ),
    },
  ];
}

/** Every tracked skill, with its logo, demand, pay and closest companion. */
export function SkillsTable({
  rows,
  rank,
  sort,
  onSort,
}: {
  readonly rows: readonly SkillIndexRow[];
  /** A skill's place by open roles, whatever the table is sorted by. */
  readonly rank: ReadonlyMap<string, number>;
  readonly sort: { readonly key: string; readonly direction: SortDirection };
  readonly onSort: (key: string) => void;
}) {
  return (
    <DataTable
      columns={columns(rank)}
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/skills/${row.slug}`}
      linkColumn="label"
      sort={sort}
      onSort={onSort}
      caption={DIRECTORY_COPY.skillsCaption}
    />
  );
}
