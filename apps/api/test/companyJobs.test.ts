import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createCompanyJobs } from '../src/companyJobs.ts';

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

describe('company jobs from krill', () => {
  it('maps a krill job and counts the matches', async () => {
    const calls: string[] = [];
    const jobs = createCompanyJobs({ baseUrl: 'https://krill.test', apiKey: undefined, log, fetchImpl: fakeKrill(calls) });
    const res = await jobs('co_aaaaaaaaaaaaaaaa', { profession: 'ai-ml', country: 'US', remote: true, limit: 8 });
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
    const jobs = createCompanyJobs({ baseUrl: 'https://krill.test', apiKey: undefined, log, fetchImpl });
    const res = await jobs('co_aaaaaaaaaaaaaaaa', { limit: 8 });
    expect(res.available && res.items.map((j) => j.url)).toEqual([null, null, null, 'http://example.com/a', 'https://example.com/b']);
  });

  it('caches an answer for the same filter', async () => {
    const calls: string[] = [];
    const jobs = createCompanyJobs({ baseUrl: 'https://krill.test', apiKey: undefined, log, fetchImpl: fakeKrill(calls) });
    await jobs('co_aaaaaaaaaaaaaaaa', { limit: 8 });
    await jobs('co_aaaaaaaaaaaaaaaa', { limit: 8 });
    expect(calls).toHaveLength(2);
  });

  it('ignores filter values that are not ids, and answers an honest empty state when krill fails', async () => {
    const calls: string[] = [];
    const ok = createCompanyJobs({ baseUrl: 'https://krill.test', apiKey: undefined, log, fetchImpl: fakeKrill(calls) });
    await ok('co_aaaaaaaaaaaaaaaa', { profession: 'x;drop', country: 'usa', limit: 8 });
    expect(calls.every((c) => !c.includes('x%3Bdrop') && !c.includes('country='))).toBe(true);

    const down = createCompanyJobs({
      baseUrl: 'https://krill.test',
      apiKey: undefined,
      log,
      fetchImpl: (async () => new Response('busy', { status: 429 })) as typeof fetch,
    });
    expect(await down('co_aaaaaaaaaaaaaaaa', { limit: 8 })).toMatchObject({ available: false });
  });
});
