import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { Page, PageQuery, Resource } from "@/lib/api";
import type { Failure } from "@/lib/failure";
import { LIST_PAGE_SIZE, pageFrom } from "@/lib/listFilters";
import { useResource } from "./useResource";

export interface PagedListState<P extends Page<unknown>> {
  /** The page on screen, kept while the next one loads; null on first load. */
  readonly data: P | null;
  readonly items: P["items"];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  /** A page is on its way: dim the rows, do not blank them. */
  readonly loading: boolean;
  readonly error: Failure | null;
  readonly setPage: (page: number) => void;
  readonly reload: () => void;
}

/**
 * One page of a list the API pages. The page number lives in the address, so
 * links share it and back and forward return to it. `list` builds the read
 * for a page; a link that changes the filters simply omits `page`.
 */
export function usePagedList<P extends Page<unknown>, F extends object>(
  list: (query: F & PageQuery) => Resource<P>,
  filters: F,
  pageSize: number = LIST_PAGE_SIZE,
): PagedListState<P> {
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params);
  const state = useResource(list({ ...filters, page, pageSize }));
  const [shown, setShown] = useState<P | null>(null);

  // Adjusting during render rather than in an effect: one render, not two.
  if (state.data !== null && state.data !== shown) setShown(state.data);
  const data = state.data ?? (state.error === null ? shown : null);

  const setPage = useCallback(
    (next: number, replace = false) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (next <= 1) updated.delete("page");
          else updated.set("page", String(next));
          return updated;
        },
        { replace },
      );
    },
    [setParams],
  );

  // A link past the end of a shrunken list: step back rather than show nothing.
  const answered = state.data;
  useEffect(() => {
    if (answered === null || answered.items.length > 0 || page <= 1) return;
    setPage(Math.ceil(answered.total / pageSize), true);
  }, [answered, page, pageSize, setPage]);

  const total = data?.total ?? 0;
  return {
    data,
    items: data?.items ?? [],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    loading: state.loading,
    error: state.error,
    setPage,
    reload: state.reload,
  };
}
