import { useSyncExternalStore } from "react";

/** Below Tailwind's `md` (48rem): a phone, where the market cards turn into mini tiles. */
const PHONE = "(max-width: 47.99rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const snapshot = () => window.matchMedia(PHONE).matches;

/**
 * Whether the screen is phone width, following rotation and resizes. Read on
 * the first render, so a phone never paints the desktop cards first.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
