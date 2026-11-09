import type { IsoDay } from '@cm/core/dates';
import type { IndexPoint } from './chainIndex.ts';

/** The columns of market_daily the chain-linked index is rebuilt from. */
export interface IndexRow {
  date: IsoDay;
  open: number;
  link: number | null;
  matched_open: number | null;
  matched_previous_open: number | null;
  index_value: number;
}

/**
 * Rebuild the market index points (as chainIndex made them) from stored
 * market_daily rows, so the skill steps run on the same index as the market
 * and the profession series. A day is "used" when it had a matched-board panel
 * and is not a bootstrap day.
 */
export function chainIndexFromRows(rows: readonly IndexRow[], isBootstrap: (day: IsoDay) => boolean): IndexPoint[] {
  return rows.map((r, i) => ({
    date: r.date,
    link: r.link ?? 1,
    linkUsed: i > 0 && !isBootstrap(r.date) && (r.matched_previous_open ?? 0) > 0 && (r.matched_open ?? 0) > 0,
    value: r.index_value,
  }));
}
