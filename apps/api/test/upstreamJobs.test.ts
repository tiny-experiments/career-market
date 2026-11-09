import { describe, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import type { IsoDay } from '@cm/core/dates';
import { createUpstreamJobs } from '../src/integrations/upstreamJobs.ts';
import { KrillLive } from '../src/integrations/krillLive.ts';
import { jobsQuerySchema } from '../src/modules/jobs/schemas.ts';

const job = {
  id: 'kr_aaaaaaaa',
  status: 'open',
  title: 'Engineer',
  company: { id: 'acme', name: 'Acme' },
  url: null,
  applyUrl: null,
  employmentType: null,
  workMode: 'remote',
  locations: [],
  places: [],
  salary: null,
  postedAt: null,
  openedAt: '2026-11-06',
  openedSource: 'posted',
  firstSeenAt: '2026-11-06',
  lastSeenAt: '2026-11-09',
  family: 'software',
  specialty: null,
  level: 'junior',
  skills: [],
  languages: [],
  tools: [],
  ageDays: 3,
  repostCount: 0,
  staleScore: null,
};
function setup() {
  const calls: URL[] = [];
  const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname === '/v1/facets') return Response.json({ total: 3 });
    if (url.pathname === '/v1/jobs')
      return Response.json({
        items: [
          { ...job, id: `kr_${url.searchParams.get('cursor') ?? 'aaaaaaaa'}` },
        ],
        pageSize: 1,
        nextCursor:
          url.searchParams.get('cursor') === 'bbbbbbbb' ? null : 'bbbbbbbb',
      });
    return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  });
  const live = new KrillLive({
    baseUrl: 'https://internal.example',
    log: pino({ level: 'silent' }),
    fetchImpl,
  });
  return {
    source: createUpstreamJobs(live, () => '2026-11-09' as IsoDay),
    calls,
    fetchImpl,
  };
}
describe('temporary job repository adapter', () => {
  it('translates validated filters, counts and cursor pages to numbered pages', async () => {
    const { source, calls } = setup();
    const query = jobsQuerySchema.parse({
      page: 2,
      pageSize: 1,
      company: 'acme',
      workMode: 'remote',
      level: 'entry',
      postedWithin: 7,
      hasPay: 'true',
    });
    const page = await source.list(query);
    expect(page).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 3,
      items: [{ id: 'kr_bbbbbbbb' }],
    });
    const jobs = calls.filter((c) => c.pathname === '/v1/jobs');
    expect(jobs).toHaveLength(2);
    expect(Object.fromEntries(jobs[0]!.searchParams)).toMatchObject({
      company: 'acme',
      workMode: 'remote',
      level: 'intern,junior',
      openedSince: '2026-11-02',
      salaryMin: '1',
      currency: 'USD',
    });
    expect(jobs[1]!.searchParams.get('cursor')).toBe('bbbbbbbb');
    const terminal = await source.list({ ...query, page: 3 });
    expect(terminal).toMatchObject({ items: [], page: 3, total: 3 });
    const beyond = await source.list({ ...query, page: 99 });
    expect(beyond).toMatchObject({ items: [], page: 99, total: 3 });
  });
  it('maps missing detail and refuses malformed source data', async () => {
    const { source } = setup();
    expect(await source.lookup('kr_missing1')).toEqual({ kind: 'missing' });
    const live = new KrillLive({
      baseUrl: 'https://internal.example',
      log: pino({ level: 'silent' }),
      fetchImpl: async () => Response.json({ malformed: true }),
    });
    await expect(
      createUpstreamJobs(live).lookup('kr_aaaaaaaa'),
    ).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
    await expect(
      createUpstreamJobs(live).list(jobsQuerySchema.parse({})),
    ).rejects.toThrow();
  });
});
