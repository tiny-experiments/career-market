import { describe, expect, it } from 'vitest';
import { medianAge } from '../src/compute/ageDistribution.ts';
import { backcast, fitSurvival } from '../src/compute/backcast.ts';

/** A steady market: P postings a day, each closing with daily hazard h. */
function steadyMarket(P: number, h: number, maxAge: number) {
  const S = (a: number) => Math.exp(-h * a);
  const openAtAge = (a: number) => P * S(a);
  const cutsAt = [7, 14, 21, 30, 45, 60, 90, 120, 150, 183, 270, 365].filter((a) => a <= maxAge);
  const countLE = (a: number) => {
    let n = 0;
    for (let x = 0; x <= a; x++) n += openAtAge(x);
    return n;
  };
  const datedCuts = cutsAt.map((age) => ({ age, countLE: countLE(age) }));
  const total = countLE(maxAge) + P * S(maxAge + 1) / (1 - Math.exp(-h)); // plus older jobs
  return { S, datedCuts, total, countLE };
}

describe('medianAge', () => {
  it('interpolates inside the bucket that holds the middle job', () => {
    const cuts = [
      { age: 7, countLE: 20 },
      { age: 14, countLE: 40 },
      { age: 30, countLE: 60 },
    ];
    expect(medianAge(cuts, 100)).toBeCloseTo(22, 6);
    expect(medianAge(cuts, 80)).toBeCloseTo(14, 6);
    expect(medianAge(cuts, 60)).toBeCloseTo(7 + (30 - 20) / 20 * 7, 6);
  });

  it('is null when the cuts never reach half', () => {
    expect(medianAge([{ age: 7, countLE: 10 }], 100)).toBeNull();
  });
});

describe('fitSurvival', () => {
  it('needs enough sampled closings', () => {
    expect(fitSurvival({ datedCuts: [{ age: 7, countLE: 10 }], closingDays: [{ day: '2026-11-05', closed: 10, datedAges: [1, 2], undated: 0 }] })).toBeNull();
  });

  it('recovers a constant hazard from closings and the open-age distribution', () => {
    const h = 0.02;
    const P = 100_000;
    const m = steadyMarket(P, h, 365);
    // Expected closings per day at age a: P * S(a-1) * (1 - e^-h); sample them in proportion.
    const ages: number[] = [];
    for (let a = 1; a <= 365; a++) {
      const n = Math.round(P * m.S(a - 1) * (1 - Math.exp(-h)));
      for (let i = 0; i < n; i++) ages.push(a);
    }
    const closedPerDay = ages.length;
    const fit = fitSurvival({
      datedCuts: m.datedCuts,
      closingDays: [{ day: '2026-11-05', closed: closedPerDay, datedAges: ages, undated: 0 }],
    });
    expect(fit).not.toBeNull();
    for (const b of fit?.buckets ?? []) expect(b.hazard).toBeGreaterThan(0.012);
    for (const b of fit?.buckets ?? []) expect(b.hazard).toBeLessThan(0.028);
  });
});

describe('backcast', () => {
  it('reproduces a steady market as a flat line', () => {
    const h = 0.02;
    const P = 1000;
    const maxAge = 365;
    const m = steadyMarket(P, h, maxAge);
    const survival = Array.from({ length: maxAge + 1 }, (_, a) => m.S(a));
    const days = backcast({ asOf: '2026-11-05', datedCuts: m.datedCuts, datedTotal: m.total, totalOpen: m.total, survival, days: 120, survivalFloor: 0 });
    const today = days.at(-1);
    const past = days.find((d) => d.date === '2026-08-07');
    expect(today?.open).toBeCloseTo(m.total, -2);
    // A steady market looks the same 90 days back (within the piecewise-uniform cut error).
    expect(Math.abs((past?.open as number) / (today?.open as number) - 1)).toBeLessThan(0.06);
    expect(Math.abs((past?.new as number) / P - 1)).toBeLessThan(0.1);
    expect(Math.abs((past?.closed as number) / (P * (1 - m.S(maxAge))) - 1)).toBeLessThan(0.15);
  });

  it('scales undated jobs in instead of placing them on one day', () => {
    const survival = Array.from({ length: 31 }, () => 1);
    const cuts = [{ age: 30, countLE: 310 }];
    const res = backcast({ asOf: '2026-11-05', datedCuts: cuts, datedTotal: 310, totalOpen: 620, survival, days: 10 });
    // 10 dated postings a day, doubled for undated jobs.
    expect(res[0]?.new).toBeCloseTo(20, 6);
  });
});
