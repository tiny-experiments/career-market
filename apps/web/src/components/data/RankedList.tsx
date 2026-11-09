import type { ReactNode } from "react";
import { Link } from "react-router";
import { Delta } from "@/components/data/Delta";
import { cn } from "@/lib/utils";

export interface RankedItem {
  readonly rank: number;
  readonly logo?: ReactNode;
  readonly name: string;
  /** The code or domain in muted type after the name. */
  readonly code?: string;
  readonly value: string;
  /** A small chart between the name and the figure, when there is room. */
  readonly trend?: ReactNode;
  /** A ratio against the comparison the card names. */
  readonly change?: number;
  readonly to: string;
}

/**
 * Rows inside a card: rank, logo, name, figure, change. Each row is a link.
 * Compact is 40 px with the code beside the name; comfortable is 52 px with
 * the code under it.
 */
export function RankedList({
  items,
  density = "compact",
  className,
}: {
  readonly items: readonly RankedItem[];
  readonly density?: "compact" | "comfortable";
  readonly className?: string;
}) {
  const comfortable = density === "comfortable";
  return (
    <ol className={cn("-mx-2 flex flex-col", className)}>
      {items.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              comfortable ? "h-row" : "h-row-compact",
            )}
          >
            <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">
              {item.rank}
            </span>
            {item.logo}
            <span
              className={cn(
                "flex min-w-0 flex-1 truncate",
                comfortable ? "flex-col" : "items-baseline gap-1.5",
              )}
            >
              <span className="truncate font-semibold">{item.name}</span>
              {item.code === undefined ? null : (
                <span className="truncate text-xs text-muted-foreground">
                  {item.code}
                </span>
              )}
            </span>
            {item.trend}
            <span className="shrink-0 font-medium">{item.value}</span>
            {item.change === undefined ? null : (
              <span className="w-16 shrink-0 text-right">
                <Delta value={item.change} size="sm" />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}
