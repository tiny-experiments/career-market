import { isBootstrapDay, type IsoDay } from '@cm/core/dates';

/** One day of market counts: krill's daily totals and, when krill matched boards, its panel. */
export interface CountDay {
  date: IsoDay;
  open: number;
  new: number | null;
  closed: number | null;
  matchedOpen?: number | null;
  matchedPreviousOpen?: number | null;
  newOnKnownBoards?: number | null;
}

/**
 * How far a day's open roles may stray from what its openings and closings
 * explain before the day counts as a counting change. Market totals follow
 * yesterday's open plus new minus closed to within 0.3% on a normal day, and
 * the matched-board panel to within 2%; the 10 Nov 2026 merge of duplicate
 * Oracle records moved them -8.8% and -14.9%.
 */
export const COUNTING_CHANGE = { market: 0.02, panel: 0.05 } as const;

/**
 * Days krill re-counted open roles instead of seeing them open or close (it
 * merged duplicate records, and keeps the earlier totals as they were). Such a
 * day is an identity correction, not hiring, so the index holds it flat like a
 * bootstrap day and the history before it is rebased onto the corrected count.
 * Detected from the counts alone: the market total or the panel moved by more
 * than COUNTING_CHANGE beyond the day's own openings and closings.
 */
export function countingChangeDays(days: readonly CountDay[]): Set<IsoDay> {
  const out = new Set<IsoDay>();
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  sorted.forEach((d, i) => {
    if (isBootstrapDay(d.date) || d.new === null || d.closed === null) return;
    const prev = sorted[i - 1];
    if (prev && prev.open > 0 && Math.abs(d.open - (prev.open + d.new - d.closed)) >= COUNTING_CHANGE.market * prev.open) out.add(d.date);
    const base = d.matchedPreviousOpen ?? 0;
    if (base > 0 && d.matchedOpen != null && d.newOnKnownBoards != null
      && Math.abs(d.matchedOpen - (base + d.newOnKnownBoards - d.closed)) >= COUNTING_CHANGE.panel * base) out.add(d.date);
  });
  return out;
}

/**
 * Days a set of slice counts kept at build time (skills) changed basis: their
 * combined share of open roles jumps by more than `threshold` from the
 * previous stored day. Counts kept on the day cannot be fetched again, so after
 * krill re-counts a day the stored slice counts and the refetched market total
 * disagree until the next build; the share steps on both edges of that gap.
 */
export const SLICE_BASIS_CHANGE = 0.05;

export function sliceBasisChangeDays(
  totals: ReadonlyMap<IsoDay, number>,
  marketOpen: ReadonlyMap<IsoDay, number>,
  threshold = SLICE_BASIS_CHANGE,
): Set<IsoDay> {
  const out = new Set<IsoDay>();
  let prev: number | undefined;
  for (const date of [...totals.keys()].sort()) {
    const m = marketOpen.get(date);
    const t = totals.get(date) as number;
    if (!m || m <= 0 || t <= 0) continue;
    const ratio = t / m;
    if (prev !== undefined && !isBootstrapDay(date) && Math.abs(ratio / prev - 1) >= threshold) out.add(date);
    prev = ratio;
  }
  return out;
}

export interface PanelDay {
  date: IsoDay;
  matchedOpen: number;
  matchedPreviousOpen: number;
}

export interface IndexPoint {
  date: IsoDay;
  /** Day link: open(today) / open(yesterday) on boards krill fetched on both days. 1 when excluded. */
  link: number;
  linkUsed: boolean;
  value: number;
}

/**
 * Chain-linked Tech Hiring Index (captain's decision): each day's change is
 * measured only on the boards krill fetched on both days (krill K3 panel), and
 * the day changes are multiplied. Bootstrap days, counting changes (see
 * countingChangeDays) and days without a panel match contribute no change.
 * 100 on the first day.
 */
export function chainIndex(
  days: readonly IsoDay[],
  panel: ReadonlyMap<IsoDay, PanelDay>,
  counting: ReadonlySet<IsoDay> = new Set(),
): IndexPoint[] {
  const out: IndexPoint[] = [];
  let value = 100;
  days.forEach((date, i) => {
    const p = panel.get(date);
    const usable = i > 0 && !isBootstrapDay(date) && !counting.has(date) && p !== undefined && p.matchedPreviousOpen > 0 && p.matchedOpen > 0;
    const link = usable ? p.matchedOpen / p.matchedPreviousOpen : 1;
    value *= link;
    out.push({ date, link, linkUsed: usable, value });
  });
  return out;
}

/**
 * A slice (family, skill) follows the market index scaled by its share of
 * open jobs: link = market link x share(today) / share(yesterday). New boards
 * that join with the market's mix move neither the market link nor the share.
 * A day the market link is not used, or a day in `hold`, contributes no change.
 */
export function shareAdjustedIndex(
  market: readonly IndexPoint[],
  share: ReadonlyMap<IsoDay, number>,
  hold: ReadonlySet<IsoDay> = new Set(),
): { date: IsoDay; value: number; linkUsed: boolean }[] {
  const out: { date: IsoDay; value: number; linkUsed: boolean }[] = [];
  let value = 100;
  let prevShare: number | undefined;
  let gapLink = 1;
  for (const point of market) {
    const s = share.get(point.date);
    if (s === undefined) {
      if (point.linkUsed) gapLink *= point.link;
      continue;
    }
    const usable = point.linkUsed && !hold.has(point.date) && prevShare !== undefined && prevShare > 0 && s > 0;
    if (usable) value *= gapLink * point.link * (s / (prevShare as number));
    gapLink = 1;
    out.push({ date: point.date, value, linkUsed: usable });
    prevShare = s;
  }
  return out;
}

/** Rebase an index onto today's count: value(d) = countToday x index(d) / index(today). */
export function rebase(index: readonly { date: IsoDay; value: number }[], countToday: number): Map<IsoDay, number> {
  const last = index.at(-1);
  const out = new Map<IsoDay, number>();
  if (!last || last.value <= 0) return out;
  for (const p of index) out.set(p.date, Math.round((countToday * p.value) / last.value));
  return out;
}
