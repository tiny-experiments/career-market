import type { Sql } from '@cm/core/db';
import { krillJobDetailSchema, krillTombstoneSchema, type KrillJobDetail, type KrillTombstone } from '@cm/core/krillJob';
import { z } from 'zod';
import type { KrillApi } from './krill/api.ts';
import { KrillHttpError } from './krill/client.ts';
import { withWorkerLock } from './lock.ts';

export type DescriptionLookup =
  | { kind: 'open'; job: KrillJobDetail }
  | { kind: 'closed'; tombstone: KrillTombstone }
  | { kind: 'missing' };

/** Share one instance in the API's job repository to coalesce concurrent first visits. */
export function createDescriptionHydrator({ sql, api }: { sql: Sql; api: KrillApi }) {
  const pending = new Map<string, Promise<DescriptionLookup>>();
  async function cached(id: string) {
    const [row] = await sql`select payload, description, description_present from job_mirror where id = ${id}`;
    return row;
  }
  function stored(row: NonNullable<Awaited<ReturnType<typeof cached>>>): DescriptionLookup {
    return { kind: 'open', job: krillJobDetailSchema.parse({ ...row.payload, description: row.description }) };
  }
  async function hydrate(id: string): Promise<DescriptionLookup> {
    const row = await cached(id);
    if (!row) return { kind: 'missing' };
    if (row.description_present) return stored(row);
    let detail: KrillJobDetail | KrillTombstone;
    try {
      detail = (await api.client.get(`/v1/jobs/${encodeURIComponent(id)}`, {},
        z.union([krillJobDetailSchema, krillTombstoneSchema]), { cache: false, acceptStatuses: [410] })).data;
    } catch (error) {
      if (error instanceof KrillHttpError && error.status === 404) return { kind: 'missing' };
      throw error;
    }
    if (detail.status === 'closed') return { kind: 'closed', tombstone: detail };
    // Do not resurrect a role that closed during the fetch, or replace newer sweep metadata.
    await sql`update job_mirror set description = ${detail.description}, description_present = true,
      payload = payload || jsonb_build_object('description', ${detail.description}::text), mirrored_at = now()
      where id = ${id} and not description_present`;
    const current = await cached(id);
    if (!current) return { kind: 'missing' };
    await sql`delete from job_description_retry where job_id = ${id}`;
    return stored(current);
  }
  return {
    lookup(id: string): Promise<DescriptionLookup> {
      const active = pending.get(id);
      if (active) return active;
      const result = hydrate(id).finally(() => { pending.delete(id); });
      pending.set(id, result);
      return result;
    },
  };
}

export type BackfillResult = { status: 'disabled' | 'paced' | 'yielded' | 'empty' | 'hydrated' | 'deferred'; jobId?: string };

/** One job per step; the watcher runs builds and sweeps before admitting another step. */
export function createDescriptionBackfill(deps: {
  sql: Sql;
  hydrator: ReturnType<typeof createDescriptionHydrator>;
  ratePerMinute: number;
  onError: (error: unknown) => void;
}) {
  let nextAt = 0;
  return async (now: number): Promise<BackfillResult> => {
    if (deps.ratePerMinute === 0) return { status: 'disabled' };
    if (now < nextAt) return { status: 'paced' };
    nextAt = now + Math.ceil(60_000 / deps.ratePerMinute);
    return await withWorkerLock(deps.sql, async (sql): Promise<BackfillResult> => {
      const [job] = await sql`select j.id from job_mirror j
        left join job_description_retry r on r.job_id = j.id
        where not j.description_present and (r.retry_after is null or r.retry_after <= now())
        order by j.first_seen_at desc, j.id desc limit 1`;
      if (!job) { nextAt = now + 60_000; return { status: 'empty' }; }
      const id = job.id as string;
      try {
        const result = await deps.hydrator.lookup(id);
        if (result.kind === 'open') return { status: 'hydrated', jobId: id };
      } catch (error) { deps.onError(error); }
      // Failed/closed records must not pin the queue ahead of every other job.
      await sql`insert into job_description_retry(job_id, retry_after) values (${id}, now() + interval '1 hour')
        on conflict(job_id) do update set retry_after = excluded.retry_after, attempts = job_description_retry.attempts + 1`;
      return { status: 'deferred', jobId: id };
    }) ?? { status: 'yielded' };
  };
}
