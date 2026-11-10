import { describe, expect, it } from 'vitest';
import { addDays, type IsoDay } from '@cm/core/dates';
import { growthRatio, type CompanyDayRow } from '../src/growth.ts';

const BASE: IsoDay = '2026-11-03';
const DAY: IsoDay = '2026-11-10';

/** One company's rows from `first` on, one per open count; flows follow the day-to-day difference. */
function company(id: string, opens: number[], first: IsoDay = BASE): CompanyDayRow[] {
  return opens.map((open, i) => {
    const diff = i === 0 ? 0 : open - (opens[i - 1] as number);
    return { companyId: id, date: addDays(first, i), open, new: Math.max(0, diff), closed: Math.max(0, -diff) };
  });
}

// The shape of the week to 10 Nov 2026: a steady employer, one that grows a little each day,
// and one whose board was added on 7 Nov (959 to 2,787 open roles in a day) while it had roles
// listed all week. Summing that board into the base week read +14.9% for a market up about 1%.
const steady = company('steady', [1000, 1002, 1005, 1003, 1006, 1008, 1008, 1010]);
const growing = company('growing', [200, 205, 210, 215, 220, 230, 235, 240]);
const boarded = company('boarded', [959, 959, 959, 959, 2787, 2801, 2801, 2801]);
const dropped = company('dropped', [400, 400, 100, 100, 100, 100, 100, 100]);
const gone = company('gone', [50, 40, 30]);
const discovered = company('discovered', [500, 500, 500, 500], '2026-11-07');
const rows = [...steady, ...growing, ...boarded, ...dropped, ...gone, ...discovered];

describe('market week-on-week growth', () => {
  it('compares only companies that kept the same boards through the week', () => {
    expect(growthRatio(rows, BASE, DAY, 'like-for-like')).toBeCloseTo((1010 + 240) / (1000 + 200) - 1, 10);
  });

  it('no longer counts a board added mid-week as hiring', () => {
    const endpointsOnly = (1010 + 240 + 2801 + 100) / (1000 + 200 + 959 + 400) - 1;
    const value = growthRatio(rows, BASE, DAY, 'like-for-like') as number;
    expect(endpointsOnly).toBeGreaterThan(0.6);
    expect(value).toBeLessThan(0.05);
  });

  it('keeps raw as the full endpoint totals, so the basis is easy to flip', () => {
    expect(growthRatio(rows, BASE, DAY, 'raw')).toBeCloseTo((1010 + 240 + 2801 + 100 + 500) / (1000 + 200 + 959 + 400 + 50) - 1, 10);
  });

  it('treats a company back from zero roles as a new board', () => {
    const back = company('back', [30, 30, 0, 0, 0, 0, 31, 31]);
    expect(growthRatio([...steady, ...back], BASE, DAY, 'like-for-like')).toBeCloseTo(0.01, 10);
  });

  it('ignores rows outside the week and has no value without a base', () => {
    const early = company('steady', [10], '2026-11-02');
    expect(growthRatio([...early, ...steady], BASE, DAY, 'like-for-like')).toBeCloseTo(0.01, 10);
    expect(growthRatio(discovered, BASE, DAY, 'like-for-like')).toBeNull();
  });
});
