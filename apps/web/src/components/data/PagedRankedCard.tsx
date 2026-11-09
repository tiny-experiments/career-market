import { useState } from "react";
import { MarketCard } from "@/components/data/MarketCard";
import { RankedList, type RankedItem } from "@/components/data/RankedList";

const PER_PAGE = 5;

/** A market card holding a ranked list, stepped through five rows at a time. */
export function PagedRankedCard({
  title,
  to,
  items,
  empty,
}: {
  readonly title: string;
  readonly to: string;
  readonly items: readonly RankedItem[];
  /** Said in place of the list when nothing qualifies. */
  readonly empty: string;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const shown = items.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <MarketCard
      title={title}
      to={to}
      pager={{
        page: current,
        pageCount,
        onPrev: () => setPage(current - 1),
        onNext: () => setPage(current + 1),
      }}
    >
      {items.length === 0 ? (
        <p className="py-8 text-center text-small text-muted-foreground">
          {empty}
        </p>
      ) : (
        <RankedList items={shown} />
      )}
    </MarketCard>
  );
}
