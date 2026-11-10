import { Logo } from "@/components/data/Logo";
import { DataTable, type Column } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { JOB_PAGE, levelLabel, sentence, workModeLabel } from "@/content";
import { formatListedPay, formatRelativeDays } from "@/lib/format";
import type { JobRow } from "@/lib/jobRows";

const DASH = "—";

/** What kind of role a row is: its profession, or its work mode when it has none. */
const kindOf = (row: JobRow): string =>
  row.familyName ?? (row.workMode ? workModeLabel(row.workMode) : "");

const COLUMNS: readonly Column<JobRow>[] = [
  {
    key: "job",
    header: "Job",
    className: "w-full max-w-0",
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold text-foreground">
          {row.title}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <span className="truncate">
            <span className="md:hidden">
              {row.companyName}
              {/* No dangling dot when there is nothing after the company. */}
              {kindOf(row) ? " · " : ""}
            </span>
            {kindOf(row)}
          </span>
          {row.repostCount > 0 ? (
            <Badge variant="warn" className="h-4 px-1.5">
              Reposted
            </Badge>
          ) : null}
        </span>
      </span>
    ),
  },
  {
    key: "company",
    header: "Company",
    from: "md",
    className: "max-w-48 2xl:max-w-64",
    cell: (row) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <Logo name={row.companyName} domain={row.domain} size="sm" />
        <span className="truncate font-semibold">{row.companyName}</span>
      </span>
    ),
  },
  {
    key: "location",
    header: "Location",
    from: "xl",
    className: "max-w-48 2xl:max-w-64",
    cell: (row) => (
      <span className="flex min-w-0 flex-col text-muted-foreground">
        <span className="truncate">
          {row.location ?? DASH}
          {row.moreLocations > 0 ? ` +${row.moreLocations}` : ""}
        </span>
      </span>
    ),
  },
  {
    key: "level",
    header: "Seniority",
    from: "2xl",
    cell: (row) => (
      <span className="text-muted-foreground">
        {row.level ? levelLabel(row.level) : DASH}
      </span>
    ),
  },
  {
    key: "pay",
    header: "Pay",
    align: "right",
    from: "sm",
    cell: (row) => {
      const pay = formatListedPay(row.salary);
      return pay ? (
        <span className="whitespace-nowrap font-semibold">{pay}</span>
      ) : (
        <span className="text-muted-foreground">{JOB_PAGE.notListed}</span>
      );
    },
  },
  {
    key: "posted",
    header: "Posted",
    align: "right",
    cell: (row) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.ageDays === null
          ? DASH
          : sentence(formatRelativeDays(row.ageDays))}
      </span>
    ),
  },
];

/** A list of jobs: the whole row opens our job page, and no row leaves the site. */
export function JobsTable({
  rows,
  loading = false,
  empty,
  className,
}: {
  readonly rows: readonly JobRow[];
  readonly loading?: boolean;
  readonly empty?: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => row.href}
      linkColumn="job"
      loading={loading}
      skeletonRows={10}
      empty={empty}
      caption="Open jobs"
      {...(className === undefined ? {} : { className })}
    />
  );
}
