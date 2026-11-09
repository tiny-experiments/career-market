import { isBootstrapDay, type IsoDay } from '@cm/core/dates';

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
 * the day changes are multiplied. Bootstrap days and days without a panel
 * match contribute no change. 100 on the first day.
 */
export function chainIndex(days: readonly IsoDay[], panel: ReadonlyMap<IsoDay, PanelDay>): IndexPoint[] {
  const out: IndexPoint[] = [];
  let value = 100;
  days.forEach((date, i) => {
    const p = panel.get(date);
    const usable = i > 0 && !isBootstrapDay(date) && p !== undefined && p.matchedPreviousOpen > 0 && p.matchedOpen > 0;
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
 */
export function shareAdjustedIndex(
  market: readonly IndexPoint[],
  share: ReadonlyMap<IsoDay, number>,
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
    const usable = point.linkUsed && prevShare !== undefined && prevShare > 0 && s > 0;
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
