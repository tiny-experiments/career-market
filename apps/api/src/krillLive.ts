import type { Logger } from '@cm/core/logger';
import type { z } from 'zod';

/**
 * krill answers for requests the nightly build cannot precompute: filtered
 * facets, the matching jobs list and company name search. Every answer is
 * parsed with zod, cached in memory for an hour (one entry per request), and a
 * request already in flight is shared. Failures are remembered for a short
 * time so a busy or failing krill is not hit again on every page view.
 */
export class KrillLiveError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'KrillLiveError';
  }
}

export interface KrillLiveOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  timeoutMs?: number;
  ttlMs?: number;
  failureTtlMs?: number;
  maxEntries?: number;
  log: Logger;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** A page view waits at most this long for krill's rate limit to reopen. */
const MAX_RETRY_WAIT_MS = 20_000;
const MAX_TRIES = 3;

type Entry = { at: number; ttl: number } & ({ ok: true; data: unknown } | { ok: false; error: KrillLiveError });

export class KrillLive {
  private readonly cache = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: KrillLiveOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  url(pathname: string, params: Record<string, string | number | undefined>): string {
    const url = new URL(pathname, `${this.opts.baseUrl.replace(/\/+$/, '')}/`);
    for (const key of Object.keys(params).sort()) {
      const v = params[key];
      if (v !== undefined && v !== '') url.searchParams.set(key, String(v));
    }
    return url.toString();
  }

  async get<S extends z.ZodTypeAny>(
    pathname: string,
    params: Record<string, string | number | undefined>,
    schema: S,
  ): Promise<z.infer<S>> {
    const url = this.url(pathname, params);
    const hit = this.cache.get(url);
    if (hit && this.now() - hit.at < hit.ttl) {
      if (hit.ok) return hit.data as z.infer<S>;
      throw hit.error;
    }
    const running = this.inflight.get(url);
    if (running) return running as Promise<z.infer<S>>;
    const task = this.fetchOnce(url, schema).finally(() => this.inflight.delete(url));
    this.inflight.set(url, task);
    return task;
  }

  private async fetchOnce<S extends z.ZodTypeAny>(url: string, schema: S): Promise<z.infer<S>> {
    try {
      let res: Response | undefined;
      for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        res = await this.fetchImpl(url, {
          headers: {
            accept: 'application/json',
            'user-agent': 'career-market-read-api',
            ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 20_000),
        });
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 + 250 : 0;
        // krill's rate limit reopens within seconds: wait for it rather than fail the page view.
        if (res.status === 429 && attempt < MAX_TRIES && wait > 0 && wait <= MAX_RETRY_WAIT_MS) {
          await this.sleep(wait);
          continue;
        }
        break;
      }
      if (!res) throw new KrillLiveError(null, 'krill did not answer');
      if (!res.ok) {
        const retryAfter = Number(res.headers.get('retry-after'));
        throw new KrillLiveError(res.status, res.status === 429 ? `krill is busy${retryAfter ? `; retry in ${retryAfter}s` : ''}` : `krill answered ${res.status}`);
      }
      const parsed = schema.safeParse(await res.json());
      if (!parsed.success) throw new KrillLiveError(res.status, 'krill answered with an unexpected shape');
      this.remember(url, { at: this.now(), ttl: this.opts.ttlMs ?? 3_600_000, ok: true, data: parsed.data });
      return parsed.data;
    } catch (err) {
      const error = err instanceof KrillLiveError ? err : new KrillLiveError(null, `krill unreachable: ${String(err)}`);
      this.opts.log.warn({ url, status: error.status, message: error.message }, 'krill live call failed');
      this.remember(url, { at: this.now(), ttl: this.opts.failureTtlMs ?? 20_000, ok: false, error });
      throw error;
    }
  }

  private remember(url: string, entry: Entry): void {
    this.cache.delete(url);
    this.cache.set(url, entry);
    const max = this.opts.maxEntries ?? 500;
    while (this.cache.size > max) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
