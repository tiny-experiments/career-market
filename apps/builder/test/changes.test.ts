import { describe, expect, it } from 'vitest';
import { computeChange, type ValuePoint } from '../src/compute/changes.ts';

const observed: ValuePoint[] = [
  { date: '2026-11-02', value: 100, estimated: false },
  { date: '2026-11-03', value: 100, estimated: false },
  { date: '2026-11-04', value: 101, estimated: false },
  { date: '2026-11-05', value: 102, estimated: false },
];

describe('computeChange', () => {
  it('falls back to a partial change since the last bootstrap day', () => {
    const c = computeChange(observed, '2026-11-05', '1W');
    expect(c).toMatchObject({ baseDate: '2026-11-03', partial: true, estimated: false });
    expect(c?.value).toBeCloseTo(0.02, 10);
  });

  it('uses an estimated base for 1M when the back-cast covers the range', () => {
    const series: ValuePoint[] = [{ date: '2026-10-06', value: 96, estimated: true }, ...observed];
    const c = computeChange(series, '2026-11-05', '1M');
    expect(c).toMatchObject({ baseDate: '2026-10-06', partial: false, estimated: true });
    expect(c?.value).toBeCloseTo(102 / 96 - 1, 10);
  });

  it('keeps a week observed even when the back-cast covers it', () => {
    const series: ValuePoint[] = [{ date: '2026-10-29', value: 96, estimated: true }, ...observed];
    const c = computeChange(series, '2026-11-05', '1W');
    expect(c).toMatchObject({ baseDate: '2026-11-03', partial: true, estimated: false });
  });

  it('uses the observed base once a full comparable week exists', () => {
    const series: ValuePoint[] = [];
    for (let d = 3; d <= 12; d++) series.push({ date: `2026-11-${String(d).padStart(2, '0')}`, value: 100 + d, estimated: false });
    const c = computeChange(series, '2026-11-12', '1W');
    expect(c).toMatchObject({ baseDate: '2026-11-05', partial: false, estimated: false });
    expect(c?.value).toBeCloseTo(112 / 105 - 1, 10);
  });

  it('never compares a bootstrap day', () => {
    const c = computeChange(observed.slice(0, 2), '2026-11-03', '1W');
    expect(c).toBeNull();
  });

  it('returns null without a value on the end day', () => {
    expect(computeChange(observed, '2026-11-06', '1W')).toBeNull();
  });
});
