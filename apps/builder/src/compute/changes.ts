import { addDays, FIRST_COMPARABLE_BASE, RANGE_DAYS, type IsoDay, type Range } from '@cm/core/dates';
import type { Change } from '@cm/core/types';

export interface ValuePoint {
  date: IsoDay;
  value: number;
  estimated: boolean;
}

/**
 * Change over a range ending on `asOf`.
 * - Base on or after the first comparable day: observed change.
 * - Earlier base with an estimated (back-cast) value: estimated change, for
 *   1M and longer only. A week is always observed: the back-cast is too coarse
 *   for day-level moves, so 1W falls back to a partial observed change.
 * - Otherwise: a partial change since the first comparable day.
 * Bootstrap days never serve as the end of a change; the index already holds
 * them flat, so the first comparable base is the last bootstrap day.
 */
export function computeChange(series: readonly ValuePoint[], asOf: IsoDay, range: Range): Change | null {
  if (series.length === 0) return null;
  const byDate = new Map(series.map((p) => [p.date, p]));
  const end = byDate.get(asOf);
  if (!end || end.value <= 0) return null;

  const first = series[0] as ValuePoint;
  const target = range === 'ALL' ? first.date : addDays(asOf, -RANGE_DAYS[range]);

  let base: ValuePoint | undefined;
  let partial = false;
  if (target >= FIRST_COMPARABLE_BASE) {
    base = atOrBefore(series, target);
    if (base && base.date < FIRST_COMPARABLE_BASE) base = undefined;
  } else if (range !== '1W') {
    const est = byDate.get(target);
    if (est?.estimated) base = est;
    else if (range === 'ALL' && first.estimated) base = first;
  }
  if (!base) {
    base = byDate.get(FIRST_COMPARABLE_BASE) ?? series.find((p) => p.date > FIRST_COMPARABLE_BASE && !p.estimated);
    partial = true;
  }
  if (!base || base.date >= asOf || base.value <= 0) return null;
  return {
    range,
    value: end.value / base.value - 1,
    baseDate: base.date,
    partial,
    estimated: base.estimated,
  };
}

function atOrBefore(series: readonly ValuePoint[], day: IsoDay): ValuePoint | undefined {
  let found: ValuePoint | undefined;
  for (const p of series) {
    if (p.date > day) break;
    found = p;
  }
  return found;
}
