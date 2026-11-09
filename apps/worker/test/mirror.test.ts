import { job, apiWith } from './fixtures.ts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import { parseConfig } from '@cm/core/config';
import { runBuild } from '../src/build.ts';
import { withWorkerLock } from '../src/lock.ts';
import { applyChangePage, mirrorFamilies, mirrorRow, promoteMirror, stageMirror, sweepChanges, upsertJobs } from '../src/mirror.ts';
import type { KrillChangePage } from '../src/krill/schemas.ts';

const page = (kind: 'opened' | 'closed' | 'updated' | 'reopened', cursor = 'after1'): KrillChangePage => ({
  items: [{ jobId: 'j1', kind, date: '2026-11-09', closeReason: null }], pageSize: 100, nextCursor: null, syncCursor: cursor,
});

it('maps every Jobs filter and verdict input without discarding the original record', () => {
  expect(mirrorRow(job())).toMatchObject({ countries: ['GB'], remote: true, company_name: 'Acme', level: 'senior', salary_min: 100,
    repost_count: 2, stale_score: 0.4, opened_source: 'posted', description: 'Build useful software.' });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('mirror transactions (dedicated test database)', () => {
  let sql: Sql;
  beforeAll(async () => { sql = createSql(process.env.TEST_DATABASE_URL!); await migrate(sql); });
  afterAll(async () => { await sql.end(); });
  beforeEach(async () => {
    await sql`delete from build_run`;
    await sql`truncate job_mirror, job_mirror_stage, job_description_retry, worker_state, worker_change, job_counter_daily, company_open_count, company`;
    await sql`insert into worker_state(name, cursor) values ('changes', 'start')`;
  });
  it('skips unfinished snapshots and successful dates without starting another pull', async () => {
    const calls: string[] = [];
    let complete = false;
    const api = apiWith((url) => {
      calls.push(url.pathname);
      return { taxonomy: { version: 1, hash: 'x' }, lastSnapshotDate: '2026-11-09', exportedAt: complete ? '2026-11-09T06:00:00Z' : null,
        openJobs: 1, companies: 1, boards: 1, ats: [] };
    });
    const deps = { sql, api, log: pino({ level: 'silent' }), config: parseConfig({ DATABASE_URL: process.env.TEST_DATABASE_URL }) };
    expect(await runBuild(deps)).toMatchObject({ status: 'skipped', reason: 'snapshot not complete' });
    complete = true;
    await sql`insert into build_run(snapshot_date, status) values ('2026-11-09', 'ok')`;
    expect(await runBuild(deps)).toMatchObject({ status: 'skipped', reason: 'snapshot already built' });
    expect(calls).toEqual(['/v1/meta', '/v1/meta']);
  });
  it('serializes worker processes and releases its lock after a failed operation', async () => {
    await withWorkerLock(sql, async () => { expect(await withWorkerLock(sql, async () => 1)).toBeNull(); });
    await expect(withWorkerLock(sql, async () => { throw new Error('failed'); })).rejects.toThrow('failed');
    expect(await withWorkerLock(sql, async () => 2)).toBe(2);
  });
  it('applies the ordered migrations safely when API and worker start together', async () => {
    expect(await Promise.all([migrate(sql), migrate(sql)])).toEqual([[], []]);
  });
  it('stages every page and atomically replaces stale jobs, keeping descriptions', async () => {
    await upsertJobs(sql, [job('old'), job()]);
    const calls: string[] = [];
    const api = apiWith((url) => { calls.push(url.search); return { items: [job(url.searchParams.has('cursor') ? 'j2' : 'j1', { description: undefined })], nextCursor: url.searchParams.has('cursor') ? null : 'next' }; });
    expect(await stageMirror(sql, api, ['a'])).toBe(2);
    expect((await sql`select id from job_mirror`).map((r) => r.id).sort()).toEqual(['j1', 'old']);
    await sql.begin(async (tx) => { await promoteMirror(tx as unknown as Sql, '2026-11-09', 'new'); });
    expect((await sql`select id from job_mirror order by id`).map((r) => r.id)).toEqual(['j1', 'j2']);
    expect((await sql`select description from job_mirror where id = 'j1'`)[0]?.description).toBe('Build useful software.');
    expect((await sql`select payload->>'description' as description from job_mirror where id = 'j1'`)[0]?.description).toBe('Build useful software.');
    expect((await sql`select open from company_open_count`)[0]?.open).toBe(2);
    expect(calls).toHaveLength(2);
  });
  it('follows all profession partitions and deduplicates jobs that moved between them', async () => {
    const partitions: string[] = [];
    const api = apiWith((url) => {
      partitions.push(url.searchParams.get('family')!);
      return { items: [job()], nextCursor: null };
    });
    expect(await stageMirror(sql, api, ['a'], ['swe', 'data'])).toBe(1);
    expect(partitions.sort()).toEqual(['data', 'swe']);
  });
  it('keeps prepared readers and indexes correct across atomic table publication', async () => {
    await upsertJobs(sql, [job('j1', { title: 'Before' })]);
    await upsertJobs(sql, [job('j1', { title: 'After' })], true);
    const reader = await sql.reserve();
    const read = () => reader`select title from job_mirror where id = ${'j1'}`;
    try {
      expect((await read())[0]?.title).toBe('Before');
      await sql.begin(async (tx) => { await promoteMirror(tx as unknown as Sql, '2026-11-09', 'cursor'); });
      expect((await read())[0]?.title).toBe('After');
      const [indexes] = await sql`select count(*)::int as n from pg_index where indrelid = 'job_mirror'::regclass`;
      expect(indexes?.n).toBeGreaterThan(5);
    } finally { reader.release(); }
  });
  it('distinguishes missing listing text from an explicit null in full job detail', async () => {
    await upsertJobs(sql, [job()]);
    await upsertJobs(sql, [job('j1', { description: undefined })]);
    expect((await sql`select description from job_mirror`)[0]?.description).toBe('Build useful software.');
    await upsertJobs(sql, [job('j1', { description: null })]);
    expect((await sql`select description, description_present from job_mirror`)[0]).toMatchObject({ description: null, description_present: true });
  });
  it('applies opened, updated, closed and reopened with replay-safe counters', async () => {
    const open = apiWith(() => job('j1', { description: 'Opened text' }));
    await applyChangePage(sql, open, page('opened'), 'start');
    await applyChangePage(sql, open, page('opened'), 'start');
    expect((await sql`select new_today from job_counter_daily`)[0]?.new_today).toBe(1);
    expect((await sql`select description, description_present from job_mirror`)[0]).toMatchObject({ description: 'Opened text', description_present: true });
    await applyChangePage(sql, apiWith(() => job('j1', { title: 'Staff Engineer', level: 'staff', description: 'Updated text' })), page('updated', 'after2'), 'after1');
    expect((await sql`select title, level, description from job_mirror`)[0]).toMatchObject({ title: 'Staff Engineer', level: 'staff', description: 'Updated text' });
    await applyChangePage(sql, apiWith(() => ({ id: 'j1', status: 'closed', closedAt: '2026-11-09', openedAt: '2026-11-09', openedSource: 'posted', family: null })), page('closed', 'after3'), 'after2');
    expect(await sql`select id from job_mirror`).toHaveLength(0);
    expect((await sql`select open from company_open_count`)[0]?.open).toBe(0);
    await applyChangePage(sql, apiWith(() => job('j1', { description: 'Reopened text' })), page('reopened', 'after4'), 'after3');
    expect((await sql`select new_today, closed_today from job_counter_daily`)[0]).toMatchObject({ new_today: 2, closed_today: 1 });
    expect((await sql`select cursor from worker_state`)[0]?.cursor).toBe('after4');
    expect((await sql`select open from company`)[0]?.open).toBe(1);
    expect((await sql`select description from job_mirror`)[0]?.description).toBe('Reopened text');
  });
  it('does not advance the cursor or mutate jobs when hydration fails', async () => {
    await upsertJobs(sql, [job()]);
    await expect(applyChangePage(sql, apiWith(() => ({ invalid: true })), page('updated'), 'start')).rejects.toThrow();
    expect((await sql`select cursor from worker_state`)[0]?.cursor).toBe('start');
    expect(await sql`select id from job_mirror`).toHaveLength(1);
  });
  it('rolls back jobs and counters when the page transaction fails', async () => {
    await upsertJobs(sql, [job('j1', { title: 'Original' })]);
    await sql`create function fail_worker_event() returns trigger language plpgsql as 'begin raise exception ''write failed''; end'`;
    await sql`create trigger fail_worker_event before insert on worker_change for each row execute function fail_worker_event()`;
    try {
      await expect(applyChangePage(sql, apiWith(() => job()), page('opened'), 'start')).rejects.toThrow('write failed');
      expect((await sql`select title from job_mirror`)[0]?.title).toBe('Original');
      expect((await sql`select cursor from worker_state`)[0]?.cursor).toBe('start');
      expect(await sql`select * from job_counter_daily`).toHaveLength(0);
    } finally {
      await sql`drop trigger fail_worker_event on worker_change`;
      await sql`drop function fail_worker_event()`;
    }
  });
  it('restarts from the committed cursor and bypasses the disk cache for feeds and job hydration', async () => {
    const seen: string[] = [];
    const api = apiWith((url) => {
      if (url.pathname === '/v1/changes') { seen.push(url.searchParams.get('cursor')!); return seen.length === 1 ? { ...page('opened'), nextCursor: 'middle' } : { items: [], pageSize: 100, nextCursor: null, syncCursor: 'end' }; }
      return job();
    });
    expect(await sweepChanges(sql, api)).toEqual({ pages: 2, events: 1 });
    await sweepChanges(sql, api);
    expect(seen).toEqual(['start', 'middle', 'end']);
  });
});

it('falls back to whole-ATS pulls if any jobs lack a profession or the facets were truncated', () => {
  const facets = { total: 2, facets: { family: [{ value: 'swe', count: 1 }], specialty: [], level: [], workMode: [], ats: [], skill: [], language: [], country: [] } };
  expect(mirrorFamilies(facets)).toBeUndefined();
  facets.facets.family.push({ value: 'data', count: 1 });
  expect(mirrorFamilies(facets)).toEqual(['swe', 'data']);
});
