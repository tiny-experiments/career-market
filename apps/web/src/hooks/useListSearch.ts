import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

const DELAY_MS = 220;

/**
 * A list's search box, kept in the address as `?q=`: typing updates the field
 * at once and the address a beat later, and a link that clears `q` clears the
 * field. A new query starts again from the first page.
 */
export function useListSearch(): readonly [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const inAddress = params.get("q") ?? "";
  const [value, setValue] = useState(inAddress);
  const [seen, setSeen] = useState(inAddress);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Adjusting during render: the address moved on its own (a tab, back).
  if (inAddress !== seen) {
    setSeen(inAddress);
    setValue(inAddress);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          const q = next.trim();
          if (q) updated.set("q", q);
          else updated.delete("q");
          updated.delete("page");
          return updated;
        },
        { replace: true },
      );
    }, DELAY_MS);
  };

  return [value, change];
}
