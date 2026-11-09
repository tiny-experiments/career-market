import type { ReactNode } from "react";
import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  readonly label: string;
  readonly value: string;
  /** The line under the figure: what it is a median of, how it moved. */
  readonly detail?: ReactNode;
  readonly hint?: { readonly text: string; readonly formula?: string };
  readonly className?: string;
}

/** One fact on a detail page's rail: label, figure, one qualifying line. A tile, never a card. */
export function StatCard({
  label,
  value,
  detail,
  hint,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-36 flex-col gap-1.5 rounded-lg bg-tile px-3.5 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-eyebrow font-semibold text-muted-foreground">
        <span className="truncate">{label}</span>
        {hint ? (
          <MetricHoverCard
            title={label}
            {...(hint.formula ? { formula: hint.formula } : {})}
          >
            {hint.text}
          </MetricHoverCard>
        ) : null}
      </div>
      <span className="text-h2 font-bold">{value}</span>
      {detail === undefined ? null : (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
    </div>
  );
}
