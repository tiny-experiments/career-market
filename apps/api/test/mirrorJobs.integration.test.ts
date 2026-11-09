import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import type { KrillJob } from '@cm/core/krillJob';
import { createDatabase, type Database } from '../src/database/client.ts';
import {
  createMirrorJobs,
  levelsFor,
  prefixQuery,
} from '../src/integrations/mirrorJobs.ts';
import type { JobLookup, JobsQuery } from '../src/modules/jobs/domain.ts';

const url = process.env.TEST_DATABASE_URL;
const TODAY = '2026-11-09';

function job(id: string, over: Partial<KrillJob> = {}): KrillJob {
  return {
    id,
    status: 'open',
    title: 'Software Engineer',
    company: { id: 'acme', name: 'Acme' },
    url: null,
    applyUrl: null,
    employmentType: 'FULL_TIME',
    workMode: 'remote',
    locations: ['London'],
    places: [{ label: 'London', countryCode: 'GB' }],
    salary: null,
    postedAt: null,
    openedAt: '2026-11-08',
    openedSource: 'posted',
    firstSeenAt: '2026-11-08',
    lastSeenAt: TODAY,
    family: 'software',
    specialty: 'backend',
    level: 'senior',
    skills: ['lang:python'],
    languages: [],
    tools: [],
    ageDays: 0,
    repostCount: 0,
    staleScore: 0.1,
    ...over,
  };
}

const pay = (currency: string, annualMin: number, annualMax: number) => ({
  min: annualMin,
  max: annualMax,
  currency,
  period: 'year',
  annualMin,
  annualMax,
});

const JOBS = [
  job('kr_a', { title: 'Backend Engineer', salary: pay('USD', 100_000, 150_000) }),
  job('kr_b', {
    title: 'Data Engineer',
    company: { id: 'beta', name: 'Beta Labs' },
    family: 'data',
    specialty: 'data-engineering',
    level: 'staff',
    workMode: 'hybrid',
    places: [{ label: 'Berlin', countryCode: 'DE' }],
    openedAt: '2026-10-01',
    salary: pay('EUR', 90_000, 120_000),
    skills: ['tool:spark'],
  }),
  job('kr_c', {
    title: 'Principal Scientist',
    company: { id: 'gamma', name: '100%_Gamma' },
    family: 'ai-ml',
    specialty: null,
    level: 'principal',
    workMode: 'onsite',
    places: [{ label: 'New York', countryCode: 'US' }],
    openedAt: '2026-11-09',
    salary: pay('USD', 200_000, 300_000),
    skills: ['lang:python', 'ml:pytorch'],
  }),
];

const BASE: JobsQuery = { page: 1, pageSize: 50, sort: 'newest' };

describe('search helpers', () => {
  it('turns typed words into a prefix query and drops symbols', () => {
    expect(prefixQuery('Data  Eng')).toBe('data:* & eng:*');
    expect(prefixQuery("c++ & (o'brien)")).toBe('c:* & o:* & brien:*');
    expect(prefixQuery('+++')).toBeNull();
  });
  it('expands seniority groups and keeps plain levels', () => {
    expect(levelsFor(['staff', 'senior'])).toEqual(['staff', 'principal', 'senior']);
    expect(levelsFor(['intern'])).toEqual(['intern']);
  });
});

describe.skipIf(!url)('job mirror reads (real Postgres)', () => {
  let db: Database;
  let setup: ReturnType<typeof createSql>;
  const descriptions = { lookup: vi.fn<(id: string) => Promise<JobLookup>>() };
  const repo = (countBudgetMs = 5_000) =>
    createMirrorJobs({
      db,
      descriptions,
      today: () => TODAY,
      descriptionBudgetMs: 50,
      countBudgetMs,
    });
  const ids = async (query: Partial<JobsQuery>) =>
    (await repo().list({ ...BASE, ...query })).items.map((item) => item.id);

  beforeAll(async () => {
    if (!new URL(url!).pathname.slice(1).startsWith('cm_test'))
      throw new Error('Use an isolated cm_test* database');
    setup = createSql(url!, { max: 1 });
    await migrate(setup);
    db = createDatabase(url!);
  });
  beforeEach(async () => {
    descriptions.lookup.mockReset();
    await setup`truncate job_mirror, worker_change, company_open_count`;
    await setup`insert into company_open_count values ('acme', 1), ('beta', 1), ('gamma', 1)`;
    for (const j of JOBS) {
      await setup`insert into job_mirror (id, company_id, company_name, title, family, specialty, level,
        countries, locations, work_mode, remote, opened_at, first_seen_at, last_seen_at, opened_source,
        salary_min, salary_max, salary_currency, repost_count, stale_score, payload)
        values (${j.id}, ${j.company.id}, ${j.company.name}, ${j.title}, ${j.family}, ${j.specialty}, ${j.level},
          ${j.places.map((p) => p.countryCode as string)}, ${j.locations}, ${j.workMode}, ${j.workMode === 'remote'},
          ${j.openedAt}, ${j.firstSeenAt}, ${j.lastSeenAt}, ${j.openedSource},
          ${j.salary?.annualMin ?? null}, ${j.salary?.annualMax ?? null}, ${j.salary?.currency ?? null},
          ${j.repostCount}, ${j.staleScore}, ${setup.json(j as never)})`;
    }
  });
  afterAll(async () => {
    await db?.destroy();
    await setup?.end();
  });

  it('sorts newest first by default, oldest and by pay on request, and refreshes ages', async () => {
    expect(await ids({})).toEqual(['kr_c', 'kr_a', 'kr_b']);
    expect(await ids({ sort: 'oldest' })).toEqual(['kr_b', 'kr_a', 'kr_c']);
    expect(await ids({ sort: 'salary' })).toEqual(['kr_c', 'kr_a']);
    expect(await ids({ sort: 'salary', currency: 'EUR' })).toEqual(['kr_b']);
    const page = await repo().list(BASE);
    expect(page.items.at(-1)).toMatchObject({ id: 'kr_b', ageDays: 39 });
  });

  it('pages and counts every match', async () => {
    const page = await repo().list({ ...BASE, page: 2, pageSize: 2 });
    expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page.items.map((item) => item.id)).toEqual(['kr_b']);
  });

  it('takes the unfiltered total from the live company counts', async () => {
    await setup`truncate company_open_count`;
    await setup`insert into company_open_count values ('acme', 7), ('beta', 5)`;
    expect(await repo().list(BASE)).toMatchObject({ total: 12 });
  });

  it('labels a slow count as an estimate, then answers exactly once it has landed', async () => {
    const slow = repo(0);
    const query = { ...BASE, family: ['software'] };
    const first = await slow.list(query);
    expect(first.items.map((item) => item.id)).toEqual(['kr_a']);
    if (first.totalIsEstimate) expect(first.total).toBeGreaterThanOrEqual(1);
    await vi.waitFor(async () => {
      const again = await slow.list(query);
      expect(again).toMatchObject({ total: 1 });
      expect(again.totalIsEstimate).toBeUndefined();
    });
  });

  it.each<[Partial<JobsQuery>, string[]]>([
    [{ q: 'data eng' }, ['kr_b']],
    [{ q: 'beta' }, ['kr_b']],
    [{ q: '+++' }, []],
    [{ company: 'gamma' }, ['kr_c']],
    [{ companyContains: '100%_' }, ['kr_c']],
    [{ companyContains: '100xx' }, []],
    [{ family: ['data', 'ai-ml'] }, ['kr_c', 'kr_b']],
    [{ specialty: 'backend' }, ['kr_a']],
    [{ skill: 'ml:pytorch' }, ['kr_c']],
    [{ region: 'dach' }, ['kr_b']],
    [{ region: 'north-america' }, ['kr_c']],
    [{ country: 'GB' }, ['kr_a']],
    [{ workMode: ['hybrid', 'onsite'] }, ['kr_c', 'kr_b']],
    [{ level: ['staff'] }, ['kr_c', 'kr_b']],
    [{ level: ['senior'] }, ['kr_a']],
    [{ postedWithin: 1 }, ['kr_c', 'kr_a']],
    [{ hasPay: 'true' }, ['kr_c', 'kr_a', 'kr_b']],
    [{ hasPay: 'true', currency: 'EUR' }, ['kr_b']],
    [{ salaryMin: 150_000 }, ['kr_c', 'kr_a']],
    [{ salaryMin: 250_000 }, ['kr_c']],
    [{ salaryMin: 100_000, currency: 'EUR' }, ['kr_b']],
  ])('filters %j', async (query, expected) => {
    expect(await ids(query)).toEqual(expected);
    expect((await repo().list({ ...BASE, ...query })).total).toBe(expected.length);
  });

  it('finds similar roles on profession, seniority, country and any shared skill', async () => {
    const similar = (params: Parameters<ReturnType<typeof repo>['similar']>[0]) =>
      repo().similar(params).then((rows) => rows.map((row) => row.id));
    expect(await similar({ family: 'software', limit: 5 })).toEqual(['kr_a']);
    expect(await similar({ skillsAny: ['ml:pytorch', 'tool:spark'], limit: 5 })).toEqual(['kr_c', 'kr_b']);
    expect(await similar({ family: 'data', level: 'staff', country: 'DE', limit: 5 })).toEqual(['kr_b']);
    expect(await similar({ family: 'data', country: 'US', limit: 5 })).toEqual([]);
  });

  it('reports live counts for the Jobs strip', async () => {
    expect(await repo().pulseCounts()).toEqual({ open: 3, newToday: 2, withPay: 3 });
  });

  describe('lookup', () => {
    const open = { kind: 'open', job: { ...JOBS[0]!, description: 'Text' } } as const;

    it('serves the hydrated posting with a fresh age', async () => {
      descriptions.lookup.mockResolvedValue(open);
      expect(await repo().lookup('kr_a')).toMatchObject({
        kind: 'open',
        job: { description: 'Text', ageDays: 1 },
      });
    });
    it('falls back to the stored role without its text when the fetch fails or is slow', async () => {
      descriptions.lookup.mockRejectedValueOnce(new Error('upstream'));
      expect(await repo().lookup('kr_a')).toMatchObject({
        kind: 'open',
        job: { id: 'kr_a', description: null },
      });
      descriptions.lookup.mockReturnValueOnce(new Promise(() => undefined));
      expect(await repo().lookup('kr_b')).toMatchObject({
        kind: 'open',
        job: { id: 'kr_b', description: null },
      });
    });
    it('turns a role no longer mirrored into a closed page when its closing was recorded', async () => {
      descriptions.lookup.mockResolvedValue({ kind: 'missing' });
      await setup`insert into worker_change (event_key, job_id, kind, date) values
        ('c:0', 'kr_gone', 'opened', '2026-11-01'), ('c:1', 'kr_gone', 'closed', '2026-11-07')`;
      expect(await repo().lookup('kr_gone')).toEqual({
        kind: 'closed',
        tombstone: {
          id: 'kr_gone',
          status: 'closed',
          closedAt: '2026-11-07',
          openedAt: null,
          openedSource: null,
          family: null,
        },
      });
      expect(await repo().lookup('kr_never')).toEqual({ kind: 'missing' });
    });
    it('passes a closed answer straight through', async () => {
      const tombstone = {
        id: 'kr_x',
        status: 'closed',
        closedAt: TODAY,
        openedAt: '2026-11-01',
        openedSource: 'posted',
        family: 'data',
      } as const;
      descriptions.lookup.mockResolvedValue({ kind: 'closed', tombstone });
      expect(await repo().lookup('kr_x')).toEqual({ kind: 'closed', tombstone });
    });
  });
});
