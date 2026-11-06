import type { IsoDay } from '@cm/core/dates';
import type { Logger } from '@cm/core/logger';
import {
  krillCompanyDailySchema,
  krillCompanySchema,
  krillJobDetailSchema,
  krillJobPageSchema,
  krillTombstoneSchema,
  type KrillCompany,
  type KrillCompanyDaily,
  type KrillJobDetail,
  type KrillJobPage,
  type KrillTombstone,
} from '@cm/core/krillJob';
import type { z } from 'zod';

/**
 * krill answers for requests the nightly build cannot precompute: filtered
 * facets, the matching jobs list, company name search and the Job page's
 * posting text. Every answer is parsed with zod, cached in memory for an hour
 * (one entry per request), and a request already in flight is shared. Failures
 * are remembered for a short time so a busy or failing krill is not hit again
 * on every page view; a stale answer is served in place of a failure. Calls
 * are paced under krill's per-minute limit when a rate is given.
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

export type JobLookup = { kind: 'open'; job: KrillJobDetail } | { kind: 'closed'; tombstone: KrillTombstone } | { kind: 'missing' };

export interface KrillLiveOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  /** Requests per minute this client allows itself; unset means no pacing. */
  ratePerMinute?: number | undefined;
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
type Raw = { status: number; json: unknown };

export class KrillLive {
  private readonly cache = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly minIntervalMs: number;
  private nextSlot = 0;

  constructor(private readonly opts: KrillLiveOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.minIntervalMs = opts.ratePerMinute ? Math.ceil(60_000 / opts.ratePerMinute) : 0;
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
    return this.cached(url, async () => parse(schema, await this.fetchJson(url, [])));
  }

  /** An open job with its text, a closed job's tombstone, or neither. */
  async job(id: string): Promise<JobLookup> {
    const url = this.url(`/v1/jobs/${encodeURIComponent(id)}`, {});
    return this.cached(url, async (): Promise<JobLookup> => {
      // krill answers 400 for an id it cannot be (wrong length), 404 for one it does not know.
      const res = await this.fetchJson(url, [400, 404, 410]);
      if (res.status === 400 || res.status === 404) return { kind: 'missing' };
      if (res.status === 410) return { kind: 'closed', tombstone: parse(krillTombstoneSchema, res) };
      return { kind: 'open', job: parse(krillJobDetailSchema, res) };
    });
  }

  async company(id: string): Promise<KrillCompany | null> {
    const url = this.url(`/v1/companies/${encodeURIComponent(id)}`, {});
    return this.cached(url, async () => {
      const res = await this.fetchJson(url, [404]);
      return res.status === 404 ? null : parse(krillCompanySchema, res);
    });
  }

  /** Daily open/new/closed counts for one company (krill K2), oldest first. */
  async companyDaily(companyId: string, from: IsoDay, to: IsoDay): Promise<KrillCompanyDaily['items']> {
    const items = await this.get('/v1/stats/companies/daily', { company: companyId, from, to }, krillCompanyDailySchema);
    return [...items.items].sort((a, b) => a.date.localeCompare(b.date));
  }

  async jobs(params: Record<string, string | number | undefined>): Promise<KrillJobPage['items']> {
    return (await this.get('/v1/jobs', params, krillJobPageSchema)).items;
  }

  private async cached<T>(url: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(url);
    if (hit && this.now() - hit.at < hit.ttl) {
      if (hit.ok) return hit.data as T;
      throw hit.error;
    }
    const running = this.inflight.get(url);
    if (running) return running as Promise<T>;
    const task = load()
      .then((data) => {
        this.remember(url, { at: this.now(), ttl: this.opts.ttlMs ?? 3_600_000, ok: true, data });
        return data;
      })
      .catch((err) => {
        const error = err instanceof KrillLiveError ? err : new KrillLiveError(null, `krill unreachable: ${String(err)}`);
        this.opts.log.warn({ url, status: error.status, message: error.message }, 'krill live call failed');
        const ttl = this.opts.failureTtlMs ?? 20_000;
        // krill is down or limiting us: serve the last good answer rather than an error page.
        if (hit?.ok) {
          this.remember(url, { at: this.now(), ttl, ok: true, data: hit.data });
          return hit.data as T;
        }
        this.remember(url, { at: this.now(), ttl, ok: false, error });
        throw error;
      })
      .finally(() => this.inflight.delete(url));
    this.inflight.set(url, task);
    return task;
  }

  private async fetchJson(url: string, accept: number[]): Promise<Raw> {
    let res: Response | undefined;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      await this.pace();
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
    if (!res.ok && !accept.includes(res.status)) {
      const retryAfter = Number(res.headers.get('retry-after'));
      throw new KrillLiveError(res.status, res.status === 429 ? `krill is busy${retryAfter ? `; retry in ${retryAfter}s` : ''}` : `krill answered ${res.status}`);
    }
    return { status: res.status, json: await res.json() };
  }

  /** Reserves the next slot under the per-minute limit and waits for it. */
  private async pace(): Promise<void> {
    if (!this.minIntervalMs) return;
    const wait = this.nextSlot - this.now();
    if (wait > 0) await this.sleep(wait);
    this.nextSlot = Math.max(this.nextSlot, this.now()) + this.minIntervalMs;
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

function parse<S extends z.ZodTypeAny>(schema: S, res: Raw): z.infer<S> {
  const parsed = schema.safeParse(res.json);
  if (!parsed.success) throw new KrillLiveError(res.status, 'krill answered with an unexpected shape');
  return parsed.data;
}
