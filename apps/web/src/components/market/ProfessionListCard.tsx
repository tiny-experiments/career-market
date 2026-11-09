import { useState } from "react";
import { MarketCard } from "@/components/data/MarketCard";
import { Logo } from "@/components/data/Logo";
import { RankedList } from "@/components/data/RankedList";
import { Sparkline } from "@/components/data/Sparkline";
import { professionHref, type ProfessionRow } from "@/lib/professions";

const PAGE_SIZE = 5;

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

/** A home-page door: a ranked screen of professions, a page at a time. */
export function ProfessionListCard({
  title,
  to,
  rows,
  value,
  change,
  empty,
  comfortable = false,
}: ProfessionListCardProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;

  return (
    <MarketCard
      title={title}
      to={to}
      pager={{
        page,
        pageCount,
        onPrev: () => setPage((p) => Math.max(1, p - 1)),
        onNext: () => setPage((p) => Math.min(pageCount, p + 1)),
      }}
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-small text-muted-foreground">
          {empty}
        </p>
      ) : (
        <RankedList
          density={comfortable ? "comfortable" : "compact"}
          items={rows.slice(start, start + PAGE_SIZE).map((row, index) => {
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
      )}
    </MarketCard>
  );
}
