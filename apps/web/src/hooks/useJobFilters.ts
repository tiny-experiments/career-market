import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { FILTER_PARAMS, type FilterPatch } from "@/lib/jobFilters";

export interface JobFiltersState {
  readonly params: URLSearchParams;
  /** Applies a change and goes back to the first page, keeping the scroll. */
  readonly update: (patch: FilterPatch) => void;
  readonly clear: () => void;
  /** The address these filters would have on another page of results. */
  readonly hrefFor: (page: number) => string;
}

/** The Jobs filters live in the address, so a filtered list can be shared. */
export function useJobFilters(): JobFiltersState {
  const [params, setParams] = useSearchParams();

  const update = useCallback(
    (patch: FilterPatch) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("page");
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { preventScrollReset: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    update(Object.fromEntries(FILTER_PARAMS.map((key) => [key, null])));
  }, [update]);

  const hrefFor = useCallback(
    (page: number) => {
      const next = new URLSearchParams(params);
      if (page <= 1) next.delete("page");
      else next.set("page", String(page));
      const suffix = next.toString();
      return suffix === "" ? "/jobs" : `/jobs?${suffix}`;
    },
    [params],
  );

  return useMemo(
    () => ({ params, update, clear, hrefFor }),
    [params, update, clear, hrefFor],
  );
}
