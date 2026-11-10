import { vi } from "vitest";

/**
 * A `prefers-color-scheme: dark` query the test can flip, standing in for the
 * device switching between light and dark.
 */
export function stubDeviceTheme(dark: boolean) {
  let matches = dark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const list = (query: string): MediaQueryList => ({
    get matches() {
      return query.includes("prefers-color-scheme: dark") ? matches : false;
    },
    media: query,
    onchange: null,
    addListener: (listener) => {
      if (listener) listeners.add(listener as never);
    },
    removeListener: (listener) => {
      if (listener) listeners.delete(listener as never);
    },
    addEventListener: (_type: string, listener: unknown) => {
      listeners.add(listener as never);
    },
    removeEventListener: (_type: string, listener: unknown) => {
      listeners.delete(listener as never);
    },
    dispatchEvent: () => false,
  });
  vi.stubGlobal("matchMedia", list);
  return {
    set(dark: boolean) {
      matches = dark;
      const event = { matches: dark, media: "(prefers-color-scheme: dark)" };
      for (const listener of [...listeners]) {
        listener(event as MediaQueryListEvent);
      }
    },
  };
}
