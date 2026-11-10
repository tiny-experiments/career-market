import { MarketCard } from "@/components/data/MarketCard";
import { Logo } from "@/components/data/Logo";
import { RankedList } from "@/components/data/RankedList";
import { Sparkline } from "@/components/data/Sparkline";
import { useCardPages } from "@/hooks";
import { professionHref, type ProfessionRow } from "@/lib/professions";
import { cn } from "@/lib/utils";

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
            items={rows.slice(start, end).map((row, index) => {
              const delta = change?.(row);
              return {
                rank: start + index + 1,
                logo: <Logo name={row.name} shape="square" size="sm" />,
                name: row.name,
                code: row.code,
                value: value(row),
                trend: (
                  <Sparkline
                    values={row.spark}
                    width={64}
                    height={24}
                    className="hidden xl:block"
                  />
                ),
                to: professionHref(row.code),
                ...(delta === undefined ? {} : { change: delta }),
              };
            })}
          />
        </div>
      )}
    </MarketCard>
  );
}
