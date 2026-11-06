import { describe, expect, it } from 'vitest';
import type { KrillJob } from '@cm/core/krillJob';
import { computePayBands, dedupeSamples, toPaySample, type PaySample } from '../src/compute/payBand.ts';

let nextCompany = 0;
const sample = (midpoint: number, level: string | null = 'senior', specialty: string | null = 'ml-engineering', family = 'ai-ml', companyId?: string): PaySample => ({
  companyId: companyId ?? `co_${nextCompany++}`,
  family,
  specialty,
  level,
  midpoint,
});

describe('computePayBands', () => {
  it('computes percentiles per profession, seniority and specialty when the sample is large enough', () => {
    const samples = Array.from({ length: 40 }, (_, i) => sample(100_000 + i * 1_000));
    const bands = computePayBands(samples);
    expect(bands.map((b) => `${b.family}|${b.specialty}|${b.level}`)).toEqual(['ai-ml||', 'ai-ml||senior', 'ai-ml|ml-engineering|senior']);
    const all = bands[0] as (typeof bands)[number];
    expect(all.n).toBe(40);
    expect(all.p25).toBeCloseTo(109_750);
    expect(all.p50).toBeCloseTo(119_500);
    expect(all.p75).toBeCloseTo(129_250);
  });

  it('drops a grain with fewer than 30 roles', () => {
    const samples = [
      ...Array.from({ length: 35 }, (_, i) => sample(150_000 + i * 1_000, 'senior', 'ml-engineering')),
      ...Array.from({ length: 10 }, (_, i) => sample(90_000 + i * 1_000, 'junior', 'ml-engineering')),
    ];
    const keys = computePayBands(samples).map((b) => `${b.specialty}|${b.level}`);
    expect(keys).toContain('|');
    expect(keys).toContain('|senior');
    expect(keys).not.toContain('|junior');
  });

  it('keeps professions apart and ignores roles without a level for the seniority grains', () => {
    const samples = [
      ...Array.from({ length: 30 }, () => sample(100_000, null, null, 'data')),
      ...Array.from({ length: 30 }, () => sample(200_000, 'senior', 'ml-engineering', 'ai-ml')),
    ];
    const bands = computePayBands(samples);
    expect(bands.filter((b) => b.family === 'data').map((b) => b.level)).toEqual(['']);
    expect(bands.find((b) => b.family === 'ai-ml' && b.level === '')?.p50).toBe(200_000);
  });
});

describe('dedupeSamples', () => {
  it('counts a company once per profession, seniority and pay midpoint', () => {
    const same = Array.from({ length: 50 }, () => sample(250_000, 'senior', 'ml-engineering', 'ai-ml', 'co_apple'));
    const others = Array.from({ length: 30 }, (_, i) => sample(150_000 + i * 1000));
    expect(dedupeSamples([...same, ...others])).toHaveLength(31);
    const bands = computePayBands([...same, ...others]);
    expect(bands[0]?.n).toBe(31);
    expect(computePayBands(same)).toEqual([]);
  });
});

describe('toPaySample', () => {
  const job = (salary: KrillJob['salary'], extra: Partial<KrillJob> = {}) =>
    ({ family: 'ai-ml', company: { id: 'co_x', name: 'X' }, specialty: 'applied-ai', level: 'senior', salary, ...extra }) as KrillJob;
  const pay = (annualMin: number | null, annualMax: number | null, currency = 'USD') => ({
    min: annualMin,
    max: annualMax,
    currency,
    period: 'YEAR',
    annualMin,
    annualMax,
  });

  it('uses the midpoint of the annual range', () => {
    expect(toPaySample(job(pay(180_000, 220_000)))?.midpoint).toBe(200_000);
  });
  it('uses one bound when only one is listed', () => {
    expect(toPaySample(job(pay(150_000, null)))?.midpoint).toBe(150_000);
  });
  it('skips other currencies, missing pay, missing family and absurd amounts', () => {
    expect(toPaySample(job(pay(180_000, 220_000, 'EUR')))).toBeNull();
    expect(toPaySample(job(null))).toBeNull();
    expect(toPaySample(job(pay(180_000, 220_000), { family: null }))).toBeNull();
    expect(toPaySample(job(pay(5_000_000, 6_500_000)))).toBeNull();
    expect(toPaySample(job(pay(12, 15)))).toBeNull();
  });
});
