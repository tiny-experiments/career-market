import type { ReactNode } from "react";
import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Delta } from "@/components/data/Delta";
import { cn } from "@/lib/utils";

export interface MiniStatProps {
  readonly label: string;
  readonly value: ReactNode;
  /** A ratio against the comparison `suffix` names. */
  readonly change?: number;
  /** The comparison in words after the change: "this week". */
  readonly suffix?: string;
  /** A few words under the figure when there is no change to show. */
  readonly caption?: string;
  /** The figure's one-sentence meaning, behind the (i). */
  readonly hint?: { readonly text: string; readonly formula?: string };
  /** The figure's colour, when the colour is the meaning (a hiring signal). */
  readonly tone?: "up" | "down" | "warn";
  /** Where the tile goes; the whole tile is the target. */
  readonly to?: string;
  /** A tiny picture under the figure: a sparkline in place of a chart. */
  readonly children?: ReactNode;
  readonly className?: string;
}

const TONE = { up: "text-up", down: "text-down", warn: "text-warn" } as const;

/**
 * A desktop card's headline, shrunk for a phone's row of tiles: label, bold
 * figure, a small change or caption under it. The (i) sits beside the link,
 * never inside it, and a tap on it opens the same sentence the hover card shows.
 */
export function MiniStat({
  label,
  value,
  change,
  suffix,
  caption,
  hint,
  tone,
  to,
  children,
  className,
}: MiniStatProps) {
  const body = (
    <>
      <span
        className={cn(
          "truncate text-eyebrow font-semibold text-muted-foreground",
          hint && "pr-5",
        )}
      >
        {label}
      </span>
      <span
        className={cn("truncate text-h2 font-extrabold", tone && TONE[tone])}
      >
        {value}
      </span>
      {change === undefined ? null : (
        <Delta value={change} size="sm" {...(suffix ? { suffix } : {})} />
      )}
      {caption === undefined ? null : (
        <span className="truncate text-eyebrow text-muted-foreground">
          {caption}
        </span>
      )}
      {children}
    </>
  );
  const box = "flex h-full flex-col gap-0.5 rounded-lg bg-tile px-3 py-2.5";

  return (
    <div className={cn("relative w-40", className)}>
      {to === undefined ? (
        <div className={box}>{body}</div>
      ) : (
        <Link
          to={to}
          className={cn(
            box,
            "outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {body}
        </Link>
      )}
      {hint ? (
        <MetricHoverCard
          title={label}
          className="absolute top-2.5 right-2.5"
          {...(hint.formula ? { formula: hint.formula } : {})}
        >
          {hint.text}
        </MetricHoverCard>
      ) : null}
    </div>
  );
}
