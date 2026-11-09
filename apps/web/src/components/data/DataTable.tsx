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
  readonly className?: string;
}

export interface DataTableProps<Row> {
  readonly columns: readonly Column<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  /** Where a row goes. The whole row is the target; the first cell carries the link. */
  readonly rowHref?: (row: Row) => string;
  /** The link's name for assistive tech, e.g. the profession's name. */
  readonly rowLabel?: (row: Row) => string;
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

/**
 * The market table: full width, 44 px header, 52 px rows, every number
 * right-aligned in tabular figures, the row a single link that tints on hover
 * and outlines on focus. Sorting and hints live in the header.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  rowLabel,
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
                      {column.header}
                      {sorted === "asc" ? (
                        <ArrowUp />
                      ) : sorted === "desc" ? (
                        <ArrowDown />
                      ) : (
                        <ArrowUpDown className="opacity-50" />
                      )}
                    </Button>
                  ) : (
                    <span>{column.header}</span>
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
                    "relative h-row transition-colors",
                    href && "hover:bg-accent has-[a:focus-visible]:bg-accent",
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
                          EDGE[inset],
                          alignClass(column),
                          column.from && FROM[column.from],
                          column.className,
                        )}
                      >
                        {carriesLink ? (
                          <Link
                            to={href}
                            aria-label={rowLabel?.(row)}
                            className="outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                          >
                            {column.cell(row, index)}
                          </Link>
                        ) : (
                          column.cell(row, index)
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
