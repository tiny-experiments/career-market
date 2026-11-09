import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export interface PageSkeletonProps {
  /** A list is header and rows; a detail page is header, chart and rows. */
  readonly variant?: "list" | "detail";
  /** Leave out the title block when the page already drew its own. */
  readonly withHeader?: boolean;
}

/** The shape of a page while its first answer is on the way. */
export function PageSkeleton({
  variant = "list",
  withHeader = true,
}: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-col gap-8 lg:gap-12"
    >
      {withHeader ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
      ) : null}
      {variant === "detail" ? <Skeleton className="h-80 w-full" /> : null}
      <div className="flex flex-col gap-2">
        {ROWS.map((row) => (
          <Skeleton key={row} className="h-row w-full" />
        ))}
      </div>
    </div>
  );
}
