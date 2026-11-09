import { buildPath, request, type Query, type RequestOptions } from "./client";

/**
 * One readable thing and the shared memory of it. A `Resource` is a key and a
 * way to load it; the store below keeps the last answer per key, joins
 * concurrent reads into one request, and tells every reader when it changes.
 * Going back to a page within a minute shows it without touching the network.
 */

export interface Resource<T> {
  /** The request's URL, so two readers of one thing can never disagree. */
  readonly key: string;
  readonly load: (signal: AbortSignal) => Promise<T>;
}

/** A resource at an API path. Module files build every read with this. */
export function read<T>(
  path: string,
  query?: Query,
  options?: Pick<RequestOptions, "accept">,
): Resource<T> {
  return {
    key: buildPath(path, query),
    load: (signal) => request<T>(path, { query, signal, ...options }),
  };
}

/** An answer this young is used as it is. Matches the API's `max-age`. */
export const FRESH_MS = 60_000;
/** An older answer is still shown at once, and replaced when a new one lands. */
export const KEEP_MS = 10 * 60_000;
/** A read that just failed is not repeated on its own; "Try again" still can. */
export const FAILED_MS = 5_000;
const MAX_ENTRIES = 200;

export interface ResourceEntry<T = unknown> {
  readonly data: T | undefined;
  readonly error: unknown;
  /** When `data` arrived; 0 before any did. */
  readonly fetchedAt: number;
  /** When `error` arrived; 0 when there is none. */
  readonly failedAt: number;
  /** A request for this key is on its way. */
  readonly pending: boolean;
}

interface Flight {
  readonly controller: AbortController;
  holders: number;
}

const entries = new Map<string, ResourceEntry>();
const flights = new Map<string, Flight>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  listeners.get(key)?.forEach((listener) => listener());
}

/** Forgets the longest-untouched answers nobody is looking at. */
function trim(): void {
  if (entries.size <= MAX_ENTRIES) return;
  for (const key of entries.keys()) {
    if (entries.size <= MAX_ENTRIES) return;
    if (!listeners.has(key) && !flights.has(key)) entries.delete(key);
  }
}

function write(key: string, entry: ResourceEntry): void {
  entries.delete(key);
  entries.set(key, entry);
  trim();
  notify(key);
}

/** The last answer for a key, unless it has grown too old to show. */
export function peek<T>(key: string): ResourceEntry<T> | undefined {
  const entry = entries.get(key);
  if (entry === undefined) return undefined;
  const expired =
    !entry.pending &&
    entry.data !== undefined &&
    Date.now() - entry.fetchedAt > KEEP_MS;
  if (expired) {
    entries.delete(key);
    return undefined;
  }
  return entry as ResourceEntry<T>;
}

/** Called when the key's entry changes; returns how to stop listening. */
export function subscribe(key: string, listener: () => void): () => void {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

function isFresh(entry: ResourceEntry | undefined): boolean {
  return (
    entry !== undefined &&
    entry.data !== undefined &&
    entry.error === null &&
    Date.now() - entry.fetchedAt < FRESH_MS
  );
}

function failedJustNow(entry: ResourceEntry | undefined): boolean {
  return entry !== undefined && Date.now() - entry.failedAt < FAILED_MS;
}

/** Whether a read of this key would add no request. */
export function isCovered(key: string): boolean {
  const entry = peek(key);
  return flights.has(key) || isFresh(entry) || failedJustNow(entry);
}

function settleAborted(key: string): void {
  // A newer request took over this key; its answer will settle the entry.
  if (flights.has(key)) return;
  const entry = entries.get(key);
  if (entry === undefined) return;
  if (entry.data === undefined) {
    entries.delete(key);
    notify(key);
  } else {
    write(key, { ...entry, pending: false });
  }
}

function start<T>(resource: Resource<T>): Flight {
  const { key } = resource;
  const flight: Flight = { controller: new AbortController(), holders: 0 };
  flights.set(key, flight);
  write(key, {
    data: entries.get(key)?.data,
    error: entries.get(key)?.error ?? null,
    fetchedAt: entries.get(key)?.fetchedAt ?? 0,
    failedAt: entries.get(key)?.failedAt ?? 0,
    pending: true,
  });

  const land = (settle: () => void) => {
    if (flight.controller.signal.aborted) {
      settleAborted(key);
      return;
    }
    if (flights.get(key) === flight) flights.delete(key);
    settle();
  };

  resource.load(flight.controller.signal).then(
    (data) =>
      land(() =>
        write(key, {
          data,
          error: null,
          fetchedAt: Date.now(),
          failedAt: 0,
          pending: false,
        }),
      ),
    (error: unknown) =>
      land(() => {
        const previous = entries.get(key);
        write(key, {
          data: previous?.data,
          error,
          fetchedAt: previous?.fetchedAt ?? 0,
          failedAt: Date.now(),
          pending: false,
        });
      }),
  );
  return flight;
}

function hold(flight: Flight, key: string, signal: AbortSignal): void {
  flight.holders += 1;
  signal.addEventListener(
    "abort",
    () => {
      flight.holders -= 1;
      // Deferred, so a remount in the same commit keeps the request alive.
      queueMicrotask(() => {
        if (flight.holders > 0 || flights.get(key) !== flight) return;
        flights.delete(key);
        flight.controller.abort();
      });
    },
    { once: true },
  );
}

export interface FetchOptions {
  /** Ask again even if the answer is fresh, as "Try again" does. */
  readonly force?: boolean;
  /** Withdraws this reader; the request stops once no reader is left. */
  readonly signal?: AbortSignal;
}

/**
 * Makes sure an answer is here or coming. Without a `signal` the read stays
 * until it lands, which is what a prefetch wants: nothing cancels it.
 */
export function fetchResource<T>(
  resource: Resource<T>,
  options: FetchOptions = {},
): void {
  const { key } = resource;
  const entry = peek(key);
  if (options.force !== true && (isFresh(entry) || failedJustNow(entry))) {
    return;
  }
  const flight = flights.get(key);
  const current = flight ?? start(resource);
  if (options.signal !== undefined) hold(current, key, options.signal);
  else current.holders += 1;
}

/** Empties the store. For tests. */
export function clearResources(): void {
  flights.forEach((flight) => flight.controller.abort());
  flights.clear();
  entries.clear();
  listeners.clear();
}
