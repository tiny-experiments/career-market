import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { rowsThatFit } from "@/lib/paging";

/** The fewest rows a Market card's list shows; `--spacing-rows-min` matches it. */
export const CARD_MIN_ROWS = 5;

/** Tailwind's `lg`: from here the list's box fills the card (see `index.css`). */
const DESKTOP = "(min-width: 64rem)";

export interface CardPages {
  /** The list's box: it fills the card on desktop and is measured for rows. */
  readonly listRef: RefObject<HTMLDivElement | null>;
  /** The first and one-past-last row on screen. */
  readonly start: number;
  readonly end: number;
  readonly pager: {
    readonly page: number;
    readonly pageCount: number;
    readonly onPrev: () => void;
    readonly onNext: () => void;
  };
}

/**
 * Pages a card's ranked rows, as many to a page as the list's box holds. On
 * desktop the box takes the card's spare height without adding to it (the
 * card is as tall as its tallest neighbour), so the rows fill it; elsewhere
 * the box is only as tall as its rows and a page stays at five.
 */
export function useCardPages(total: number): CardPages {
  const listRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(CARD_MIN_ROWS);
  const [page, setPage] = useState(1);
  const hasRows = total > 0;

  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const desktop = window.matchMedia(DESKTOP);
    const measure = () => {
      // Below `lg` the box is only as tall as its rows, so measuring it would
      // keep a page size taken on desktop.
      if (!desktop.matches) {
        setPageSize(CARD_MIN_ROWS);
        return;
      }
      const row = element.querySelector("li");
      setPageSize(
        rowsThatFit(
          element.getBoundingClientRect().height,
          row?.getBoundingClientRect().height ?? 0,
          CARD_MIN_ROWS,
        ),
      );
    };
    measure();
    desktop.addEventListener("change", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => desktop.removeEventListener("change", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", measure);
    };
  }, [hasRows]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // A wider page can leave fewer pages than the one being read.
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;

  return {
    listRef,
    start,
    end: start + pageSize,
    pager: {
      page: current,
      pageCount,
      onPrev: () => setPage(Math.max(1, current - 1)),
      onNext: () => setPage(Math.min(pageCount, current + 1)),
    },
  };
}
