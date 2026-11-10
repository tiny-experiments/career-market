import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Delta } from "@/components/data/Delta";
import type { RankedItem } from "@/components/data/RankedList";
import { cn } from "@/lib/utils";

/** How many rows a mini list shows; the title opens the rest. */
export const MINI_LIST_ROWS = 3;

/**
 * A home-page list card shrunk for a phone's row of tiles: the title is the
 * door to the full list, then the top three rows, each a link with its figure
 * and change.
 */
export function MiniList({
  title,
  to,
  items,
  empty,
  className,
}: {
  readonly title: string;
  readonly to: string;
  readonly items: readonly RankedItem[];
  /** Said in place of the rows when nothing qualifies. */
  readonly empty: string;
  readonly className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex w-72 flex-col gap-1 rounded-lg bg-tile px-3 py-2.5",
        className,
      )}
    >
      <Link
        to={to}
        className="group/door inline-flex items-center gap-1 self-start rounded-sm text-sm font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        {title}
        <ChevronRight
          className="size-3.5 text-muted-foreground group-hover/door:text-primary"
          aria-hidden
        />
      </Link>
      {items.length === 0 ? (
        <p className="py-3 text-small text-muted-foreground">{empty}</p>
      ) : (
        <ol className="-mx-1.5 flex flex-col">
          {items.slice(0, MINI_LIST_ROWS).map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex h-8 items-center gap-2 rounded-md px-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.logo}
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {item.name}
                </span>
                <span className="shrink-0 font-medium">{item.value}</span>
                {item.change === undefined ? null : (
                  <span className="w-14 shrink-0 text-right">
                    <Delta value={item.change} size="sm" />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
