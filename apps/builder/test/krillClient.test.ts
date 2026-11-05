import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { KrillApi } from '../src/krill/api.ts';
import { KrillClient, KrillHttpError } from '../src/krill/client.ts';

const logger = pino({ level: 'silent' });

function fakeFetch(handler: (url: URL) => { status: number; body: unknown; headers?: Record<string, string> }) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const res = handler(url);
    return new Response(JSON.stringify(res.body), { status: res.status, headers: res.headers });
  }) as typeof fetch;
  return { impl, calls };
}

function client(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof KrillClient>[0]> = {}) {
  return new KrillClient({ baseUrl: 'https://krill.test', ratePerMinute: 60_000, timeoutMs: 1000, logger, fetchImpl, sleep: async () => {}, ...extra });
}

describe('KrillClient', () => {
  it('parses responses with zod and rejects malformed ones', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { n: 'not a number' } }));
    await expect(client(f.impl).get('/x', {}, z.object({ n: z.number() }))).rejects.toThrow(/failed validation/);
  });

  it('retries 429 then succeeds', async () => {
    let n = 0;
    const f = fakeFetch(() => (++n === 1 ? { status: 429, body: {}, headers: { 'retry-after': '1' } } : { status: 200, body: { ok: true } }));
    const res = await client(f.impl).get('/x', {}, z.object({ ok: z.boolean() }));
    expect(res.data.ok).toBe(true);
    expect(f.calls).toHaveLength(2);
  });

  it('throws KrillHttpError on a 500 without retrying', async () => {
    const f = fakeFetch(() => ({ status: 500, body: { code: 'INTERNAL' } }));
    await expect(client(f.impl).get('/x', {}, z.object({}))).rejects.toBeInstanceOf(KrillHttpError);
    expect(f.calls).toHaveLength(1);
  });

  it('accepts listed non-2xx statuses (410 tombstones)', async () => {
    const f = fakeFetch(() => ({ status: 410, body: { status: 'closed' } }));
    const res = await client(f.impl).get('/x', {}, z.object({ status: z.string() }), { acceptStatuses: [410] });
    expect(res.status).toBe(410);
  });

  it('caches per namespace on disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cm-krill-'));
    const f = fakeFetch(() => ({ status: 200, body: { v: 1 } }));
    const c = client(f.impl, { cacheDir: dir });
    c.setCacheNamespace('2026-11-05');
    await c.get('/x', { a: 1 }, z.object({ v: z.number() }));
    await c.get('/x', { a: 1 }, z.object({ v: z.number() }));
    expect(f.calls).toHaveLength(1);
    c.setCacheNamespace('2026-11-06');
    await c.get('/x', { a: 1 }, z.object({ v: z.number() }));
    expect(f.calls).toHaveLength(2);
  });

  it('sends the API key as a bearer token', async () => {
    let auth: string | null = null;
    const impl = (async (_: unknown, init?: RequestInit) => {
      auth = new Headers(init?.headers).get('authorization');
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    await client(impl, { apiKey: 'krk_test' }).get('/x', {}, z.object({}));
    expect(auth).toBe('Bearer krk_test');
  });
});

const facets = (total: number) => ({
  total,
  facets: { family: [], specialty: [], level: [], skill: [], language: [], country: [], workMode: [], ats: [] },
});

describe('KrillApi.facetTotal', () => {
  it('splits families that krill cannot count together, then by ATS', async () => {
    const counts: Record<string, number> = { a: 10, b: 20, c: 30 };
    const f = fakeFetch((url) => {
      const fams = (url.searchParams.get('family') ?? '').split(',');
      const ats = url.searchParams.get('ats');
      if (fams.length > 1) return { status: 500, body: {} };
      if (fams[0] === 'c' && !ats) return { status: 500, body: {} };
      if (fams[0] === 'c' && ats) return ats.includes(',') ? { status: 500, body: {} } : { status: 200, body: facets(15) };
      return { status: 200, body: facets(counts[fams[0] as string] as number) };
    });
    const api = new KrillApi(client(f.impl));
    const res = await api.facetTotal({ openedSince: '2026-10-06' }, ['a', 'b', 'c'], ['greenhouse', 'lever']);
    expect(res?.total).toBe(10 + 20 + 15 + 15);
    expect(res?.groups).toEqual([['a'], ['b'], ['c']]);
  });

  it('counts a failing slice at a nearby date', async () => {
    const f = fakeFetch((url) =>
      url.searchParams.get('openedSince') === '2026-10-06' ? { status: 500, body: {} } : { status: 200, body: facets(7) },
    );
    const api = new KrillApi(client(f.impl));
    expect((await api.facetTotal({ openedSince: '2026-10-06' }, ['a']))?.total).toBe(7);
  });

  it('pages the change feed with since first, then cursor only', async () => {
    const f = fakeFetch((url) => {
      if (url.searchParams.has('cursor')) {
        expect(url.searchParams.has('since')).toBe(false);
        return {
          status: 200,
          body: {
            items: [
              { jobId: 'kr_2', kind: 'closed', date: '2026-11-04', changedFields: [], closeReason: 'missing' },
              { jobId: 'kr_3', kind: 'closed', date: '2026-11-05', changedFields: [], closeReason: 'missing' },
            ],
            pageSize: 2,
            nextCursor: 'c2',
            syncCursor: 's',
          },
        };
      }
      return {
        status: 200,
        body: {
          items: [{ jobId: 'kr_1', kind: 'closed', date: '2026-11-04', changedFields: [], closeReason: 'missing' }],
          pageSize: 1,
          nextCursor: 'c1',
          syncCursor: 's',
        },
      };
    });
    const api = new KrillApi(client(f.impl));
    expect((await api.closedOn('2026-11-04')).map((i) => i.jobId)).toEqual(['kr_1', 'kr_2']);
  });
});
