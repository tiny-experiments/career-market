import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import { careersUrl, placeholderSlug, writeCompanyInputs } from '../src/companies/write.ts';
import type { CompanyPull } from '../src/companies/pull.ts';
import { planCompanyDays } from '../src/companies/pull.ts';
import { companySeries } from '@cm/core/company';
import { changePoints, companySignal, explainer, signalState } from '../src/companies/compute.ts';
import { computeChange } from '../src/compute/changes.ts';

const row = (date: string, open: number, n = 0, closed = 0) => ({ date, open, new: n, closed });

describe('companySeries', () => {
  it('leaves out bootstrap days and the day a board is first fetched', () => {
    const s = companySeries([row('2026-11-02', 100, 100), row('2026-11-03', 100), row('2026-11-04', 110, 12, 2), row('2026-11-05', 0), row('2026-11-06', 40, 40)], '2026-11-06');
    expect(s.days.map((d) => [d.date.slice(8), d.excluded])).toEqual([
      ['02', true],
      ['03', true],
      ['04', false],
      ['05', false],
      ['06', true],
    ]);
    // The board that vanished and returned on the 6th starts a new segment.
    expect(s.segmentStart).toBe('2026-11-06');
  });

  it('treats a missing day as zero and a company with no open roles today as having no segment', () => {
    const s = companySeries([row('2026-11-02', 5, 5)], '2026-11-04');
    expect(s.days).toHaveLength(3);
    expect(s.segmentStart).toBeNull();
    expect(changePoints(s)).toEqual([]);
  });
});

describe('board events', () => {
  it('treats a bulk first fetch of a second board as a segment restart', () => {
    const s = companySeries([row('2026-11-03', 435, 435), row('2026-11-04', 436, 1), row('2026-11-05', 438, 2), row('2026-11-06', 1736, 1302, 4)], '2026-11-06');
    expect(s.segmentStart).toBe('2026-11-06');
    expect(companySignal(s, '2026-11-06')).toBeNull();
  });
  it('keeps ordinary hiring days', () => {
    const s = companySeries([row('2026-11-03', 1681, 51), row('2026-11-04', 1684, 3), row('2026-11-05', 1693, 21, 12)], '2026-11-05');
    expect(s.segmentStart).toBe('2026-11-03');
    expect(s.days.filter((d) => !d.excluded)).toHaveLength(2);
  });
});

describe('board change days', () => {
  it('marks a board-change day apart from krill bootstrap days', () => {
    const s = companySeries([row('2026-11-03', 435, 435), row('2026-11-04', 436, 1), row('2026-11-05', 1736, 1302, 4)], '2026-11-05');
    expect(s.days.map((d) => [d.date.slice(8), d.excluded, d.boardChange])).toEqual([
      ['02', true, false],
      ['03', true, false],
      ['04', false, false],
      ['05', true, true],
    ]);
  });
});

describe('companySignal', () => {
  const rows = [row('2026-11-02', 100, 100), row('2026-11-03', 100), row('2026-11-04', 104, 6, 2), row('2026-11-05', 109, 8, 3), row('2026-11-06', 112, 7, 4)];
  const series = companySeries(rows, '2026-11-06');

  it('sums openings and closings over the comparable days and flags a short window', () => {
    const s = companySignal(series, '2026-11-06');
    expect(s).toMatchObject({ windowFrom: '2026-11-04', windowDays: 3, opened: 21, closed: 9, openBase: 100, partial: true });
    expect(s?.change).toBeCloseTo(0.12);
    expect(s?.state).toBe('RAMPING');
  });

  it('has no signal before a comparable day exists', () => {
    expect(companySignal(companySeries(rows.slice(0, 2), '2026-11-03'), '2026-11-03')).toBeNull();
  });

  it('classifies the mockup examples', () => {
    expect(signalState({ opened: 20, closed: 62, change: -0.18 })).toBe('FREEZING');
    expect(signalState({ opened: 20, closed: 44, change: -0.11 })).toBe('COOLING');
    expect(signalState({ opened: 30, closed: 10, change: 0.07 })).toBe('RAMPING');
    expect(signalState({ opened: 2, closed: 1, change: 0.5 })).toBe('STEADY');
  });
});

describe('change of a company that was fetched late', () => {
  it('compares from its own first day, not from zero', () => {
    const series = companySeries([row('2026-11-05', 200, 200), row('2026-11-06', 210, 15, 5)], '2026-11-06');
    const c = computeChange(changePoints(series), '2026-11-06', '1W');
    expect(c).toMatchObject({ partial: true, baseDate: '2026-11-05' });
    expect(c?.value).toBeCloseTo(0.05);
  });
});

describe('explainer', () => {
  const sig = { state: 'RAMPING', windowFrom: '2026-11-04', windowDays: 3, opened: 24, closed: 10, openBase: 100, partial: true, change: 0.14 } as const;
  it('writes the ratio and the level that moved most', () => {
    expect(explainer(sig, [{ level: 'senior', delta: 9 }, { level: 'mid', delta: 1 }])).toBe(
      'Openings outpace closings 2.4 : 1 over 3 days since 4 Nov; senior roles up most.',
    );
  });
  it('says so when nothing is comparable yet', () => {
    expect(explainer(null, [])).toMatch(/bootstrap|counted every role/);
  });
  it('writes closings first when they dominate', () => {
    expect(explainer({ ...sig, opened: 5, closed: 20 }, [{ level: 'mid', delta: -6 }])).toBe(
      'Closings outpace openings 4.0 : 1 over 3 days since 4 Nov; mid roles down most.',
    );
  });
});

describe('planCompanyDays', () => {
  const observed = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  it('fetches recent days and any day not stored yet', () => {
    expect(planCompanyDays(observed, new Set(['2026-11-02']), '2026-11-06', 2, false)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(planCompanyDays(observed, new Set(observed), '2026-11-06', 2, false)).toEqual(['2026-11-05', '2026-11-06']);
    expect(planCompanyDays(observed, new Set(observed), '2026-11-06', 2, true)).toEqual(observed);
  });
});

describe('careersUrl', () => {
  it('picks the live board with the most roles', () => {
    expect(
      careersUrl([
        { url: 'https://a.example/careers', status: 'live', openJobs: 0 },
        { url: 'https://b.example/jobs', status: 'live', openJobs: 90 },
        { url: 'https://c.example', status: 'gone', openJobs: 500 },
      ]),
    ).toBe('https://b.example/jobs');
    expect(careersUrl([])).toBeNull();
  });
});

it('keeps one-role companies and follows the directory beyond the old 150-page cap', async () => {
  const { KrillCompanyApi } = await import('../src/krill/companyApi.ts');
  const { KrillClient } = await import('../src/krill/client.ts');
  const { pino } = await import('pino');
  const api = new KrillCompanyApi(new KrillClient({ baseUrl: 'https://source.test', ratePerMinute: 500,
    timeoutMs: 1000, logger: pino({ level: 'silent' }), sleep: async () => {},
    fetchImpl: (async (input) => {
      const index = Number(new URL(String(input)).searchParams.get('cursor') ?? 0);
      return new Response(JSON.stringify({ items: [{ id: `co_${String(index).padStart(16, '0')}`, name: `Company ${index}`, domain: null, openJobs: 1, ats: [] }], pageSize: 100,
        nextCursor: index < 150 ? String(index + 1) : null }));
    }) as typeof fetch,
  }));
  expect(await api.directory(1)).toHaveLength(151);
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('writeCompanyInputs slugs (dedicated test database)', () => {
  let sql: Sql;
  beforeAll(async () => { sql = createSql(process.env.TEST_DATABASE_URL!); await migrate(sql); });
  afterAll(async () => { await sql.end(); });
  beforeEach(async () => { await sql`truncate company, company_daily, company_slice_daily, company_profile`; });

  const listing = (id: string, name: string) => ({ id, name, domain: null, ats: [], openJobs: 12 });
  const pull = (directory: ReturnType<typeof listing>[]) =>
    ({ asOf: '2026-11-09', days: [], directory, stats: [], slices: [], profiles: new Map() }) as unknown as CompanyPull;

  it('names a sweep-created company on the build and leaves a real company- slug alone', async () => {
    await sql`insert into company(company_id, slug, name, open, rank, updated_on) values
      ('cmp_swept', ${placeholderSlug('cmp_swept')}, 'Swept Co', 3, 1000000, '2026-11-08'),
      ('cmp_real', 'company-forge', 'Company Forge', 3, 1, '2026-11-08')`;
    await sql.begin((tx) => writeCompanyInputs(tx as unknown as Sql, pull([listing('cmp_real', 'Company Forge'), listing('cmp_swept', 'Swept Co')])));
    const slugs = Object.fromEntries((await sql`select company_id, slug from company`).map((r) => [r.company_id, r.slug]));
    expect(slugs).toEqual({ cmp_swept: 'swept-co', cmp_real: 'company-forge' });
  });
});
