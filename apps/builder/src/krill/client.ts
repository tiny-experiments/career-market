import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '@cm/core/logger';
import type { z } from 'zod';

export class KrillHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`krill ${status} for ${url}: ${body.slice(0, 200)}`);
    this.name = 'KrillHttpError';
  }
}

export interface KrillClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  ratePerMinute: number;
  /** Disk cache root; responses are cached per namespace (the snapshot day). */
  cacheDir?: string | undefined;
  timeoutMs: number;
  logger: Logger;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

export type Params = Record<string, string | number | undefined>;

interface CachedResponse {
  status: number;
  body: string;
}

const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 5;

/**
 * Read-only krill client. One request at a time, paced under the rate limit
 * (60/min anonymous, 600/min with a key), honouring RateLimit-* headers and
 * Retry-After. Successful responses are cached on disk per snapshot day so a
 * rerun of the same day costs no krill calls.
 */
export class KrillClient {
  private readonly minIntervalMs: number;
  private nextSlot = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private namespace: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  calls = 0;
  cacheHits = 0;

  constructor(private readonly opts: KrillClientOptions) {
    this.minIntervalMs = Math.ceil(60_000 / opts.ratePerMinute);
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Cache responses under this key (the krill snapshot day) until changed. */
  setCacheNamespace(namespace: string | undefined): void {
    this.namespace = namespace;
  }

  url(pathname: string, params: Params = {}): string {
    const url = new URL(pathname, `${this.opts.baseUrl}/`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  /**
   * GET and parse. `acceptStatuses` lists non-2xx statuses whose body is still
   * a valid answer (krill serves a closed job as 410 with a tombstone).
   */
  async get<S extends z.ZodTypeAny>(
    pathname: string,
    params: Params,
    schema: S,
    options: { cache?: boolean; acceptStatuses?: number[] } = {},
  ): Promise<{ status: number; data: z.infer<S> }> {
    const url = this.url(pathname, params);
    const accept = new Set([200, ...(options.acceptStatuses ?? [])]);
    const useCache = options.cache !== false && this.namespace !== undefined && this.opts.cacheDir !== undefined;

    let response = useCache ? await this.readCache(url) : undefined;
    if (response) this.cacheHits++;
    else {
      response = await this.enqueue(() => this.fetchWithRetry(url));
      if (accept.has(response.status) && useCache) await this.writeCache(url, response);
    }
    if (!accept.has(response.status)) throw new KrillHttpError(response.status, url, response.body);
    let json: unknown;
    try {
      json = JSON.parse(response.body);
    } catch {
      throw new KrillHttpError(response.status, url, `invalid JSON: ${response.body.slice(0, 100)}`);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`krill response for ${url} failed validation: ${parsed.error.message}`);
    }
    return { status: response.status, data: parsed.data };
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async fetchWithRetry(url: string): Promise<CachedResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const wait = this.nextSlot - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.nextSlot = Date.now() + this.minIntervalMs;
      this.calls++;
      try {
        const res = await this.fetchImpl(url, {
          headers: {
            accept: 'application/json',
            'user-agent': this.opts.userAgent ?? 'career-market-builder',
            ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(this.opts.timeoutMs),
        });
        const body = await res.text();
        this.respectRateHeaders(res.headers);
        if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
          const delay = retryDelayMs(res.headers, attempt);
          this.opts.logger.warn({ url, status: res.status, delay }, 'krill busy, retrying');
          await this.sleep(delay);
          continue;
        }
        return { status: res.status, body };
      } catch (err) {
        lastError = err;
        if (attempt === MAX_ATTEMPTS) break;
        const delay = 2_000 * attempt;
        this.opts.logger.warn({ url, err: String(err), delay }, 'krill request failed, retrying');
        await this.sleep(delay);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`krill request failed: ${url}`);
  }

  /** When the window is nearly spent, hold the next call until it resets. */
  private respectRateHeaders(headers: Headers): void {
    const remaining = Number(headers.get('ratelimit-remaining'));
    const reset = Number(headers.get('ratelimit-reset'));
    if (Number.isFinite(remaining) && remaining <= 1 && Number.isFinite(reset) && reset > 0) {
      this.nextSlot = Math.max(this.nextSlot, Date.now() + reset * 1000);
    }
  }

  private cachePath(url: string): string {
    const key = createHash('sha256').update(url).digest('hex').slice(0, 32);
    return path.join(this.opts.cacheDir as string, this.namespace as string, `${key}.json`);
  }

  private async readCache(url: string): Promise<CachedResponse | undefined> {
    try {
      const cached = JSON.parse(await readFile(this.cachePath(url), 'utf8')) as CachedResponse & { url: string };
      return cached.url === url ? cached : undefined;
    } catch {
      return undefined;
    }
  }

  private async writeCache(url: string, response: CachedResponse): Promise<void> {
    const file = this.cachePath(url);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ url, ...response }));
  }
}

export function retryDelayMs(headers: Headers, attempt: number): number {
  const retryAfter = Number(headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  const reset = Number(headers.get('ratelimit-reset'));
  if (Number.isFinite(reset) && reset > 0) return reset * 1000;
  return Math.min(60_000, 2_000 * 2 ** (attempt - 1));
}
