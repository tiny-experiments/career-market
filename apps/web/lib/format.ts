import { formatDayShort } from '@cm/core/dates';
import type { Change } from '@cm/core/types';

const intFmt = new Intl.NumberFormat('en-US');

export function fmtInt(n: number): string {
  return intFmt.format(Math.round(n));
}

/** 225663 -> "226K"; 1200000 -> "1.2M" */
export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

/** 0.0213 -> "2.1%" (no sign; arrows carry the direction). */
export function fmtPct(f: number, digits = 1): string {
  return `${(Math.abs(f) * 100).toFixed(digits)}%`;
}

export function isUp(change: Change): boolean {
  return change.value >= 0;
}

/** Text that explains which window a change covers. */
export function changeWindow(change: Change, full: string): string {
  if (change.partial) return `since ${formatDayShort(change.baseDate)}`;
  return change.estimated ? `${full} (est.)` : full;
}

/** Screen-reader sentence for a change. */
export function changeSentence(change: Change, full: string): string {
  return `${isUp(change) ? 'up' : 'down'} ${fmtPct(change.value)} ${changeWindow(change, full)}`;
}
