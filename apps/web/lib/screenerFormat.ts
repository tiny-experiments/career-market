import type { Change } from '@cm/core/types';
import { formatDayShort } from '@cm/core/dates';

/** 0.0213 -> "+2.1%", -0.018 -> "−1.8%" (true minus sign). */
export function signedPct(f: number, digits = 1): string {
  const v = Math.abs(f * 100).toFixed(digits);
  return f < 0 && Number(v) !== 0 ? `−${v}%` : `+${v}%`;
}

/** Plain-language sentence for a change, for titles and screen readers. */
export function changeTitle(c: Change, full: string): string {
  const dir = c.value >= 0 ? 'up' : 'down';
  const span = c.partial ? `since ${formatDayShort(c.baseDate)}` : c.estimated ? `${full} (estimated)` : full;
  return `${dir} ${Math.abs(c.value * 100).toFixed(1)}% ${span}`;
}

/** "56%" from a 0-1 share. */
export function pct0(f: number): string {
  return `${Math.round(f * 100)}%`;
}

/** Age of a role from its opened day: 0 -> "today", 3 -> "3d ago". */
export function ageLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
