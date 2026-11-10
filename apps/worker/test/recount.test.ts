import { describe, expect, it } from 'vitest';
import { companySeries, isBoardEvent, type DayRow } from '@cm/core/company';
import { MIN_FULL_DAYS } from '@cm/core/changes';
import { addDays, daysBetween, type IsoDay } from '@cm/core/dates';
import { changePoints, companySignal } from '../src/companies/compute.ts';
import { computeChange } from '../src/compute/changes.ts';
import {
  chainIndex,
  countingChangeDays,
  rebase,
  shareAdjustedIndex,
  sliceBasisChangeDays,
  type CountDay,
} from '../src/compute/chainIndex.ts';
import { companyChange, isCoverageChange } from '../src/compute/companySignal.ts';
import { growthRatio, type CompanyDayRow } from '../src/growth.ts';

// On 10 Nov 2026 krill merged ~29,900 duplicate Oracle records (one requisition on several
// careers sites of a tenant) into their canonical jobs. They left the open totals without
// being closed, and krill kept the earlier daily totals as they were, so every series steps
// down for one day. These tests replay that shape.

/** krill /v1/stats/daily and /v1/stats/panel/daily after the merge, 4-10 Nov 2026. */
const KRILL: CountDay[] = [
  { date: '2026-11-03', open: 224_367, new: 51_995, closed: 389, matchedOpen: 174_646, matchedPreviousOpen: 172_288, newOnKnownBoards: 5_688 },
  { date: '2026-11-04', open: 225_570, new: 5_298, closed: 4_025, matchedOpen: 219_725, matchedPreviousOpen: 218_194, newOnKnownBoards: 5_630 },
  { date: '2026-11-05', open: 242_947, new: 20_233, closed: 2_798, matchedOpen: 210_645, matchedPreviousOpen: 209_587, newOnKnownBoards: 4_966 },
  { date: '2026-11-06', open: 262_845, new: 23_882, closed: 3_913, matchedOpen: 223_580, matchedPreviousOpen: 223_487, newOnKnownBoards: 4_526 },
  { date: '2026-11-07', open: 300_189, new: 42_206, closed: 4_789, matchedOpen: 229_718, matchedPreviousOpen: 229_591, newOnKnownBoards: 667 },
  { date: '2026-11-08', open: 297_827, new: 1_040, closed: 4_188, matchedOpen: 220_912, matchedPreviousOpen: 221_265, newOnKnownBoards: 576 },
  { date: '2026-11-09', open: 272_467, new: 2_554, closed: 1_765, matchedOpen: 188_981, matchedPreviousOpen: 189_114, newOnKnownBoards: 3_412 },
  { date: '2026-11-10', open: 272_467, new: 4_561, closed: 670, matchedOpen: 164_159, matchedPreviousOpen: 193_126, newOnKnownBoards: 536 },
];
const panelOf = (days: readonly CountDay[]) =>
  new Map(days.map((d) => [d.date, { date: d.date, matchedOpen: d.matchedOpen as number, matchedPreviousOpen: d.matchedPreviousOpen as number }]));

describe('counting changes in the market series', () => {
  it('finds the merge in krill’s own counts and no normal day', () => {
    // The daily totals step on 9 Nov, the matched-board panel on 10 Nov.
    expect([...countingChangeDays(KRILL)].sort()).toEqual(['2026-11-09', '2026-11-10']);
  });

  it('keeps the market week across the merge close to its like-for-like value', () => {
    const days = KRILL.map((d) => d.date);
    const panel = panelOf(KRILL);
    const asOf = '2026-11-10';
    const weekOf = (index: ReturnType<typeof chainIndex>) => {
      const rebased = rebase(index, 272_467);
      const series = days.map((date) => ({ date, value: rebased.get(date) as number, estimated: false }));
      return computeChange(series, asOf, '1W')?.value as number;
    };
    const before = weekOf(chainIndex(days, panel));
    const after = weekOf(chainIndex(days, panel, countingChangeDays(KRILL)));
    // Like-for-like: the matched-board links of the five ordinary days (4-8 Nov).
    const likeForLike = KRILL.slice(1, 6).reduce((v, d) => v * ((d.matchedOpen as number) / (d.matchedPreviousOpen as number)), 1) - 1;
    expect(before).toBeLessThan(-0.13);
    expect(after).toBeCloseTo(likeForLike, 4); // the rebase rounds to whole roles
    expect(Math.abs(after)).toBeLessThan(0.02);
  });

  it('rebases the open-roles line before the merge onto the corrected count', () => {
    const days = KRILL.map((d) => d.date);
    const rebased = rebase(chainIndex(days, panelOf(KRILL), countingChangeDays(KRILL)), 272_467);
    const step = (rebased.get('2026-11-10') as number) / (rebased.get('2026-11-08') as number) - 1;
    expect(Math.abs(step)).toBeLessThan(0.001);
  });

  it('holds a profession’s share across the merge', () => {
    const days = KRILL.map((d) => d.date);
    const index = chainIndex(days, panelOf(KRILL), countingChangeDays(KRILL));
    // platform-infra: share steady at 6.1%, then -5.3% on 9 Nov as the duplicates leave unevenly.
    const share = new Map(days.map((d) => [d, d === '2026-11-09' || d === '2026-11-10' ? 0.061 * 0.947 : 0.061]));
    const family = shareAdjustedIndex(index, share);
    const market = index.at(-1)?.value as number;
    expect(family.at(-1)?.value).toBeCloseTo(market, 10);
  });

  it('holds a skill’s share across the build that first counted it after the merge', () => {
    // Skill counts are kept on their build day: 9 and 10 Nov were counted before the merge,
    // while krill's refetched totals for those days already exclude the duplicates.
    const marketOpen = new Map([['2026-11-07', 300_189], ['2026-11-08', 297_827], ['2026-11-09', 272_467], ['2026-11-10', 272_467], ['2026-11-11', 272_900]]);
    const totals = new Map([['2026-11-07', 1_112_000], ['2026-11-08', 1_103_500], ['2026-11-09', 1_112_400], ['2026-11-10', 1_112_026], ['2026-11-11', 1_018_045]]);
    const hold = sliceBasisChangeDays(totals, marketOpen);
    expect([...hold].sort()).toEqual(['2026-11-09', '2026-11-11']);
    const days = [...marketOpen.keys()];
    const panel = new Map(days.map((d) => [d, { date: d, matchedOpen: 1000, matchedPreviousOpen: 1000 }]));
    const index = chainIndex(days, panel);
    // Spring Boot lost 13.5% of its mentions to the merge, the skills as a whole 8.5%.
    const springBoot = new Map(days.map((d) => [d, (d < '2026-11-11' ? 9_000 : 7_785) / (marketOpen.get(d) as number)]));
    // Only 8 Nov's real share move is left: Spring Boot held its count while the market fell.
    expect(shareAdjustedIndex(index, springBoot, hold).at(-1)?.value).toBeCloseTo((100 * 300_189) / 297_827, 10);
    expect(shareAdjustedIndex(index, springBoot).at(-1)?.value).toBeLessThan(96);
  });
});

/** One company's rows from `first` on: one open count per day, flows follow the difference. */
function company(id: string, opens: number[], first: IsoDay = '2026-11-03'): CompanyDayRow[] {
  return opens.map((open, i) => {
    const diff = i === 0 ? 0 : open - (opens[i - 1] as number);
    return { companyId: id, date: addDays(first, i), open, new: Math.max(0, diff), closed: Math.max(0, -diff) };
  });
}

/** Rows whose open count drops on `day` without a single closing: krill merged duplicates away. */
function merged(rows: CompanyDayRow[], day: IsoDay, keep: number): CompanyDayRow[] {
  return rows.map((r) => (r.date >= day ? { ...r, open: Math.round(r.open * keep) } : r));
}

const MERGE_DAY: IsoDay = '2026-11-09';
const asRows = (rows: readonly CompanyDayRow[]): DayRow[] => rows.map(({ date, open, new: n, closed }) => ({ date, open, new: n, closed }));

describe('companies whose duplicates were merged', () => {
  // Days 3-12 Nov. A canonical tenant that loses half its records to the merge; one that keeps
  // closing roles for real; and an alias-only tenant left with nothing.
  const tenant = merged(company('tenant', [2000, 2004, 2010, 2008, 2012, 2015, 2020, 2022, 2025, 2030]), MERGE_DAY, 0.5);
  const coolingForReal = company('cooling', [1500, 1480, 1460, 1440, 1420, 1400, 1380, 1360, 1340, 1320]);
  const steady = company('steady', [1000, 1002, 1005, 1003, 1006, 1008, 1008, 1010, 1011, 1012]);
  const asOf: IsoDay = '2026-11-12';

  it('is a board event on the day its roles left without closing', () => {
    const before = tenant.find((r) => r.date === addDays(MERGE_DAY, -1)) as CompanyDayRow;
    const day = tenant.find((r) => r.date === MERGE_DAY) as CompanyDayRow;
    expect(isBoardEvent(day, before.open)).toBe(true);
    // Ordinary days keep counting: open roles follow openings and closings.
    const next = tenant.find((r) => r.date === addDays(MERGE_DAY, 1)) as CompanyDayRow;
    expect(isBoardEvent(next, day.open)).toBe(false);
    // A tenant that lost 13% of its records to the merge (282 to 245, nothing closed).
    expect(isBoardEvent({ date: MERGE_DAY, open: 245, new: 0, closed: 0 }, 282)).toBe(true);
    // A few roles off on a normal day is not a re-count.
    expect(isBoardEvent({ date: MERGE_DAY, open: 2160, new: 3, closed: 10 }, 2166)).toBe(false);
  });

  it('is not in Cooling fastest', () => {
    // The card ranks 1W changes whose base is at least MIN_FULL_DAYS old (apps/api movers()).
    const cooling = (rows: CompanyDayRow[]) => {
      const c = computeChange(changePoints(companySeries(asRows(rows), asOf)), asOf, '1W');
      return c && c.value < 0 && daysBetween(c.baseDate, asOf) >= MIN_FULL_DAYS['1W'] ? c.value : null;
    };
    expect(cooling(tenant)).toBeNull();
    expect(cooling(coolingForReal)).toBeCloseTo(1320 / 1460 - 1, 10);
    expect(cooling(steady)).toBeNull();
    // A week later its change is measured from the merge day on: hiring only.
    const weekOn = merged(company('tenant', [2000, 2004, 2010, 2008, 2012, 2015, 2020, 2022, 2025, 2030, 2031, 2033, 2034, 2036]), MERGE_DAY, 0.5);
    const later = computeChange(changePoints(companySeries(asRows(weekOn), '2026-11-16')), '2026-11-16', '1W');
    expect(later?.baseDate).toBe(MERGE_DAY);
    expect(later?.value).toBeGreaterThan(0);
  });

  it('gets no Cooling or Freezing signal from the merge', () => {
    const signal = companySignal(companySeries(asRows(tenant), asOf), asOf);
    expect(signal?.windowFrom).toBe(addDays(MERGE_DAY, 1));
    expect(signal?.state).not.toMatch(/COOLING|FREEZING/);
  });

  it('leaves every list once it has no open roles', () => {
    const aliasOnly = merged(company('alias', [120, 121, 122, 122, 123, 124, 125, 125, 126, 126]), MERGE_DAY, 0);
    const series = companySeries(asRows(aliasOnly), asOf);
    expect(series.segmentStart).toBeNull();
    expect(companySignal(series, asOf)).toBeNull();
    expect(changePoints(series)).toEqual([]);
  });

  it('keeps the headline week close to its like-for-like value', () => {
    const base = addDays(asOf, -7);
    const unaffected = [...coolingForReal, ...steady];
    const likeForLike = growthRatio(unaffected, base, asOf, 'like-for-like') as number;
    const aliasOnly = merged(company('alias', [120, 121, 122, 122, 123, 124, 125, 125, 126, 126]), MERGE_DAY, 0);
    const withMerge = growthRatio([...unaffected, ...tenant, ...aliasOnly], base, asOf, 'like-for-like') as number;
    expect(withMerge).toBeCloseTo(likeForLike, 10);
  });

  it('shows no change for a profession’s top company across the merge', () => {
    const days = asRows(tenant);
    const change = companyChange(days, asOf);
    expect(change?.change.value).toBeLessThan(-0.45);
    expect(isCoverageChange(change)).toBe(true);
    expect(isCoverageChange(companyChange(asRows(coolingForReal), asOf))).toBe(false);
  });
});
