import { useLayoutEffect, useState, type RefObject } from "react";

export interface IndicatorPosition {
  readonly left: number;
  readonly width: number;
}

/**
 * Where the 2 px underline sits under a row of links: measured from the
 * element inside `container` that matches `activeSelector`, re-measured when
 * `key` changes (the route) and when the row resizes. `null` means nothing is
 * active, and the bar hides.
 */
export function useSlidingIndicator(
  container: RefObject<HTMLElement | null>,
  activeSelector: string,
  key: string,
): IndicatorPosition | null {
  const [position, setPosition] = useState<IndicatorPosition | null>(null);

  useLayoutEffect(() => {
    const row = container.current;
    if (!row) return;

    const measure = () => {
      const active = row.querySelector<HTMLElement>(activeSelector);
      if (!active) {
        setPosition(null);
        return;
      }
      setPosition({ left: active.offsetLeft, width: active.offsetWidth });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [container, activeSelector, key]);

  return position;
}
