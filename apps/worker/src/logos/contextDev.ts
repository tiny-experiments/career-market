import { z } from 'zod';
import type { BrandHit } from './domain.ts';

const API_BASE = 'https://api.context.dev/v1';
const LOGO_ORIGIN = 'https://logos.context.dev/';
const TIMEOUT_MS = 20_000;

export class ContextDevError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ContextDevError';
  }
}

const brandSearchSchema = z.object({
  results: z.array(z.object({ domain: z.string(), name: z.string() })).default([]),
});

export type BrandSearch = (query: string) => Promise<BrandHit[]>;
export type LogoProbe = (domain: string) => Promise<'real' | 'monogram'>;

/** Brand search by company name; one credit per call. The key stays on the server. */
export function createBrandSearch(apiKey: string, fetchImpl: typeof fetch = fetch): BrandSearch {
  return async (query) => {
    const url = new URL(`${API_BASE}/brand/search`);
    url.searchParams.set('query', query.slice(0, 100));
    url.searchParams.set('autocomplete', 'false');
    const res = await fetchImpl(url, {
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new ContextDevError(`brand search answered ${res.status}`, res.status);
    return brandSearchSchema.parse(await res.json()).results;
  };
}

/**
 * Asks the logo service whether it holds a real mark for a domain, reading only the
 * response headers. A generated placeholder is replaced by our own monogram.
 */
export function createLogoProbe(clientId: string, referer: string, fetchImpl: typeof fetch = fetch): LogoProbe {
  return async (domain) => {
    const url = new URL(LOGO_ORIGIN);
    url.searchParams.set('publicClientId', clientId);
    url.searchParams.set('domain', domain);
    url.searchParams.set('type', 'icon');
    const res = await fetchImpl(url, {
      method: 'HEAD',
      headers: { referer },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new ContextDevError(`logo check answered ${res.status}`, res.status);
    // A placeholder reads "monogram" when generated and "hit" with a failure tag once cached.
    return res.headers.get('x-logolink-cache') === 'monogram' || res.headers.has('x-logolink-failure-etag') ? 'monogram' : 'real';
  };
}
