import { sql, type RawBuilder } from 'kysely';
import { addDays, daysBetween, toDay, type IsoDay } from '@cm/core/dates';
import type { KrillJob, KrillJobDetail } from '@cm/core/krillJob';
import { LEVEL_GROUPS, REGION_COUNTRIES } from '@cm/core/screener';
import type { Database } from '../database/client.ts';
import type {
  JobLookup,
  JobsPulseCounts,
  JobsQuery,
  JobsRepository,
  SimilarQuery,
} from '../modules/jobs/domain.ts';

/** What a job page needs from the description hydrator; it never overwrites newer sweep metadata. */
export interface DescriptionSource {
  lookup(id: string): Promise<JobLookup>;
}

/** A first visit waits this long for the posting's text before showing the page without it. */
const DESCRIPTION_BUDGET_MS = 5_000;

/** An exact count gets this long; past it the answer carries the planner's estimate. */
const COUNT_BUDGET_MS = 150;
const COUNT_TTL_MS = 5 * 60_000;
const COUNT_ENTRIES = 500;
const COUNTS_AT_ONCE = 3;

/** `software:* & eng:*` from what a person typed; null when nothing searchable is left. */
export function prefixQuery(text: string): string | null {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return words.length ? words.map((word) => `${word}:*`).join(' & ') : null;
}

function likePattern(text: string): string {
  return `%${text.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** A level group key stands for its levels; a plain level stands for itself. */
export function levelsFor(values: readonly string[]): string[] {
  return [
    ...new Set(
      values.flatMap(
        (value) =>
          LEVEL_GROUPS.find((group) => group.key === value)?.levels ?? [value],
      ),
    ),
  ];
}

const textArray = (values: readonly string[]) => sql`${[...values]}::text[]`;

const SEARCH_VECTOR = sql`to_tsvector('simple', company_name || ' ' || title)`;

function conditions(query: JobsQuery, today: IsoDay): RawBuilder<unknown>[] {
  const where: RawBuilder<unknown>[] = [];
  if (query.q) {
    const terms = prefixQuery(query.q);
    where.push(
      terms === null
        ? sql`false`
        : sql`${SEARCH_VECTOR} @@ to_tsquery('simple', ${terms})`,
    );
  }
  if (query.company) where.push(sql`company_id = ${query.company}`);
  if (query.companyContains)
    where.push(
      sql`lower(company_name) like ${likePattern(query.companyContains)} escape '\\'`,
    );
  if (query.family?.length)
    where.push(sql`family = any(${textArray(query.family)})`);
  if (query.specialty) where.push(sql`specialty = ${query.specialty}`);
  if (query.skill) where.push(sql`payload->'skills' ? ${query.skill}`);
  if (query.region)
    where.push(sql`countries && ${textArray(REGION_COUNTRIES[query.region])}`);
  if (query.country)
    where.push(sql`countries @> ${textArray([query.country])}`);
  if (query.workMode?.length)
    where.push(sql`work_mode = any(${textArray(query.workMode)})`);
  if (query.level?.length)
    where.push(sql`level = any(${textArray(levelsFor(query.level))})`);
  if (query.postedWithin)
    where.push(sql`opened_at >= ${addDays(today, -query.postedWithin)}::date`);

  // Annual figures only compare within one currency, so ranking by pay narrows to it.
  const priced = query.salaryMin !== undefined || query.sort === 'salary';
  const currency = query.currency ?? (priced ? 'USD' : undefined);
  if (currency && (priced || query.hasPay === 'true'))
    where.push(sql`salary_currency = ${currency}`);
  if (query.hasPay === 'true' || query.sort === 'salary')
    where.push(sql`(salary_min is not null or salary_max is not null)`);
  if (query.salaryMin !== undefined)
    where.push(sql`coalesce(salary_max, salary_min) >= ${query.salaryMin}`);
  return where;
}

function whereClause(where: readonly RawBuilder<unknown>[]) {
  return where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``;
}

function orderBy(sort: JobsQuery['sort']) {
  if (sort === 'salary')
    return sql`coalesce(salary_max, salary_min) desc, opened_at desc, id`;
  if (sort === 'oldest') return sql`opened_at asc, id desc`;
  return sql`opened_at desc, id`;
}

/** Filters only: the same rows have the same count on every page and most sorts. */
function countKey(query: JobsQuery): string {
  const { page: _page, pageSize: _size, sort, ...filters } = query;
  return JSON.stringify({ ...filters, pay: sort === 'salary' });
}

function hasFilters(query: JobsQuery): boolean {
  const { page: _page, pageSize: _size, sort, currency: _c, ...rest } = query;
  return sort === 'salary' || Object.values(rest).some((v) => v !== undefined);
}

export function createMirrorJobs(deps: {
  db: Database;
  descriptions: DescriptionSource;
  today?: () => IsoDay;
  descriptionBudgetMs?: number;
  countBudgetMs?: number;
}): JobsRepository {
  const today = deps.today ?? (() => toDay(new Date()));
  const budgetMs = deps.descriptionBudgetMs ?? DESCRIPTION_BUDGET_MS;
  const countBudgetMs = deps.countBudgetMs ?? COUNT_BUDGET_MS;
  const counted = new Map<string, { total: number; at: number }>();
  const counting = new Map<string, Promise<number>>();

  /** Ages move every day; the stored record only changes when the role does. */
  function fresh<T extends KrillJob>(job: T): T {
    return { ...job, ageDays: daysBetween(job.openedAt, today()) };
  }

  async function rowsOf(
    where: readonly RawBuilder<unknown>[],
    order: RawBuilder<unknown>,
    limit: number,
    offset = 0,
  ): Promise<KrillJob[]> {
    // Ids first: skipping rows never touches the large stored records.
    const { rows: found } = await sql<{ id: string }>`
      select id from job_mirror ${whereClause(where)}
      order by ${order} limit ${limit} offset ${offset}`.execute(deps.db);
    if (found.length === 0) return [];
    const ids = found.map((row) => row.id);
    const { rows } = await sql<{ payload: KrillJob }>`
      select payload - 'description' as payload from job_mirror
      where id = any(${textArray(ids)})`.execute(deps.db);
    const byId = new Map(rows.map((row) => [row.payload.id, row.payload]));
    return ids.flatMap((id) => {
      const job = byId.get(id);
      return job ? [fresh(job)] : [];
    });
  }

  function exactCount(
    key: string,
    where: readonly RawBuilder<unknown>[],
  ): Promise<number> | null {
    const running = counting.get(key);
    if (running) return running;
    if (counting.size >= COUNTS_AT_ONCE) return null;
    const started = sql<{ n: number }>`
      select count(*)::int as n from job_mirror ${whereClause(where)}`
      .execute(deps.db)
      .then((result) => {
        const total = result.rows[0]?.n ?? 0;
        counted.delete(key);
        counted.set(key, { total, at: Date.now() });
        if (counted.size > COUNT_ENTRIES)
          counted.delete(counted.keys().next().value as string);
        return total;
      })
      .finally(() => counting.delete(key));
    // Nobody may be waiting on it any more; a failure just leaves no cached figure.
    started.catch(() => undefined);
    counting.set(key, started);
    return started;
  }

  async function estimatedCount(
    where: readonly RawBuilder<unknown>[],
  ): Promise<number> {
    const { rows } = await sql<{
      'QUERY PLAN': { Plan: { 'Plan Rows': number } }[];
    }>`explain (format json) select 1 from job_mirror ${whereClause(where)}`.execute(
      deps.db,
    );
    return rows[0]?.['QUERY PLAN'][0]?.Plan['Plan Rows'] ?? 0;
  }

  /** Exact whenever that is quick or already known; a labelled estimate otherwise. */
  async function totalOf(
    query: JobsQuery,
    where: readonly RawBuilder<unknown>[],
  ): Promise<{ total: number; totalIsEstimate?: true }> {
    if (!hasFilters(query)) {
      const { rows } = await sql<{ total: number }>`
        select coalesce(sum(open), 0)::int as total from company_open_count`.execute(
        deps.db,
      );
      return { total: rows[0]?.total ?? 0 };
    }
    const key = countKey(query);
    const known = counted.get(key);
    if (known && Date.now() - known.at < COUNT_TTL_MS)
      return { total: known.total };
    const running = exactCount(key, where);
    if (running) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const total = await Promise.race([
        running,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), countBudgetMs);
        }),
      ]).finally(() => clearTimeout(timer));
      if (total !== null) return { total };
    }
    return { total: await estimatedCount(where), totalIsEstimate: true };
  }

  async function storedJob(id: string): Promise<KrillJobDetail | null> {
    const { rows } = await sql<{
      payload: KrillJob;
    }>`select payload - 'description' as payload from job_mirror where id = ${id}`.execute(
      deps.db,
    );
    return rows[0] ? { ...fresh(rows[0].payload), description: null } : null;
  }

  async function closedFromLedger(id: string): Promise<JobLookup> {
    const { rows } = await sql<{ date: IsoDay }>`
      select date from worker_change where job_id = ${id} and kind = 'closed'
      order by date desc limit 1`.execute(deps.db);
    const closure = rows[0];
    return closure
      ? {
          kind: 'closed',
          tombstone: {
            id,
            status: 'closed',
            closedAt: closure.date,
            openedAt: null,
            openedSource: null,
            family: null,
          },
        }
      : { kind: 'missing' };
  }

  return {
    async lookup(id) {
      // A slow or failing text fetch never costs the visitor the page.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const budget = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), budgetMs);
      });
      const found = await Promise.race([
        deps.descriptions.lookup(id).catch(() => null),
        budget,
      ]).finally(() => clearTimeout(timer));
      if (found === null) {
        const job = await storedJob(id);
        return job ? { kind: 'open', job } : closedFromLedger(id);
      }
      if (found.kind === 'open')
        return { kind: 'open', job: fresh(found.job) };
      return found.kind === 'missing' ? closedFromLedger(id) : found;
    },

    async list(query) {
      const where = conditions(query, today());
      const [items, count] = await Promise.all([
        rowsOf(
          where,
          orderBy(query.sort),
          query.pageSize,
          (query.page - 1) * query.pageSize,
        ),
        totalOf(query, where),
      ]);
      return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        ...count,
      };
    },

    similar(params: SimilarQuery) {
      const where: RawBuilder<unknown>[] = [];
      if (params.family) where.push(sql`family = ${params.family}`);
      if (params.specialty) where.push(sql`specialty = ${params.specialty}`);
      if (params.level) where.push(sql`level = ${params.level}`);
      if (params.country)
        where.push(sql`countries @> ${textArray([params.country])}`);
      if (params.skillsAny?.length)
        where.push(sql`payload->'skills' ?| ${textArray(params.skillsAny)}`);
      return rowsOf(where, orderBy('newest'), params.limit);
    },

    async pulseCounts(): Promise<JobsPulseCounts> {
      const { rows } = await sql<JobsPulseCounts>`
        select
          (select coalesce(sum(open), 0)::int from company_open_count) as open,
          (select count(*)::int from job_mirror where opened_at >= ${addDays(today(), -1)}::date) as "newToday",
          (select count(*)::int from job_mirror where salary_min is not null or salary_max is not null) as "withPay"`.execute(
        deps.db,
      );
      return rows[0] as JobsPulseCounts;
    },
  };
}
