import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

export interface ChartScrubOptions {
  /** Blank space, in px, between each side of the box and the first or last point. */
  readonly inset?: number;
  /** Let go when the page scrolls: for a reading drawn outside the chart's own box. */
  readonly releaseOnScroll?: boolean;
}

/**
 * Which point of a chart the reader is on. A mouse reads the point under it
 * and lets go on leaving; a finger taps or slides along the chart and the
 * reading stays until the next tap elsewhere; arrow keys step a day at a time.
 * A tap reads the chart instead of following a link the chart sits in.
 */
export function useChartScrub(
  count: number,
  { inset = 0, releaseOnScroll = false }: ChartScrubOptions = {},
) {
  const box = useRef<HTMLElement | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  // Where the chart sat on screen when the point was picked, for a reading
  // drawn outside the chart's own box.
  const [rect, setRect] = useState<DOMRect | null>(null);
  const touched = useRef(false);
  const index = picked !== null && picked < count ? picked : null;
  const active = index !== null;

  useEffect(() => {
    if (!active) return;
    const away = (event: globalThis.PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setPicked(null);
    };
    const release = () => setPicked(null);
    document.addEventListener("pointerdown", away);
    if (releaseOnScroll)
      window.addEventListener("scroll", release, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", release, { capture: true });
    };
  }, [active, releaseOnScroll]);

  const pick = (event: PointerEvent<HTMLElement>) => {
    if (count < 1) return;
    const box = event.currentTarget.getBoundingClientRect();
    const span = box.width - inset * 2;
    const ratio = span > 0 ? (event.clientX - box.left - inset) / span : 0;
    const at = Math.round(ratio * (count - 1));
    setRect(box);
    setPicked(Math.min(Math.max(at, 0), count - 1));
  };

  return {
    index,
    rect: index === null ? null : rect,
    handlers: {
      ref: (element: HTMLElement | null) => {
        box.current = element;
      },
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        touched.current = event.pointerType === "touch";
        pick(event);
      },
      onPointerMove: pick,
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") setPicked(null);
      },
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (!touched.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
    },
    /** Arrow keys for a chart the reader can tab to. */
    keys: {
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (count < 1) return;
        setRect(event.currentTarget.getBoundingClientRect());
        const step =
          event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (event.key === "Escape") setPicked(null);
        if (event.key === "Home") setPicked(0);
        if (event.key === "End") setPicked(count - 1);
        if (step !== 0)
          setPicked((current) =>
            current === null || current >= count
              ? count - 1
              : Math.min(Math.max(current + step, 0), count - 1),
          );
        if (step !== 0 || event.key === "Home" || event.key === "End")
          event.preventDefault();
      },
      onBlur: () => setPicked(null),
    },
  };
}
