import type { Sql } from '@cm/core/db';
import { addDays } from '@cm/core/dates';
import { krillJobSchema, krillTombstoneSchema } from '@cm/core/krillJob';
import { z } from 'zod';
import { concurrentMap } from './concurrent.ts';
import type { KrillApi } from './krill/api.ts';
import { KrillHttpError } from './krill/client.ts';
import { changePageSchema, facetsSchema, type KrillChangePage, type KrillFacets } from './krill/schemas.ts';
import { withWorkerLock } from './lock.ts';

const mirrorJobSchema = krillJobSchema.extend({ description: z.string().nullable().optional() });
export type MirrorJob = z.infer<typeof mirrorJobSchema>;
const mirrorPageSchema = z.object({ items: z.array(mirrorJobSchema), nextCursor: z.string().nullable() });

export function mirrorRow(job: MirrorJob) {
  return {
    id: job.id, company_id: job.company.id, company_name: job.company.name,
    title: job.title, family: job.family, specialty: job.specialty, level: job.level,
    countries: [...new Set(job.places.flatMap((p) => p.countryCode ? [p.countryCode] : []))],
    locations: job.locations, work_mode: job.workMode, remote: job.workMode === 'remote',
    employment_type: job.employmentType, posted_at: job.postedAt, opened_at: job.openedAt,
    first_seen_at: job.firstSeenAt, last_seen_at: job.lastSeenAt, opened_source: job.openedSource,
    salary_min: job.salary?.annualMin ?? null, salary_max: job.salary?.annualMax ?? null,
    salary_currency: job.salary?.currency ?? null, repost_count: job.repostCount,
    stale_score: job.staleScore, description: job.description ?? null, description_present: job.description !== undefined,
  };
}

export async function upsertJobs(tx: Sql, jobs: readonly MirrorJob[], stage = false): Promise<void> {
  if (!jobs.length) return;
  const table = stage ? 'job_mirror_stage' : 'job_mirror';
  const rows = jobs.map((job) => ({ ...mirrorRow(job), payload: tx.json({ ...job, description: job.description ?? null } as never) }));
  for (let i = 0; i < rows.length; i += 500) {
    await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + 500) as never)}
      on conflict (id) do update set
        company_id = excluded.company_id, company_name = excluded.company_name, title = excluded.title,
        family = excluded.family, specialty = excluded.specialty, level = excluded.level,
        countries = excluded.countries, locations = excluded.locations, work_mode = excluded.work_mode,
        remote = excluded.remote, employment_type = excluded.employment_type, posted_at = excluded.posted_at,
        opened_at = excluded.opened_at, first_seen_at = excluded.first_seen_at,
        last_seen_at = excluded.last_seen_at, opened_source = excluded.opened_source,
        salary_min = excluded.salary_min, salary_max = excluded.salary_max, salary_currency = excluded.salary_currency,
        repost_count = excluded.repost_count, stale_score = excluded.stale_score,
        description = case when excluded.description_present then excluded.description else ${tx(table)}.description end,
        description_present = excluded.description_present or ${tx(table)}.description_present,
        payload = excluded.payload || jsonb_build_object('description', case when excluded.description_present then excluded.description else ${tx(table)}.description end), mirrored_at = now()`;
  }
}

/** Empty future-day feed returns the current high-water mark without downloading the day's history. */
export async function captureCursor(api: KrillApi, today = new Date().toISOString().slice(0, 10)): Promise<string> {
  return (await api.client.get('/v1/changes', { since: addDays(today, 1), pageSize: 100 }, changePageSchema, { cache: false })).data.syncCursor;
}

/** Use profession partitions only when facets prove they cover the whole inventory. */
export function mirrorFamilies(facets: KrillFacets): string[] | undefined {
  const families = facets.facets.family;
  if (families.length && families.reduce((n, family) => n + family.count, 0) === facets.total) {
    return families.filter((family) => family.count > 0).map((family) => family.value);
  }
  return undefined;
}

export async function mirrorPartitionFamilies(api: KrillApi): Promise<string[] | undefined> {
  try {
    return mirrorFamilies((await api.client.get('/v1/facets', { limit: 100 }, facetsSchema, { cache: false })).data);
  } catch (error) {
    if (error instanceof KrillHttpError && error.status === 500) return undefined;
    throw error;
  }
}

/** Partition large inventories by ATS and profession to overlap long page chains without dropping unclassified roles. */
export async function stageMirror(sql: Sql, api: KrillApi, ats: readonly string[], families?: readonly string[]): Promise<number> {
  await sql`truncate job_mirror_stage`;
  const partitions = ats.flatMap<{ ats: string; family?: string }>((source) => families?.length ? families.map((family) => ({ ats: source, family })) : [{ ats: source, family: undefined }]);
  await concurrentMap(partitions, async (partition) => {
    let cursor: string | undefined;
    do {
      const page = (await api.client.get('/v1/jobs', { ...partition, pageSize: 100, cursor }, mirrorPageSchema, { cache: false })).data;
      await upsertJobs(sql, page.items, true);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  });
  const [row] = await sql`select count(*)::int as n from job_mirror_stage`;
  return row?.n as number;
}

export async function refreshCounts(tx: Sql): Promise<void> {
  await tx`delete from company_open_count`;
  await tx`insert into company_open_count select company_id, count(*)::int from job_mirror group by company_id`;
  await tx`update company set open = coalesce((select open from company_open_count c where c.company_id = company.company_id), 0)`;
}

export async function promoteMirror(tx: Sql, snapshotDate: string, cursor: string, exportedAt?: string | null): Promise<void> {
  // Preserve descriptions fetched by sweeps when the upstream listing omits them.
  await tx`update job_mirror_stage s set description = j.description, description_present = true, payload = s.payload || jsonb_build_object('description', j.description)
    from job_mirror j where s.id = j.id and not s.description_present and j.description_present`;
  // Both tables carry the same indexes. Publishing swaps names instead of copying every indexed row.
  await tx`alter table job_mirror rename to job_mirror_previous`;
  await tx`alter table job_mirror_stage rename to job_mirror`;
  await tx`alter table job_mirror_previous rename to job_mirror_stage`;
  await refreshCounts(tx);
  await tx`insert into worker_state(name, cursor, snapshot_date, exported_at)
    values ('changes', ${cursor}, ${snapshotDate}, ${exportedAt ?? null})
    on conflict(name) do update set snapshot_date = excluded.snapshot_date,
      exported_at = excluded.exported_at, updated_at = now()`;
}

export async function readJob(api: KrillApi, id: string): Promise<MirrorJob | null> {
  try {
    const response = await api.client.get(`/v1/jobs/${encodeURIComponent(id)}`, {}, z.union([mirrorJobSchema, krillTombstoneSchema]), { cache: false, acceptStatuses: [410] });
    return response.data.status === 'open' ? response.data : null;
  } catch (error) {
    if (error instanceof KrillHttpError && error.status === 404) return null;
    throw error;
  }
}

/** Commit a whole page and its resume cursor together; a failed fetch never advances state. */
export async function applyChangePage(sql: Sql, api: KrillApi, page: KrillChangePage, fromCursor: string): Promise<void> {
  const ids = [...new Set(page.items.map((item) => item.jobId))];
  const jobs = new Map(await concurrentMap(ids, async (id) => [id, await readJob(api, id)] as const));
  await sql.begin(async (connection) => {
    const tx = connection as unknown as Sql;
    const affected = new Set<string>();
    for (const [id, job] of jobs) {
      const [previous] = await tx`select company_id from job_mirror where id = ${id}`;
      if (previous) affected.add(previous.company_id as string);
      if (job) {
        affected.add(job.company.id);
        await upsertJobs(tx, [job]);
      } else await tx`delete from job_mirror where id = ${id}`;
    }
    for (const [index, item] of page.items.entries()) {
      const company = jobs.get(item.jobId)?.company.id ?? null;
      const inserted = await tx`insert into worker_change(event_key, job_id, kind, date, company_id)
        values (${`${fromCursor}:${index}`}, ${item.jobId}, ${item.kind}, ${item.date}, ${company})
        on conflict do nothing returning event_key`;
      if (!inserted.length) continue;
      const opened = item.kind === 'opened' || item.kind === 'reopened' ? 1 : 0;
      const closed = item.kind === 'closed' ? 1 : 0;
      await tx`insert into job_counter_daily(date, new_today, closed_today) values (${item.date}, ${opened}, ${closed})
        on conflict(date) do update set new_today = job_counter_daily.new_today + excluded.new_today,
          closed_today = job_counter_daily.closed_today + excluded.closed_today`;
    }
    for (const id of affected) {
      await tx`insert into company_open_count(company_id, open) select ${id}, count(*)::int from job_mirror where company_id = ${id}
        on conflict(company_id) do update set open = excluded.open`;
      await tx`update company set open = (select open from company_open_count where company_id = ${id}) where company_id = ${id}`;
      const job = [...jobs.values()].find((j) => j?.company.id === id);
      if (job) {
        await tx`insert into company(company_id, slug, name, open, rank, updated_on)
          select ${id}, ${`company-${id}`}, ${job.company.name}, open, 1000000, current_date from company_open_count where company_id = ${id}
          on conflict(company_id) do update set name = excluded.name, open = excluded.open`;
      }
    }
    await tx`update worker_state set cursor = ${page.nextCursor ?? page.syncCursor}, updated_at = now() where name = 'changes'`;
  });
}

export async function sweepChanges(sql: Sql, api: KrillApi): Promise<{ pages: number; events: number } | null> {
  return withWorkerLock(sql, async (connection) => {
    const [state] = await connection`select cursor from worker_state where name = 'changes'`;
    if (!state?.cursor) return { pages: 0, events: 0 }; // Build must establish the baseline first.
    let cursor = state.cursor as string;
    let pages = 0;
    let events = 0;
    do {
      const page = (await api.client.get('/v1/changes', { cursor, pageSize: 100 }, changePageSchema, { cache: false })).data;
      await applyChangePage(connection, api, page, cursor);
      pages++; events += page.items.length;
      cursor = page.nextCursor ?? page.syncCursor;
      if (!page.nextCursor) break;
    } while (true);
    return { pages, events };
  });
}
