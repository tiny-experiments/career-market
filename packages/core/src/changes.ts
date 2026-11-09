import { daysBetween, type IsoDay } from './dates.ts';
import type { Change } from './types.ts';

/** A change is a week's or a month's only once its window nearly covers one. */
export const MIN_FULL_DAYS = { '1W': 5, '1M': 24 } as const;

/** The change when it really spans its window, null when the window is still too short to name. */
export function fullWindow(change: Change | undefined | null, asOf: IsoDay): Change | null {
  if (!change) return null;
  const covered = daysBetween(change.baseDate, asOf);
  return covered >= (change.range === '1W' ? MIN_FULL_DAYS['1W'] : MIN_FULL_DAYS['1M']) ? change : null;
}
