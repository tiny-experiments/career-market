import 'server-only';
import { loadConfig, requireReadApiToken } from '@cm/core/config';
import type { ScreenerPayload, SearchResults, RoleHit } from '@cm/core/screener';
import type { ChromePayload, MarketOverview } from '@cm/core/types';

/**
 * Server-side client for the read API. Pages never touch Postgres and the
 * browser never sees the token. Responses are cached for an hour and tagged so
 * the builder can expire them right after a nightly build (/api/revalidate).
 */
export const READ_MODEL_TAG = 'read-model';
const REVALIDATE_SECONDS = 3600;

export type ReadResult<T> = { ok: true; data: T } | { ok: false; status: number | null; reason: string };

async function get<T>(path: string, options: { revalidate?: number } = {}): Promise<ReadResult<T>> {
  const config = loadConfig();
  let res: Response;
  try {
    res = await fetch(`${config.readApi.url}${path}`, {
      headers: { authorization: `Bearer ${requireReadApiToken(config)}`, accept: 'application/json' },
      next: { revalidate: options.revalidate ?? REVALIDATE_SECONDS, tags: [READ_MODEL_TAG] },
    });
  } catch (err) {
    return { ok: false, status: null, reason: `read API unreachable: ${String(err)}` };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, status: res.status, reason: body.message ?? res.statusText };
  }
  return { ok: true, data: (await res.json()) as T };
}

export const getChrome = () => get<ChromePayload>('/v1/chrome');
export const getMarketOverview = () => get<MarketOverview>('/v1/market');

/** The Screener for a URL query string (filters, mode, sort); live counts under filters are cached by the read API. */
export const getScreener = (search: string) => get<ScreenerPayload>(`/v1/screener${search ? `?${search}` : ''}`);

export type SearchPayload = SearchResults & { roles: RoleHit[]; rolesUnavailable?: boolean };

/** Typeahead and full-page search. Short cache: queries are open-ended, the read API caches krill calls. */
export const getSearch = (q: string, opts: { limit?: number; roles?: boolean } = {}) =>
  get<SearchPayload>(`/v1/search?q=${encodeURIComponent(q)}&limit=${opts.limit ?? 5}${opts.roles ? '&roles=1' : ''}`, { revalidate: 300 });
