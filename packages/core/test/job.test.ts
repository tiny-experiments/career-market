import { describe, expect, it } from 'vitest';
import {
  companySignal,
  employmentLabel,
  formatMoney,
  formatMoneyShort,
  isJobId,
  jobSlug,
  payMidpoint,
  percentile,
  postingHealth,
  salaryLabel,
  salaryPosition,
  salaryRangeShort,
  shortLocation,
  workModeLabel,
  type TypicalWindow,
} from '../src/job.ts';

describe('postingHealth', () => {
  it('looks active for a young posting', () => {
    const h = postingHealth({ ageDays: 48, repostCount: 0, openedSource: 'posted' }, null);
    expect(h.state).toBe('active');
    expect(h.headline).toBe('Looks active');
    expect(h.detail).toBe('Posted 48 days ago and still open.');
  });

  it('says "first seen" when the employer gave no posted day, and "today" for day zero', () => {
    expect(postingHealth({ ageDays: 0, repostCount: 0, openedSource: 'first_seen' }, null).detail).toBe('First seen today and still open.');
    expect(postingHealth({ ageDays: 1, repostCount: 0, openedSource: 'posted' }, null).detail).toBe('Posted 1 day ago and still open.');
  });

  it('flags a possible ghost job by age or reposts, and gives the reasons', () => {
    const old = postingHealth({ ageDays: 159, repostCount: 2, openedSource: 'posted' }, null);
    expect(old.state).toBe('ghost');
    expect(old.headline).toBe('Possible ghost job');
    expect(old.detail).toBe('Open 159 days, reposted 2 times.');
    expect(postingHealth({ ageDays: 119, repostCount: 0, openedSource: 'posted' }, null).state).toBe('active');
    expect(postingHealth({ ageDays: 120, repostCount: 0, openedSource: 'posted' }, null).state).toBe('ghost');
    expect(postingHealth({ ageDays: 10, repostCount: 2, openedSource: 'posted' }, null).state).toBe('ghost');
    expect(postingHealth({ ageDays: 10, repostCount: 1, openedSource: 'posted' }, null).state).toBe('active');
  });

  it('adds the typical window only when one is given', () => {
    const typical: TypicalWindow = { scope: 'AI & ML', n: 64, medianDays: 21, p25Days: 9, p75Days: 48 };
    const h = postingHealth({ ageDays: 20, repostCount: 0, openedSource: 'posted' }, typical);
    expect(h.detail).toContain('Roles in AI & ML that closed in the last 4 weeks were open a median of 21 days');
    expect(h.detail).toContain('middle half 9–48 days, 64 roles');
  });
});

describe('salaryPosition', () => {
  const band = { p25: 185_000, p50: 250_000, p75: 325_000 };
  it('places the midpoint inside the band', () => {
    expect(salaryPosition(254_750, band)).toEqual({ position: expect.closeTo(0.4982, 3), verdict: 'at market median' });
    expect(salaryPosition(200_000, band).verdict).toBe('below median');
    expect(salaryPosition(300_000, band).verdict).toBe('above median');
  });
  it('clamps outside the band', () => {
    expect(salaryPosition(100_000, band)).toEqual({ position: 0, verdict: 'below band' });
    expect(salaryPosition(400_000, band)).toEqual({ position: 1, verdict: 'above band' });
  });
  it('survives a zero-width band', () => {
    expect(salaryPosition(100, { p25: 100, p50: 100, p75: 100 }).position).toBe(0.5);
  });
});

describe('percentile and payMidpoint', () => {
  it('interpolates between ranks', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40], 1)).toBe(40);
    expect(percentile([5], 0.75)).toBe(5);
    expect(() => percentile([], 0.5)).toThrow();
  });
  it('uses the midpoint, or the one bound given', () => {
    expect(payMidpoint(100, 200)).toBe(150);
    expect(payMidpoint(100, null)).toBe(100);
    expect(payMidpoint(null, 200)).toBe(200);
    expect(payMidpoint(null, null)).toBeNull();
  });
});

describe('companySignal', () => {
  const days = (open: number[], opened = 5, closed = 5) => open.map((o) => ({ open: o, new: opened, closed }));
  const flat = (n: number, v: number) => Array.from({ length: n }, () => v);
  it('needs 30 days of history', () => {
    expect(companySignal(days(flat(29, 100)))).toBeNull();
    expect(companySignal(days(flat(30, 100)))).toBe('STEADY');
  });
  it('rules', () => {
    const grow = [...flat(29, 100), 110];
    expect(companySignal(days(grow, 10, 4))).toBe('RAMPING');
    expect(companySignal(days(grow, 4, 10))).toBe('STEADY');
    expect(companySignal(days([...flat(29, 100), 93], 5, 6))).toBe('COOLING');
    expect(companySignal(days([...flat(29, 100), 85], 3, 9))).toBe('FREEZING');
    expect(companySignal(days([...flat(29, 100), 85], 5, 6))).toBe('COOLING');
  });
  it('uses only the last 30 days and ignores an empty base', () => {
    expect(companySignal(days([1000, 1000, ...flat(29, 100), 100]))).toBe('STEADY');
    expect(companySignal(days(flat(30, 0)))).toBeNull();
  });
});

describe('labels and formats', () => {
  it('makes slugs for readers', () => {
    expect(jobSlug('Sr. Machine Learning Engineer, Siri Speech')).toBe('sr-machine-learning-engineer-siri-speech');
    expect(jobSlug('Ingénieur Données & IA (H/F)')).toBe('ingenieur-donnees-and-ia-h-f');
    expect(jobSlug('!!!')).toBe('role');
    expect(jobSlug('x'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
  it('knows a krill id', () => {
    expect(isJobId('kr_fsnjx38cyxf8r908')).toBe(true);
    expect(isJobId('kr_')).toBe(false);
    expect(isJobId('../etc/passwd')).toBe(false);
    expect(isJobId('KR_ABCDEF123')).toBe(false);
  });
  it('words for employment type, work mode and places', () => {
    expect(employmentLabel('FULL_TIME')).toBe('Full-time');
    expect(employmentLabel('part-time')).toBe('Part-time');
    expect(employmentLabel('SEASONAL_WORK')).toBe('Seasonal work');
    expect(employmentLabel(null)).toBeNull();
    expect(workModeLabel('onsite')).toBe('On-site');
    expect(workModeLabel('remote')).toBe('Remote');
    expect(shortLocation('Cupertino, California, United States')).toBe('Cupertino, California, US');
    expect(shortLocation('United States')).toBe('US');
    expect(shortLocation('London, United Kingdom')).toBe('London, UK');
    expect(shortLocation('Berlin, Germany')).toBe('Berlin, Germany');
  });
  it('formats pay', () => {
    expect(formatMoney(184_700, 'USD')).toBe('$184,700');
    expect(formatMoney(90_000, 'EUR')).toBe('EUR 90,000');
    expect(formatMoneyShort(184_700, 'USD')).toBe('$185K');
    const s = { currency: 'USD', annualMin: 184_700, annualMax: 324_800, summary: null };
    expect(salaryLabel(s)).toBe('$184,700 – $324,800 / year');
    expect(salaryRangeShort(s)).toBe('$185K – $325K');
    expect(salaryLabel({ ...s, annualMax: null })).toBe('$184,700 / year');
    expect(salaryLabel({ ...s, annualMin: null, annualMax: null })).toBeNull();
    expect(salaryLabel(null)).toBeNull();
  });
});

describe('splitLocations', () => {
  it('splits places an employer joined in one string', async () => {
    const { splitLocations } = await import('../src/job.ts');
    expect(splitLocations(['Austin, Texas, United States; San Jose, California, US', 'Remote'])).toEqual([
      'Austin, Texas, United States',
      'San Jose, California, US',
      'Remote',
    ]);
    expect(splitLocations([])).toEqual([]);
    expect(shortLocation('Seattle, Washington, United States of America')).toBe('Seattle, Washington, US');
  });
});
