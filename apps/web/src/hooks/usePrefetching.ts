import { useEffect } from "react";
import { preloadPages, prefetchPath } from "@/lib/prefetch";

/** Long enough to skip links the pointer only crosses. */
const HOVER_INTENT_MS = 65;
const IDLE_FALLBACK_MS = 1500;

function whenIdle(work: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(work);
    return () => window.cancelIdleCallback(id);
  }
  const timer = setTimeout(work, IDLE_FALLBACK_MS);
  return () => clearTimeout(timer);
}

/**
 * Makes the next click instant. Once the app is idle the page chunks load, and
 * a link the pointer rests on (or the keyboard reaches) has its data fetched
 * ahead. One listener serves every link, so pages need nothing of their own.
 */
export function usePrefetching(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let armed: string | null = null;

    const disarm = () => {
      clearTimeout(timer);
      armed = null;
    };

    const arm = (event: Event) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.origin !== window.location.origin
      ) {
        disarm();
        return;
      }
      const href = `${link.pathname}${link.search}`;
      if (href === armed) return;
      disarm();
      armed = href;
      timer = setTimeout(() => prefetchPath(href), HOVER_INTENT_MS);
    };

    document.addEventListener("pointerover", arm, { passive: true });
    document.addEventListener("focusin", arm);
    const cancelIdle = whenIdle(preloadPages);

    return () => {
      disarm();
      cancelIdle();
      document.removeEventListener("pointerover", arm);
      document.removeEventListener("focusin", arm);
    };
  }, []);
}
