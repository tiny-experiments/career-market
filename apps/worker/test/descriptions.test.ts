import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import { pino } from 'pino';
import { createDescriptionHydrator, createDescriptionBackfill } from '@cm/worker/descriptions';
import { upsertJobs } from '../src/mirror.ts';
import { withWorkerLock } from '../src/lock.ts';
import { KrillApi } from '../src/krill/api.ts';
import { KrillClient } from '../src/krill/client.ts';
import { job, apiWith } from './fixtures.ts';

describe.skipIf(!process.env.TEST_DATABASE_URL)('description coverage (private Postgres)', () => {
  let sql: Sql;
  beforeAll(async () => { sql = createSql(process.env.TEST_DATABASE_URL!); await migrate(sql); });
  afterAll(async () => { await sql.end(); });
  beforeEach(async () => { await sql`truncate job_mirror, job_mirror_stage, job_description_retry`; });

  it('coalesces first visits, stores text and serves later visits from Postgres', async () => {
    await upsertJobs(sql, [job('j1', { description: undefined })]);
    let calls = 0;
    const hydrator = createDescriptionHydrator({ sql, api: apiWith(() => { calls++; return job('j1', { title: 'Source changed', description: 'Full posting' }); }) });
    const results = await Promise.all([hydrator.lookup('j1'), hydrator.lookup('j1')]);
    expect(results[0]).toMatchObject({ kind: 'open', job: { title: 'Software Engineer', description: 'Full posting' } });
    expect(results[1]).toEqual(results[0]);
    expect(await hydrator.lookup('j1')).toEqual(results[0]);
    expect(calls).toBe(1);
    expect((await sql`select description_present, payload->>'description' as text from job_mirror`)[0]).toMatchObject({ description_present: true, text: 'Full posting' });
  });

  it('caches an explicitly empty description and does not fetch unknown local ids', async () => {
    await upsertJobs(sql, [job('j1', { description: undefined })]);
    let calls = 0;
    const hydrator = createDescriptionHydrator({ sql, api: apiWith(() => { calls++; return job('j1', { description: null }); }) });
    expect(await hydrator.lookup('unknown')).toEqual({ kind: 'missing' });
    await hydrator.lookup('j1'); await hydrator.lookup('j1');
    expect(calls).toBe(1);
    expect((await sql`select description, description_present from job_mirror`)[0]).toMatchObject({ description: null, description_present: true });
  });

  it('leaves failed fetches retryable and releases the in-flight request', async () => {
    await upsertJobs(sql, [job('j1', { description: undefined })]);
    let calls = 0;
    const hydrator = createDescriptionHydrator({ sql, api: apiWith(() => ++calls === 1 ? { malformed: true } : job()) });
    await expect(hydrator.lookup('j1')).rejects.toThrow();
    expect((await sql`select description_present from job_mirror`)[0]?.description_present).toBe(false);
    expect(await hydrator.lookup('j1')).toMatchObject({ kind: 'open' });
    expect(calls).toBe(2);
  });

  it('returns tombstones without resurrecting a closed role', async () => {
    await upsertJobs(sql, [job('j1', { description: undefined })]);
    const tombstone = { id: 'j1', status: 'closed', closedAt: '2026-11-09', openedAt: '2026-11-01', openedSource: 'posted', family: 'software' };
    const hydrator = createDescriptionHydrator({ sql, api: apiWith(() => tombstone) });
    expect(await hydrator.lookup('j1')).toEqual({ kind: 'closed', tombstone });
    expect((await sql`select description_present from job_mirror`)[0]?.description_present).toBe(false);
  });

  it('does not reinsert a role removed during an on-demand fetch', async () => {
    await upsertJobs(sql, [job('j1', { description: undefined })]);
    let fetched!: () => void;
    const entered = new Promise<void>((resolve) => { fetched = resolve; });
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const api = new KrillApi(new KrillClient({ baseUrl: 'https://source.test', ratePerMinute: 500, timeoutMs: 1000,
      logger: pino({ level: 'silent' }), fetchImpl: (async () => { fetched(); await wait; return new Response(JSON.stringify(job())); }) as typeof fetch }));
    const result = createDescriptionHydrator({ sql, api }).lookup('j1');
    await entered; await sql`delete from job_mirror where id = 'j1'`; release();
    expect(await result).toEqual({ kind: 'missing' });
    expect(await sql`select id from job_mirror`).toHaveLength(0);
  });

  it('backfills newest first at the configured pace and resumes from durable coverage', async () => {
    await upsertJobs(sql, [job('old', { firstSeenAt: '2026-11-08', description: undefined }), job('new', { description: undefined })]);
    const calls: string[] = [];
    const hydrator = createDescriptionHydrator({ sql, api: apiWith((url) => { const id = url.pathname.split('/').at(-1)!; calls.push(id); return job(id); }) });
    const deps = { sql, hydrator, ratePerMinute: 120, onError: () => {} };
    const tick = createDescriptionBackfill(deps);
    expect(await tick(0)).toEqual({ status: 'hydrated', jobId: 'new' });
    expect(await tick(499)).toEqual({ status: 'paced' });
    // A new process need not reconstruct an in-memory cursor.
    expect(await createDescriptionBackfill(deps)(500)).toEqual({ status: 'hydrated', jobId: 'old' });
    expect(calls).toEqual(['new', 'old']);
    expect(await createDescriptionBackfill(deps)(1000)).toEqual({ status: 'empty' });
  });

  it('yields to another build/sweep and can be disabled', async () => {
    await upsertJobs(sql, [job('j1', { description: undefined })]);
    let calls = 0;
    const deps = { sql, hydrator: createDescriptionHydrator({ sql, api: apiWith(() => { calls++; return job(); }) }), onError: () => {} };
    const tick = createDescriptionBackfill({ ...deps, ratePerMinute: 120 });
    await withWorkerLock(sql, async () => { expect(await tick(0)).toEqual({ status: 'yielded' }); });
    expect(await createDescriptionBackfill({ ...deps, ratePerMinute: 0 })(0)).toEqual({ status: 'disabled' });
    expect(calls).toBe(0);
    expect(await tick(500)).toMatchObject({ status: 'hydrated' });
  });

  it('persists retry deferrals so a broken newest job cannot pin the queue', async () => {
    await upsertJobs(sql, [job('old', { firstSeenAt: '2026-11-08', description: undefined }), job('new', { description: undefined })]);
    let failures = 0;
    const hydrator = createDescriptionHydrator({ sql, api: apiWith((url) => url.pathname.endsWith('/new') ? { invalid: true } : job('old')) });
    const deps = { sql, hydrator, ratePerMinute: 120, onError: () => { failures++; } };
    expect(await createDescriptionBackfill(deps)(0)).toEqual({ status: 'deferred', jobId: 'new' });
    expect(await createDescriptionBackfill(deps)(500)).toEqual({ status: 'hydrated', jobId: 'old' });
    expect((await sql`select job_id, attempts, retry_after > now() as deferred from job_description_retry`)[0]).toMatchObject({ job_id: 'new', attempts: 1, deferred: true });
    expect(failures).toBe(1);
  });
});
