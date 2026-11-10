import { useCallback } from "react";
import { useSearchParams } from "react-router";

const PAGE_ONLY: readonly string[] = ["page"];

/**
 * A table's filter, kept in the address as one query parameter so a filtered
 * table can be shared and back and forward step through the choices. The
 * default choice leaves the parameter out. A new choice drops the page and
 * whatever else `reset` names (a column sort, say), and keeps the scroll.
 */
export function useTableFilter<T extends string>(
  name: string,
  values: readonly T[],
  fallback: T,
  reset: readonly string[] = PAGE_ONLY,
): readonly [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const current = params.get(name);
  const value = values.find((candidate) => candidate === current) ?? fallback;

  const choose = useCallback(
    (next: T) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (next === fallback) updated.delete(name);
          else updated.set(name, next);
          for (const key of reset) updated.delete(key);
          return updated;
        },
        { preventScrollReset: true },
      );
    },
    [fallback, name, reset, setParams],
  );

  return [value, choose] as const;
}
