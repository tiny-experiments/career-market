import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { KrillLive, KrillLiveError } from '../src/krillLive.ts';
import { formatSalary, krillFilterParams, sortRows } from '../src/screener.ts';
import { hrefOf, likeEscape } from '../src/search.ts';
import { EMPTY_FILTERS, type ScreenerRow } from '@cm/core/screener';

const log = pino({ level: 'silent' });

function row(over: Partial<ScreenerRow> & { label: string; open: number }): ScreenerRow {
  return {
    id: over.label, kind: 'companies', href: '/', ticker: null, domain: null, change1w: null, change1m: null, signal: null,
    topProfession: null, topSkills: [], remoteShare: null, statedShare: null, spark: [], ...over,
  };
}
const ch = (value: number) => ({ range: '1W' as const, value, baseDate: '2026-11-06', partial: false, estimated: false });

describe('krillFilterParams', () => {
  it('maps every filter to krill parameters', () => {
    const p = krillFilterParams(
      { ...EMPTY_FILTERS, region: 'europe', country: 'DE', workMode: 'remote', level: 'staff', family: 'ai-ml', skill: 'ml:pytorch', salary: { currency: 'EUR', min: 100000 }, postedWithin: 7 },
      '2026-11-06',
    );
    expect(p).toEqual({
      region: 'europe', country: 'DE', workMode: 'remote', level: 'staff,principal', family: 'ai-ml', skills: 'ml:pytorch',
      salaryMin: 100000, currency: 'EUR', openedSince: '2026-10-30',
    });
  });
  it('sends nothing without filters (growth is not a krill filter)', () => {
    expect(krillFilterParams({ ...EMPTY_FILTERS, growth: 'ramping' }, '2026-11-06')).toEqual({});
  });
});

describe('sortRows', () => {
  const rows = [row({ label: 'B', open: 5, change1w: ch(0.1) }), row({ label: 'A', open: 9 }), row({ label: 'C', open: 7, change1w: ch(-0.2) })];
  it('sorts by open roles descending', () => {
    expect(sortRows(rows, 'open', 'desc').map((r) => r.label)).toEqual(['A', 'C', 'B']);
  });
  it('sorts by name ascending', () => {
    expect(sortRows(rows, 'name', 'asc').map((r) => r.label)).toEqual(['A', 'B', 'C']);
  });
  it('puts rows without a value last in both directions', () => {
    expect(sortRows(rows, 'change1w', 'desc').map((r) => r.label)).toEqual(['B', 'C', 'A']);
    expect(sortRows(rows, 'change1w', 'asc').map((r) => r.label)).toEqual(['C', 'B', 'A']);
  });
});

describe('formatSalary', () => {
  it('formats ranges with the currency symbol', () => {
    expect(formatSalary({ annualMin: 190000, annualMax: 270000, currency: 'USD' })).toBe('$190K – $270K');
    expect(formatSalary({ annualMin: 90000, annualMax: 90000, currency: 'GBP' })).toBe('£90K');
    expect(formatSalary({ annualMin: null, annualMax: null, currency: 'USD' })).toBeNull();
    expect(formatSalary(null)).toBeNull();
  });
});

describe('search helpers', () => {
  it('escapes LIKE wildcards', () => {
    expect(likeEscape('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
  it('builds hrefs for professions, specialties, companies and skills', () => {
    expect(hrefOf({ kind: 'profession', id: 'ai-ml', slug: 'aiml' })).toBe('/professions/aiml');
    expect(hrefOf({ kind: 'profession', id: 'ai-ml/ml-engineering', slug: 'aiml' })).toBe('/professions/aiml?specialty=ml-engineering');
    expect(hrefOf({ kind: 'company', id: 'co_x', slug: 'nvidia' })).toBe('/companies/nvidia');
    expect(hrefOf({ kind: 'skill', id: 'ml:pytorch', slug: 'pytorch' })).toBe('/skills/pytorch');
  });
});

describe('KrillLive', () => {
  const schema = z.object({ v: z.number() });
  function live(handler: () => Response, extra: { now?: () => number } = {}) {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return handler();
    }) as unknown as typeof fetch;
    return { api: new KrillLive({ baseUrl: 'https://krill.test', log, fetchImpl, ...extra }), calls: () => calls };
  }

  it('caches an answer and shares requests already in flight', async () => {
    const l = live(() => Response.json({ v: 1 }));
    const [a, b] = await Promise.all([l.api.get('/x', { a: 1 }, schema), l.api.get('/x', { a: 1 }, schema)]);
    await l.api.get('/x', { a: 1 }, schema);
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
    expect(l.calls()).toBe(1);
  });

  it('expires entries after the time to live', async () => {
    let t = 0;
    const l = live(() => Response.json({ v: 1 }), { now: () => t });
    await l.api.get('/x', {}, schema);
    t = 3_600_001;
    await l.api.get('/x', {}, schema);
    expect(l.calls()).toBe(2);
  });

  it('remembers a failure briefly instead of calling krill again', async () => {
    const l = live(() => new Response('{}', { status: 429, headers: { 'retry-after': '60' } }));
    await expect(l.api.get('/x', {}, schema)).rejects.toBeInstanceOf(KrillLiveError);
    await expect(l.api.get('/x', {}, schema)).rejects.toThrow(/busy/);
    expect(l.calls()).toBe(1);
  });

  it('waits for a short rate limit and retries', async () => {
    let n = 0;
    const slept: number[] = [];
    const fetchImpl = (async () => (++n === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '2' } }) : Response.json({ v: 5 }))) as unknown as typeof fetch;
    const api = new KrillLive({ baseUrl: 'https://krill.test', log, fetchImpl, sleep: async (ms) => void slept.push(ms) });
    expect(await api.get('/x', {}, schema)).toEqual({ v: 5 });
    expect(n).toBe(2);
    expect(slept).toEqual([2250]);
  });

  it('does not wait out a long rate limit', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 429, headers: { 'retry-after': '60' } })) as unknown as typeof fetch;
    const api = new KrillLive({ baseUrl: 'https://krill.test', log, fetchImpl, sleep: async () => {} });
    await expect(api.get('/x', {}, schema)).rejects.toThrow(/busy/);
  });

  it('rejects an unexpected shape', async () => {
    const l = live(() => Response.json({ v: 'no' }));
    await expect(l.api.get('/x', {}, schema)).rejects.toThrow(/unexpected shape/);
  });
});
