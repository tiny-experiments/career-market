import type { ReactNode } from "react";
import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Delta } from "@/components/data/Delta";
import { cn } from "@/lib/utils";

export interface KpiTileProps {
  readonly label: string;
  readonly value: ReactNode;
  /** A ratio against the comparison the hint names. */
  readonly change?: number;
  readonly hint?: { readonly text: string; readonly formula?: string };
  readonly className?: string;
}

/** A small fact inside a market card: label on top, bold figure, the change beside it. */
export function KpiTile({
  label,
  value,
  change,
  hint,
  className,
}: KpiTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg bg-tile px-3 py-2.5",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-eyebrow font-semibold text-muted-foreground">
        <span className="min-w-0">{label}</span>
        {hint ? (
          <MetricHoverCard
            title={label}
            {...(hint.formula ? { formula: hint.formula } : {})}
          >
            {hint.text}
          </MetricHoverCard>
        ) : null}
      </span>
      <span className="inline-flex items-baseline gap-2 text-sm font-bold">
        {value}
        {change === undefined ? null : <Delta value={change} size="sm" />}
      </span>
    </div>
  );
}
