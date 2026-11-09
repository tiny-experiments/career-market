import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { companyChange, companySignal, isCoverageJump } from '../src/compute/companySignal.ts';
import { percentile, salaryBand } from '../src/compute/salaryBand.ts';
import { KrillApi } from '../src/krill/api.ts';
import { KrillClient } from '../src/krill/client.ts';
import { locationOf, salaryText } from '../src/professions/build.ts';

describe('salaryBand', () => {
  const job = (min: number, max: number) => ({ annualMin: min, annualMax: max, currency: 'USD' });

  it('takes p25 to p75 of the range midpoints', () => {
    const jobs = Array.from({ length: 40 }, (_, i) => job(100_000 + i * 1000, 120_000 + i * 1000));
    const band = salaryBand(jobs, 'USD');
    expect(band?.n).toBe(40);
    expect(band?.p50).toBe(Math.round(percentile(jobs.map((j) => (j.annualMin + j.annualMax) / 2), 0.5)));
    expect(band && band.p25 < band.p50 && band.p50 < band.p75).toBe(true);
  });

  it('shows no band below 30 roles with pay, and ignores other currencies', () => {
    expect(salaryBand(Array.from({ length: 29 }, () => job(1, 3)), 'USD')).toBeNull();
    expect(salaryBand(Array.from({ length: 40 }, () => ({ ...job(1, 3), currency: 'EUR' })), 'USD')).toBeNull();
  });
});

describe('companyChange and companySignal', () => {
  const days = [
    { date: '2026-11-02', open: 40, new: 40, closed: 0 },
    { date: '2026-11-03', open: 50, new: 10, closed: 0 },
    { date: '2026-11-04', open: 54, new: 5, closed: 1 },
    { date: '2026-11-05', open: 57, new: 4, closed: 1 },
  ];

  it('is a partial change since the first comparable day until a week of days exists', () => {
    const c = companyChange(days, '2026-11-05');
    expect(c?.change).toMatchObject({ baseDate: '2026-11-03', partial: true });
    expect(c?.change.value).toBeCloseTo(0.14, 10);
    expect(c).toMatchObject({ baseOpen: 50, newSum: 9, closedSum: 2 });
  });

  it('measures 1W on observed days once the base day is comparable', () => {
    const more = [...days, { date: '2026-11-10', open: 60, new: 3, closed: 0 }];
    const c = companyChange(more, '2026-11-10');
    expect(c?.change).toMatchObject({ baseDate: '2026-11-03', partial: false });
  });

  it('gives no change for a company that had no open role on the base day', () => {
    expect(companyChange([{ date: '2026-11-03', open: 0, new: 0, closed: 0 }, { date: '2026-11-04', open: 5, new: 5, closed: 0 }], '2026-11-04')).toBeNull();
  });

  it('treats a move of more than half in a week as board coverage, not hiring', () => {
    const at = (value: number) => ({ range: '1W' as const, value, baseDate: '2026-11-03', partial: true, estimated: false });
    expect(isCoverageJump(at(2.007))).toBe(true);
    expect(isCoverageJump(at(-0.6))).toBe(true);
    expect(isCoverageJump(at(0.14))).toBe(false);
    expect(isCoverageJump(null)).toBe(false);
  });

  it('classifies signals by thresholds', () => {
    const at = (value: number) => ({ range: '1W' as const, value, baseDate: '2026-11-03', partial: false, estimated: false });
    expect(companySignal(at(0.14))).toBe('HOT');
    expect(companySignal(at(0.06))).toBe('STRONG');
    expect(companySignal(at(0.02))).toBe('RISING');
    expect(companySignal(at(0))).toBe('STEADY');
    expect(companySignal(at(-0.021))).toBe('COOLING');
    expect(companySignal(null)).toBeNull();
  });
});

describe('role text', () => {
  it('writes a US location as city and state', () => {
    expect(locationOf({ places: [{ city: 'San Jose', admin1Code: 'CA', countryCode: 'US', label: 'San Jose' }], locations: [] })).toBe('San Jose, CA');
    expect(locationOf({ places: [{ city: 'London', admin1Code: null, countryCode: 'GB', label: 'London' }], locations: [] })).toBe('London, GB');
    expect(locationOf({ places: [], locations: ['Remote - EMEA'] })).toBe('Remote - EMEA');
  });

  it('writes pay as a compact range or nothing', () => {
    expect(salaryText({ salary: { currency: 'USD', annualMin: 220_000, annualMax: 320_000 } })).toBe('$220K – $320K');
    expect(salaryText({ salary: { currency: 'USD', annualMin: 200_000, annualMax: 200_000 } })).toBe('$200K');
    expect(salaryText({ salary: null })).toBeNull();
  });
});

describe('KrillApi.companyDaily', () => {
  it('sends the filters again with every page', async () => {
    const urls: string[] = [];
    const impl = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      urls.push(url.search);
      const first = !url.searchParams.get('cursor');
      return new Response(
        JSON.stringify({
          items: [{ date: '2026-11-06', companyId: first ? 'co_a' : 'co_b', family: 'ai-ml', open: 1, new: 0, closed: 0 }],
          pageSize: 1000,
          nextCursor: first ? 'next' : null,
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const api = new KrillApi(new KrillClient({ baseUrl: 'https://krill.test', ratePerMinute: 60_000, timeoutMs: 1000, logger: pino({ level: 'silent' }), fetchImpl: impl, sleep: async () => {} }));
    const rows = await api.companyDaily({ from: '2026-11-06', to: '2026-11-06', groupBy: 'family' });
    expect(rows.map((r) => r.companyId)).toEqual(['co_a', 'co_b']);
    expect(urls[1]).toContain('groupBy=family');
    expect(urls[1]).toContain('cursor=next');
  });
});
