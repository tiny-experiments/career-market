/** Calendar-day helpers. Every date in Career Market is an ISO day string (yyyy-mm-dd, UTC). */

export type IsoDay = string;

/** First day krill kept daily statistics. */
export const FIRST_OBSERVED_DAY: IsoDay = '2026-11-02';

/**
 * krill's bootstrap days: almost every job counted as a first sighting.
 * They are excluded from every change number (captain's decision); the first
 * comparable base day is the last bootstrap day.
 */
export const BOOTSTRAP_DAYS: ReadonlySet<IsoDay> = new Set(['2026-11-02', '2026-11-03']);
export const FIRST_COMPARABLE_BASE: IsoDay = '2026-11-03';

const DAY_MS = 86_400_000;

export function toDay(date: Date): IsoDay {
  return date.toISOString().slice(0, 10);
}

export function parseDay(day: IsoDay): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`not an ISO day: ${day}`);
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: IsoDay, n: number): IsoDay {
  return toDay(new Date(parseDay(day).getTime() + n * DAY_MS));
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: IsoDay, b: IsoDay): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS);
}

/** Every day from `from` to `to`, both included. */
export function dayRange(from: IsoDay, to: IsoDay): IsoDay[] {
  const out: IsoDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isBootstrapDay(day: IsoDay): boolean {
  return BOOTSTRAP_DAYS.has(day);
}

export const RANGES = ['1W', '1M', '3M', '1Y', 'ALL'] as const;
export type Range = (typeof RANGES)[number];

/** Days covered by each range; ALL is resolved against the first day of a series. */
export const RANGE_DAYS: Record<Exclude<Range, 'ALL'>, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 91,
  '1Y': 365,
};

/** "4 Nov 2026" */
export function formatDayLong(day: IsoDay): string {
  return parseDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "4 Nov" */
export function formatDayShort(day: IsoDay): string {
  return parseDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
