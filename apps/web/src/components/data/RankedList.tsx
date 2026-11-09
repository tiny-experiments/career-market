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
  /** A ratio against the comparison the card names. */
  readonly change?: number;
  readonly to: string;
}

/** Compact 40 px rows inside a card: rank, logo, name, figure, change. Each row is a link. */
export function RankedList({
  items,
  className,
}: {
  readonly items: readonly RankedItem[];
  readonly className?: string;
}) {
  return (
    <ol className={cn("-mx-2 flex flex-col", className)}>
      {items.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            className="flex h-row-compact items-center gap-3 rounded-lg px-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">
              {item.rank}
            </span>
            {item.logo}
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5 truncate">
              <span className="truncate font-semibold">{item.name}</span>
              {item.code === undefined ? null : (
                <span className="truncate text-xs text-muted-foreground">
                  {item.code}
                </span>
              )}
            </span>
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
