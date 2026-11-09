import { read } from "./resource";
import type { SiteSearchResults } from "./types";

/** Queries shorter than this match too much to be worth asking. */
export const SEARCH_MIN_LENGTH = 2;

export const siteSearch = (q: string, limit = 5) =>
  read<SiteSearchResults>("/api/search", { q, limit, roles: "1" });
