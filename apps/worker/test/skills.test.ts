import { describe, expect, it } from 'vitest';
import { skillCategory, skillSlugs } from '@cm/core/skills';
import { chainIndex } from '../src/compute/chainIndex.ts';
import { fitSurvival } from '../src/compute/backcast.ts';
import { chainIndexFromRows } from '../src/compute/skillIndex.ts';
import { compareSalaries, median, MIN_SALARY_SIDE } from '../src/compute/skillSalary.ts';
import {
  cutsForScope,
  estimateSkillHistory,
  mergeSeries,
  POSTED_EVER,
  survivalFromBuckets,
} from '../src/compute/skillSeries.ts';
import { dedupeRoles, pickTrackedSkills, roleLocation } from '../src/skills/pull.ts';
import type { KrillJob } from '../src/krill/skillApi.ts';

describe('survivalFromBuckets', () => {
  it('rebuilds the curve fitSurvival made from its stored buckets', () => {
    const ages: number[] = [];
    for (let a = 1; a <= 120; a++) for (let i = 0; i < Math.round(200 * Math.exp(-0.03 * a)); i++) ages.push(a);
    const cuts = [7, 14, 30, 60, 90, 120].map((age) => ({ age, countLE: Math.round(3000 * (1 - Math.exp(-0.03 * age))) }));
    const fit = fitSurvival({
      datedCuts: cuts,
      closingDays: [{ day: '2026-11-05', closed: ages.length, datedAges: ages, undated: 0 }],
      edges: [7, 14, 30, 60, 90, 120],
    });
    expect(fit).not.toBeNull();
    const rebuilt = survivalFromBuckets(
      (fit?.buckets ?? []).map((b) => ({ age_from: b.from, age_to: b.to, hazard: b.hazard })),
    );
    expect(rebuilt).toHaveLength(fit?.survival.length ?? 0);
    rebuilt.forEach((v, a) => expect(v).toBeCloseTo(fit?.survival[a] as number, 10));
  });
});

describe('chainIndexFromRows', () => {
  it('matches the index points the market build made', () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
    const panel = new Map([
      ['2026-11-04', { date: '2026-11-04', matchedOpen: 1010, matchedPreviousOpen: 1000 }],
      ['2026-11-05', { date: '2026-11-05', matchedOpen: 1030, matchedPreviousOpen: 1020 }],
    ]);
    const made = chainIndex(days, panel);
    const rows = made.map((p, i) => ({
      date: p.date,
      open: 1000 + i,
      link: p.link,
      matched_open: panel.get(p.date)?.matchedOpen ?? null,
      matched_previous_open: panel.get(p.date)?.matchedPreviousOpen ?? null,
      index_value: p.value,
    }));
    const rebuilt = chainIndexFromRows(rows, (d) => d === '2026-11-02' || d === '2026-11-03');
    expect(rebuilt).toEqual(made);
  });
});

describe('estimateSkillHistory', () => {
  const T = '2026-11-06';
  const S = (a: number) => Math.exp(-0.02 * a);
  const survival = Array.from({ length: 366 }, (_, a) => S(a));
  // A steady skill: 40 postings a day, closing with the market's hazard.
  const P = 40;
  const countLE = (age: number) => {
    let n = 0;
    for (let x = 0; x <= age; x++) n += P * S(x);
    return n;
  };
  const cuts = [7, 14, 30, 60, 90, 120, 183, 270, 365].map((age) => ({ age, countLE: countLE(age) }));
  const datedTotal = countLE(365) + (P * S(366)) / (1 - Math.exp(-0.02));

  it('returns a flat line for a steady skill and meets the observed point', () => {
    const rows = estimateSkillHistory({
      asOf: T,
      cuts,
      datedTotal,
      totalOpen: datedTotal,
      survival,
      firstObserved: T,
      observedToday: Math.round(datedTotal),
    });
    expect(rows).not.toBeNull();
    const last = rows?.at(-1);
    expect(last?.date).toBe('2026-11-05');
    expect(Math.abs((last?.open as number) / datedTotal - 1)).toBeLessThan(0.08);
    const early = rows?.find((r) => r.date === '2026-08-07');
    expect(Math.abs((early?.open as number) / datedTotal - 1)).toBeLessThan(0.15);
  });

  it('refuses thin inputs', () => {
    expect(estimateSkillHistory({ asOf: T, cuts: cuts.slice(0, 3), datedTotal, totalOpen: datedTotal, survival, firstObserved: T, observedToday: 100 })).toBeNull();
    expect(estimateSkillHistory({ asOf: T, cuts, datedTotal: 0, totalOpen: 10, survival, firstObserved: T, observedToday: 10 })).toBeNull();
  });
});

describe('cutsForScope and mergeSeries', () => {
  it('turns stored cuts into age cuts and the dated total', () => {
    const { cuts, datedTotal } = cutsForScope(
      [
        { family: '*', cut_date: '2026-10-30', count: 50 },
        { family: '*', cut_date: '2026-10-23', count: 90 },
        { family: '*', cut_date: POSTED_EVER, count: 400 },
        { family: 'ai-ml', cut_date: '2026-10-30', count: 20 },
      ],
      '*',
      '2026-11-06',
    );
    expect(cuts).toEqual([
      { age: 7, countLE: 50 },
      { age: 14, countLE: 90 },
    ]);
    expect(datedTotal).toBe(400);
  });

  it('puts estimated days before observed days and never overlaps them', () => {
    const merged = mergeSeries(
      [
        { date: '2026-11-04', open: 90 },
        { date: '2026-11-05', open: 95 },
        { date: '2026-11-06', open: 99 },
      ],
      new Map([['2026-11-06', 100]]),
    );
    expect(merged).toEqual([
      { date: '2026-11-04', open: 90, estimated: true },
      { date: '2026-11-05', open: 95, estimated: true },
      { date: '2026-11-06', open: 100, estimated: false },
    ]);
  });
});

describe('compareSalaries', () => {
  const role = (skills: string[], pay: number) => ({ skills, annualMin: pay, annualMax: pay + 20_000 });

  it('compares medians of the range midpoints', () => {
    const sample = [
      ...Array.from({ length: MIN_SALARY_SIDE }, (_, i) => role(['ml:pytorch'], 200_000 + i)),
      ...Array.from({ length: MIN_SALARY_SIDE + 1 }, (_, i) => role(['lang:python'], 180_000 + i)),
    ];
    const cmp = compareSalaries(sample, 'ml:pytorch');
    expect(cmp.nWith).toBe(MIN_SALARY_SIDE);
    expect(cmp.nWithout).toBe(MIN_SALARY_SIDE + 1);
    expect((cmp.medianWith as number) - (cmp.medianWithout as number)).toBeGreaterThan(19_000);
  });

  it('shows no median when a side is too small', () => {
    const sample = [role(['ml:pytorch'], 200_000), ...Array.from({ length: 80 }, () => role([], 150_000))];
    expect(compareSalaries(sample, 'ml:pytorch')).toMatchObject({ nWith: 1, nWithout: 80, medianWith: null, medianWithout: null });
  });

  it('takes the lower bound when a role lists no upper bound', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('pickTrackedSkills', () => {
  it('sums a skill over professions, keeps tool-like skills and ranks by roles', () => {
    const tracked = pickTrackedSkills(
      new Map([
        ['ai-ml', { total: 100, skills: [{ value: 'ml:pytorch', count: 60 }, { value: 'lang:python', count: 50 }, { value: 'concept:algorithms', count: 90 }] }],
        ['software', { total: 100, skills: [{ value: 'lang:python', count: 70 }, { value: 'ml:pytorch', count: 10 }] }],
      ]),
      2,
    );
    expect(tracked.map((t) => [t.id, t.slug, t.total])).toEqual([
      ['lang:python', 'python', 120],
      ['ml:pytorch', 'pytorch', 70],
    ]);
    expect(tracked[1]?.families[0]).toEqual({ family: 'ai-ml', count: 60 });
  });
});

describe('skill display data', () => {
  it('gives a second skill with the same bare name a namespaced slug', () => {
    const slugs = skillSlugs(['domain:etl', 'data:etl', 'ml:pytorch']);
    expect(slugs.get('data:etl')).toBe('etl');
    expect(slugs.get('domain:etl')).toBe('domain-etl');
    expect(slugs.get('ml:pytorch')).toBe('pytorch');
  });

  it('tags PyTorch as an ML framework and falls back to the namespace', () => {
    expect(skillCategory('ml:pytorch')).toBe('ML framework');
    expect(skillCategory('lang:go')).toBe('Language');
    expect(skillCategory('weird:thing')).toBe('Skill');
  });
});

describe('roleLocation', () => {
  const job = (places: KrillJob['places'], workMode: string | null = null) => ({ places, workMode }) as KrillJob;
  it('prefers city and state, then the place label, then Remote', () => {
    expect(roleLocation(job([{ label: 'Cupertino, CA, United States', city: 'Cupertino', admin1Code: 'CA', countryCode: 'US' }]))).toBe('Cupertino, CA');
    expect(roleLocation(job([{ label: 'United States', countryCode: 'US' }]))).toBe('United States');
    expect(roleLocation(job([{ label: 'Seoul', city: 'Seoul', admin1Code: '11', countryCode: 'KR' }]))).toBe('Seoul');
    expect(roleLocation(job([], 'remote'))).toBe('Remote');
    expect(roleLocation(job([]))).toBeNull();
  });
});

describe('dedupeRoles', () => {
  it('keeps the first role of each company and title', () => {
    const j = (id: string, company: string, title: string) => ({ id, company: { id: company, name: company }, title }) as KrillJob;
    const kept = dedupeRoles([j('1', 'a', 'Data Engineer'), j('2', 'a', 'data engineer'), j('3', 'b', 'Data Engineer')]);
    expect(kept.map((x) => x.id)).toEqual(['1', '3']);
  });
});
