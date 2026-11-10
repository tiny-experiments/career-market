import { vi } from "vitest";

/** Below `md`, as `useIsMobile` asks; every other media query stays unmatched. */
const PHONE = "(max-width: 47.99rem)";

/** Renders as a phone would: `matchMedia` answers yes to the phone query only. Undone after each test. */
export function onPhone(): void {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: query === PHONE,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}
