import { useCallback } from "react";
import { useSearchParams } from "react-router";
import type { SortDirection } from "@/components/data/DataTable";

/**
 * A table's sort, kept in the address as `?sort=&dir=`. Clicking the sorted
 * column flips it; another column starts from its own natural direction. A
 * new order starts again from the first page.
 */
export function useListSort(
  fallback: { readonly key: string; readonly direction: SortDirection },
  naturalDirection: (key: string) => SortDirection,
) {
  const [params, setParams] = useSearchParams();
  const key = params.get("sort") ?? fallback.key;
  const dir = params.get("dir");
  const direction: SortDirection =
    dir === "asc" || dir === "desc"
      ? dir
      : params.has("sort")
        ? naturalDirection(key)
        : fallback.direction;

  const onSort = useCallback(
    (next: string) => {
      setParams((previous) => {
        const updated = new URLSearchParams(previous);
        const nextDirection: SortDirection =
          next === key
            ? direction === "asc"
              ? "desc"
              : "asc"
            : naturalDirection(next);
        updated.set("sort", next);
        updated.set("dir", nextDirection);
        updated.delete("page");
        return updated;
      });
    },
    [direction, key, naturalDirection, setParams],
  );

  return { sort: { key, direction }, onSort };
}
