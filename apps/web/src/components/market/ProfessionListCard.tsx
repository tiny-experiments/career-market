import { MarketCard } from "@/components/data/MarketCard";
import { RankedList } from "@/components/data/RankedList";
import { useCardPages, useDataDay } from "@/hooks";
import type { ProfessionRow } from "@/lib/professions";
import { cn } from "@/lib/utils";
import { professionItems } from "./MarketRankedItems";

export interface ProfessionListCardProps {
  readonly title: string;
  readonly to: string;
  readonly rows: readonly ProfessionRow[];
  readonly value: (row: ProfessionRow) => string;
  /** A change to show after the value. */
  readonly change?: (row: ProfessionRow) => number | undefined;
  readonly empty: string;
  /** Roomier rows, for a card sitting beside a taller neighbour. */
  readonly comfortable?: boolean;
}

/**
 * A home-page door: a ranked screen of professions, a page at a time, as
 * many to a page as the card has room for.
 */
export function ProfessionListCard({
  title,
  to,
  rows,
  value,
  change,
  empty,
  comfortable = false,
}: ProfessionListCardProps) {
  const { listRef, start, end, pager } = useCardPages(rows.length);
  const day = useDataDay();

  return (
    <MarketCard title={title} to={to} pager={pager}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-small text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div
          ref={listRef}
          className={cn(
            "flex-1 lg:contain-size",
            comfortable ? "lg:min-h-rows-min" : "lg:min-h-rows-min-compact",
          )}
        >
          <RankedList
            density={comfortable ? "comfortable" : "compact"}
            items={professionItems(rows.slice(start, end), {
              value,
              change,
              start,
              trend: true,
              end: day,
            })}
          />
        </div>
      )}
    </MarketCard>
  );
}
