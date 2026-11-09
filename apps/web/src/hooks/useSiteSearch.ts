import { useEffect, useState } from "react";
import {
  SEARCH_MIN_LENGTH,
  siteSearch,
  type SiteSearchResults,
} from "@/lib/api";
import { useResource } from "./useResource";

const TYPING_PAUSE_MS = 150;

export interface SiteSearchState {
  /** The latest answer, kept while the next one is on its way. */
  readonly results: SiteSearchResults | null;
  readonly loading: boolean;
}

/** Search as you type: asks once the typing pauses, and shows no gap between answers. */
export function useSiteSearch(query: string): SiteSearchState {
  const trimmed = query.trim();
  const [settled, setSettled] = useState(trimmed);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(trimmed), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const asking = settled.length >= SEARCH_MIN_LENGTH;
  const state = useResource(asking ? siteSearch(settled) : null);
  const [shown, setShown] = useState<SiteSearchResults | null>(null);
  if (state.data !== null && state.data !== shown) setShown(state.data);

  const active = trimmed.length >= SEARCH_MIN_LENGTH;
  return {
    results: active ? (state.data ?? shown) : null,
    loading: active && (settled !== trimmed || state.loading),
  };
}
