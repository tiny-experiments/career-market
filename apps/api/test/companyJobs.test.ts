import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { Sql } from '@cm/core/db';
import { createApp } from '../src/app.ts';
import { companyJobs } from '../src/companyJobs.ts';
import { KrillLive } from '../src/krillLive.ts';

const log = pino({ level: 'silent' });
const job = {
  id: 'kr_0123456789abcdef',
  title: 'Senior AI Researcher',
  team: 'World Foundation Models',
  workMode: 'remote',
  places: [{ label: 'Santa Clara, CA', countryCode: 'US', admin1Code: 'CA', city: 'Santa Clara' }],
  locations: ['Santa Clara, CA'],
  level: 'senior',
  ageDays: 4,
  url: 'https://example.com/job/1',
};

function fakeKrill(calls: string[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}?${url.searchParams}`);
    if (url.pathname === '/v1/facets') return Response.json({ total: 42, facets: {} });
    return Response.json({ items: [job], pageSize: 8, nextCursor: null });
  }) as typeof fetch;
}

function live(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof KrillLive>[0]> = {}) {
  return new KrillLive({ baseUrl: 'https://krill.test', log, fetchImpl, ...extra });
}

describe('company jobs from krill', () => {
  it('maps a krill job and counts the matches', async () => {
    const calls: string[] = [];
    const api = live(fakeKrill(calls));
    const res = await companyJobs(api, 'co_aaaaaaaaaaaaaaaa', { profession: 'ai-ml', country: 'US', remote: true, limit: 8 });
    expect(res).toEqual({
      available: true,
      total: 42,
      items: [
        { id: job.id, title: job.title, team: 'World Foundation Models', location: 'US (CA)', workMode: 'remote', level: 'senior', ageDays: 4, url: job.url },
      ],
    });
    expect(calls.some((c) => c.includes('workMode=remote') && c.includes('family=ai-ml') && c.includes('country=US') && c.includes('company=co_aaaaaaaaaaaaaaaa'))).toBe(true);
  });

  it('keeps only http(s) posting links', async () => {
    const urls = ['javascript:alert(1)', 'data:text/html,x', 'not a url', 'http://example.com/a', 'https://example.com/b'];
    const fetchImpl = (async (input: string | URL | Request) => {
      if (new URL(String(input)).pathname === '/v1/facets') return Response.json({ total: 5 });
      return Response.json({ items: urls.map((url, i) => ({ ...job, id: `kr_${i}`, url })) });
    }) as typeof fetch;
    const api = live(fetchImpl);
    const res = await companyJobs(api, 'co_aaaaaaaaaaaaaaaa', { limit: 8 });
    expect(res.available && res.items.map((j) => j.url)).toEqual([null, null, null, 'http://example.com/a', 'https://example.com/b']);
  });

  it('caches an answer for the same filter', async () => {
    const calls: string[] = [];
    const api = live(fakeKrill(calls));
    await companyJobs(api, 'co_aaaaaaaaaaaaaaaa', { limit: 8 });
    await companyJobs(api, 'co_aaaaaaaaaaaaaaaa', { limit: 8 });
    expect(calls).toHaveLength(2);
  });

  it('ignores filter values that are not ids, and answers an honest empty state when krill fails', async () => {
    const calls: string[] = [];
    const ok = live(fakeKrill(calls));
    await companyJobs(ok, 'co_aaaaaaaaaaaaaaaa', { profession: 'x;drop', country: 'usa', limit: 8 });
    expect(calls.every((c) => !c.includes('x%3Bdrop') && !c.includes('country='))).toBe(true);

    const down = live((async () => new Response('busy', { status: 429 })) as typeof fetch);
    expect(await companyJobs(down, 'co_aaaaaaaaaaaaaaaa', { limit: 8 })).toMatchObject({ available: false });
  });

  it('waits out krill 429 through the shared client instead of failing', async () => {
    let first = true;
    const slept: number[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      if (first) {
        first = false;
        return new Response('busy', { status: 429, headers: { 'retry-after': '2' } });
      }
      return new URL(String(input)).pathname === '/v1/facets' ? Response.json({ total: 1 }) : Response.json({ items: [job] });
    }) as typeof fetch;
    const res = await companyJobs(live(fetchImpl, { sleep: async (ms) => void slept.push(ms) }), 'co_aaaaaaaaaaaaaaaa', { limit: 8 });
    expect(res).toMatchObject({ available: true });
    expect(slept.length).toBeGreaterThan(0);
  });

  it('serves GET /v1/companies/:slug/jobs from the injected krill client', async () => {
    const calls: string[] = [];
    const sql = ((strings: TemplateStringsArray) =>
      Promise.resolve(strings.join('?').includes('from company where') ? [{ company_id: 'co_aaaaaaaaaaaaaaaa' }] : [])) as unknown as Sql;
    const app = createApp({ sql, token: 'test-token-0123456789', log, live: live(fakeKrill(calls)) });
    const res = await app.request('/v1/companies/nvidia/jobs?profession=ai-ml&limit=5', { headers: { authorization: 'Bearer test-token-0123456789' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ available: true, total: 42 });
    expect(calls.some((c) => c.includes('family=ai-ml') && c.includes('pageSize=5'))).toBe(true);
  });
});
