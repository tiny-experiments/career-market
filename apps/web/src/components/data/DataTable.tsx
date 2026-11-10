import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface Column<Row> {
  readonly key: string;
  readonly header: ReactNode;
  /** Numbers go right; names and words go left. */
  readonly align?: "left" | "right";
  readonly cell: (row: Row, index: number) => ReactNode;
  /** One sentence on what the column's figure is, behind an (i) in the header. */
  readonly hint?: {
    readonly title: string;
    readonly text: string;
    readonly formula?: string;
  };
  readonly sortable?: boolean;
  /** Hide the column below this breakpoint. */
  readonly from?: "sm" | "md" | "lg" | "xl" | "2xl";
  /**
   * A small second line under the cell on a phone, below `md`: the code under
   * a name, the week's change under a count, so a row stays rank, logo, name
   * and figure when the columns that carry them hide.
   */
  readonly phoneLine?: (row: Row) => ReactNode;
  /** The header on a phone, when the phone line changes what the column shows: "Open · 7D". */
  readonly phoneHeader?: ReactNode;
  readonly className?: string;
}

export interface DataTableProps<Row> {
  readonly columns: readonly Column<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  /** Where a row goes. The whole row is the target; the first cell carries the link. */
  readonly rowHref?: (row: Row) => string;
  /** Which column carries the row's link; the first column by default. */
  readonly linkColumn?: string;
  readonly sort?: { readonly key: string; readonly direction: SortDirection };
  readonly onSort?: (key: string) => void;
  /** Told which row the pointer is over, null when it leaves. */
  readonly onRowHover?: (row: Row | null) => void;
  readonly loading?: boolean;
  readonly skeletonRows?: number;
  /** Shown in place of rows when there are none. */
  readonly empty?: ReactNode;
  readonly stickyHeader?: boolean;
  readonly caption?: string;
  /** Inside a card the first and last columns line up with the card's own padding. */
  readonly inset?: "page" | "card";
  readonly className?: string;
}

const EDGE = {
  page: "first:pl-gutter last:pr-gutter",
  card: "first:pl-4 last:pr-4",
} as const;

const FROM = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
} as const;

function headerOf<Row>(column: Column<Row>): ReactNode {
  if (column.phoneHeader === undefined) return column.header;
  return (
    <>
      <span className="max-md:hidden">{column.header}</span>
      <span className="md:hidden">{column.phoneHeader}</span>
    </>
  );
}

function phoneLine<Row>(column: Column<Row>, row: Row): ReactNode {
  if (column.phoneLine === undefined) return null;
  return (
    <span className="mt-0.5 block text-xs font-medium text-muted-foreground md:hidden">
      {column.phoneLine(row)}
    </span>
  );
}

/**
 * The market table: full width, 44 px header, 52 px rows, every number
 * right-aligned in tabular figures, the row a single link that tints on hover
 * and outlines on focus. Sorting and hints live in the header. The link is
 * named by what it shows, so what a screen reader says matches what is seen.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  linkColumn,
  sort,
  onSort,
  onRowHover,
  loading = false,
  skeletonRows = 5,
  empty,
  stickyHeader = false,
  caption,
  inset = "page",
  className,
}: DataTableProps<Row>) {
  const alignClass = (column: Column<Row>) =>
    column.align === "right" ? "text-right" : "text-left";
  const linkKey = linkColumn ?? columns[0]?.key;

  return (
    <Table className={cn("text-sm", className)}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <TableHeader
        className={cn(stickyHeader && "sticky top-0 z-10 bg-background")}
      >
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => {
            const sorted =
              sort?.key === column.key ? sort.direction : undefined;
            return (
              <TableHead
                key={column.key}
                aria-sort={
                  sorted
                    ? sorted === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={cn(
                  "h-11 px-3 text-eyebrow font-semibold text-muted-foreground",
                  EDGE[inset],
                  alignClass(column),
                  column.from && FROM[column.from],
                  column.className,
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    column.align === "right" && "flex-row-reverse",
                  )}
                >
                  {column.sortable && onSort ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onSort(column.key)}
                      className="-mx-1.5 h-6 gap-1 px-1.5 text-eyebrow font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {headerOf(column)}
                      {sorted === "asc" ? (
                        <ArrowUp />
                      ) : sorted === "desc" ? (
                        <ArrowDown />
                      ) : (
                        <ArrowUpDown className="opacity-50" />
                      )}
                    </Button>
                  ) : (
                    <span>{headerOf(column)}</span>
                  )}
                  {column.hint ? (
                    <MetricHoverCard
                      title={column.hint.title}
                      {...(column.hint.formula
                        ? { formula: column.hint.formula }
                        : {})}
                    >
                      {column.hint.text}
                    </MetricHoverCard>
                  ) : null}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: skeletonRows }, (_, index) => (
              <TableRow key={`skeleton-${index}`} className="h-row">
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "px-3",
                      EDGE[inset],
                      column.from && FROM[column.from],
                    )}
                  >
                    <Skeleton
                      className={cn(
                        "h-4",
                        column.align === "right" ? "ml-auto w-16" : "w-32",
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.map((row, index) => {
              const href = rowHref?.(row);
              return (
                <TableRow
                  key={rowKey(row)}
                  onPointerEnter={
                    onRowHover ? () => onRowHover(row) : undefined
                  }
                  onPointerLeave={
                    onRowHover ? () => onRowHover(null) : undefined
                  }
                  className={cn(
                    "h-row transition-colors",
                    href &&
                      "hover:bg-accent has-[a:focus-visible]:bg-accent has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring",
                  )}
                >
                  {columns.map((column) => {
                    const carriesLink =
                      href !== undefined && column.key === linkKey;
                    return (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "px-3 font-medium",
                          // Each cell bounds its own link cover. iOS 17 Safari
                          // ignores `position: relative` on a row, so a cover
                          // sized to the row spreads over the whole table and
                          // the last row's link takes every tap.
                          href !== undefined && "relative",
                          EDGE[inset],
                          alignClass(column),
                          column.from && FROM[column.from],
                          column.className,
                        )}
                      >
                        {carriesLink ? (
                          <Link
                            to={href}
                            className="outline-none after:absolute after:inset-0"
                          >
                            {column.cell(row, index)}
                            {phoneLine(column, row)}
                          </Link>
                        ) : (
                          <>
                            {column.cell(row, index)}
                            {phoneLine(column, row)}
                            {href === undefined ? null : (
                              // The rest of the row's cells open the same page; the
                              // first link alone is named and reached by Tab.
                              <Link
                                to={href}
                                tabIndex={-1}
                                aria-hidden
                                className="absolute inset-0"
                              />
                            )}
                          </>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
        {!loading && rows.length === 0 && empty ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="p-0">
              {empty}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
