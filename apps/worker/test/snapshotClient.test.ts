import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { z } from 'zod';
import { krillJobSchema, krillJobPageSchema } from '@cm/core/krillJob';
import { SnapshotClient } from '../src/snapshotClient.ts';
import { KrillClient } from '../src/krill/client.ts';
import { facetsSchema } from '../src/krill/schemas.ts';
import { companyDirectorySchema } from '../src/krill/companyApi.ts';

const log = pino({ level: 'silent' });
const job = (id: string, fields = {}) => krillJobSchema.parse({ id, status: 'open', title: id, company: { id: 'co_aaaaaaaaaaaaaaaa', name: 'Acme' },
  url: null, applyUrl: null, employmentType: null, workMode: 'remote', locations: [],
  places: [{ label: 'US', countryCode: 'US' }, { label: 'US again', countryCode: 'US' }], salary: null, postedAt: null,
  openedAt: '2026-11-09', openedSource: 'first_seen', firstSeenAt: '2026-11-09', lastSeenAt: '2026-11-09',
  family: 'swe', specialty: null, level: 'senior', skills: ['lang:python'], languages: [], tools: [], ageDays: 1, repostCount: 0, staleScore: null, ...fields });
const setup = () => {
  let network = 0;
  const source = new KrillClient({ baseUrl: 'https://source.test', ratePerMinute: 500, logger: log, timeoutMs: 1000,
    fetchImpl: (async () => { network++; return new Response('{"description":"Full description"}'); }) as typeof fetch });
  return { network: () => network, client: new SnapshotClient(source, [job('z', { skills: ['lang:python', 'lang:python'] }), job('a', { company: { id: 'co_bbbbbbbbbbbbbbbb', name: 'Bee' }, family: 'data', workMode: 'onsite',
    firstSeenAt: '2026-11-08', postedAt: '2026-11-07T00:00:00Z', salary: { min: 100, max: 200, annualMin: 100, annualMax: 200, currency: 'USD', period: 'year' } })],
    [{ id: 'co_aaaaaaaaaaaaaaaa', name: 'Acme', domain: null, openJobs: 1, ats: [] }, { id: 'co_bbbbbbbbbbbbbbbb', name: 'Bee', domain: 'bee.test', openJobs: 1, ats: [] }], log) };
};

describe('snapshot-derived current inputs', () => {
  it('counts each job once per location and intersects skill, profession and date filters', async () => {
    const { client, network } = setup();
    const facets = (await client.get('/v1/facets', { skills: 'lang:python', limit: 100 }, facetsSchema)).data;
    expect(facets.total).toBe(2);
    expect(facets.facets.country).toEqual([{ value: 'US', count: 2 }]);
    expect(facets.facets.skill).toEqual([{ value: 'lang:python', count: 2 }]);
    expect((await client.get('/v1/facets', { family: 'swe', postedSince: '1970-01-01' }, facetsSchema)).data.total).toBe(0);
    expect((await client.get('/v1/facets', { family: 'data', skills: 'lang:python', country: 'US', postedSince: '2026-11-07' }, facetsSchema)).data.total).toBe(1);
    expect(network()).toBe(0);
  });
  it('supports count-only and selected-dimension reads without polluting the full-facet cache', async () => {
    const { client } = setup();
    expect((await client.get('/v1/facets', {}, facetsSchema, { countOnly: true })).data).toMatchObject({ total: 2, facets: { family: [] } });
    expect((await client.get('/v1/facets', {}, facetsSchema, { facetDimensions: ['family'] })).data.facets.family).toHaveLength(2);
    expect((await client.get('/v1/facets', {}, facetsSchema)).data.facets.skill).toEqual([{ value: 'lang:python', count: 2 }]);
  });
  it('pages sorted jobs and applies salary and work-mode filters', async () => {
    const { client } = setup();
    const first = (await client.get('/v1/jobs', { pageSize: 1, sort: 'newest' }, krillJobPageSchema)).data;
    expect(first.items.map((j) => j.id)).toEqual(['z']); expect(first.nextCursor).toBe('1');
    const second = (await client.get('/v1/jobs', { pageSize: 1, sort: 'newest', cursor: '1' }, krillJobPageSchema)).data;
    expect(second.items.map((j) => j.id)).toEqual(['a']); expect(second.nextCursor).toBeNull();
    expect((await client.get('/v1/jobs', { country: 'US', currency: 'USD', salaryMin: 1, workMode: 'onsite' }, krillJobPageSchema)).data.items.map((j) => j.id)).toEqual(['a']);
  });
  it('delegates a richer company detail request after a cached name-only lookup', async () => {
    const { client, network } = setup();
    await client.get('/v1/companies/co_bbbbbbbbbbbbbbbb', {}, z.object({ name: z.string() }));
    expect(network()).toBe(0);
    expect((await client.get('/v1/companies/co_bbbbbbbbbbbbbbbb', {}, z.object({ description: z.string() }))).data.description).toBe('Full description');
    expect(network()).toBe(1);
  });
  it('keeps directory logos, provides company names locally and delegates detail text', async () => {
    const { client, network } = setup();
    const page = (await client.get('/v1/companies', { pageSize: 1, cursor: '1' }, companyDirectorySchema)).data;
    expect(page.items[0]?.domain).toBe('bee.test');
    expect((await client.get('/v1/companies/co_bbbbbbbbbbbbbbbb', {}, z.object({ name: z.string() }))).data.name).toBe('Bee');
    expect(network()).toBe(0);
    expect((await client.get('/v1/jobs/z', {}, z.object({ description: z.string() }))).data.description).toBe('Full description');
    expect(network()).toBe(1);
  });
});
