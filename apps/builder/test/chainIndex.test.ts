import { describe, expect, it } from 'vitest';
import { chainIndex, rebase, shareAdjustedIndex } from '../src/compute/chainIndex.ts';

const panel = new Map([
  ['2026-11-02', { date: '2026-11-02', matchedOpen: 125_855, matchedPreviousOpen: 126_066 }],
  ['2026-11-03', { date: '2026-11-03', matchedOpen: 174_646, matchedPreviousOpen: 172_288 }],
  ['2026-11-04', { date: '2026-11-04', matchedOpen: 219_725, matchedPreviousOpen: 218_194 }],
  ['2026-11-05', { date: '2026-11-05', matchedOpen: 210_645, matchedPreviousOpen: 209_587 }],
]);
const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];

describe('chainIndex', () => {
  it('starts at 100 and holds flat across the bootstrap days', () => {
    const idx = chainIndex(days, panel);
    expect(idx[0]?.value).toBe(100);
    expect(idx[1]?.value).toBe(100);
    expect(idx[1]?.linkUsed).toBe(false);
  });

  it('multiplies matched-board day links after the bootstrap', () => {
    const idx = chainIndex(days, panel);
    const expected = 100 * (219_725 / 218_194) * (210_645 / 209_587);
    expect(idx[3]?.value).toBeCloseTo(expected, 10);
  });

  it('treats a day without a panel match as no change', () => {
    const idx = chainIndex(['2026-11-04', '2026-11-05', '2026-11-06'], panel);
    expect(idx[2]?.link).toBe(1);
    expect(idx[2]?.value).toBe(idx[1]?.value);
  });

  it('rebases the index onto today’s count', () => {
    const idx = chainIndex(days, panel);
    const rebased = rebase(idx, 242_947);
    expect(rebased.get('2026-11-05')).toBe(242_947);
    expect(rebased.get('2026-11-02')).toBe(Math.round(242_947 / ((219_725 / 218_194) * (210_645 / 209_587))));
  });
});

describe('shareAdjustedIndex', () => {
  it('moves with the market when the share is steady', () => {
    const idx = chainIndex(days, panel);
    const share = new Map(days.map((d) => [d, 0.04]));
    const fam = shareAdjustedIndex(idx, share);
    expect(fam.at(-1)?.value).toBeCloseTo(idx.at(-1)?.value as number, 10);
  });

  it('adds the share change to the market link', () => {
    const idx = chainIndex(days, panel);
    const share = new Map([
      ['2026-11-02', 0.04],
      ['2026-11-03', 0.05],
      ['2026-11-04', 0.04],
      ['2026-11-05', 0.044],
    ]);
    const fam = shareAdjustedIndex(idx, share);
    // The bootstrap step 0.04 -> 0.05 is ignored; 11-04 and 11-05 links apply.
    const expected = 100 * (219_725 / 218_194) * (0.04 / 0.05) * (210_645 / 209_587) * (0.044 / 0.04);
    expect(fam.at(-1)?.value).toBeCloseTo(expected, 10);
  });
});
