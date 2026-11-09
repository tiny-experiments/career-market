import { read } from "./resource";
import type { SiteSearchResults } from "./types";

/** Queries shorter than this match too much to be worth asking. */
export const SEARCH_MIN_LENGTH = 2;

/** The API refuses anything longer, so every caller is cut to fit here. */
export const SEARCH_MAX_LENGTH = 80;

const clamped = (q: string) => q.trim().slice(0, SEARCH_MAX_LENGTH).trim();

export const siteSearch = (q: string, limit = 5) =>
  read<SiteSearchResults>("/api/search", {
    q: clamped(q),
    limit,
    roles: "1",
  });

/** Names only, for the Jobs company filter: no roles, so it stays quick. */
export const companySearch = (q: string, limit = 8) =>
  read<SiteSearchResults>("/api/search", {
    q: clamped(q),
    limit,
    roles: "0",
  });
