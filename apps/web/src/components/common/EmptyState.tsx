import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Nothing to show, said as what to do next: a list with no rows, a search
 * with no match. Sized for the inside of a card or table, not a whole page.
 */
export interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description?: ReactNode;
  /** The one thing to do about it: clear the filters, widen the search. */
  readonly action?: ReactNode;
  readonly className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-16 text-center",
        className,
      )}
    >
      <Icon className="size-6 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        {description === undefined ? null : (
          <p className="max-w-md text-small text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
