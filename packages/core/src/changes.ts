import { daysBetween, type IsoDay } from './dates.ts';
import type { Change } from './types.ts';

/** A change is a week's or a month's only once its window nearly covers one. */
const MIN_WEEK_DAYS = 5;
const MIN_MONTH_DAYS = 24;

/** The change when it really spans its window, null when the window is still too short to name. */
export function fullWindow(change: Change | undefined | null, asOf: IsoDay): Change | null {
  if (!change) return null;
  const covered = daysBetween(change.baseDate, asOf);
  return covered >= (change.range === '1W' ? MIN_WEEK_DAYS : MIN_MONTH_DAYS) ? change : null;
}

export const MIN_FULL_WEEK_DAYS = MIN_WEEK_DAYS;
