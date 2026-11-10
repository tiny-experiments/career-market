import type { Sql } from '@cm/core/db';
import { isBoardEvent, type DayRow } from '@cm/core/company';
import { addDays, FIRST_COMPARABLE_BASE, type IsoDay } from '@cm/core/dates';

export type GrowthMode = 'like-for-like' | 'raw';

/** One company's daily statistics row. */
export interface CompanyDayRow extends DayRow {
  companyId: string;
}

/**
 * The company held the same boards from `base` to `day`: it had open roles at the
 * base, and no day after it restarts the company's series the way the company
 * pages do (a board added, fetched in bulk or dropped, or roles back from zero).
 * Such a day moves hundreds of roles that were already open elsewhere, so it
 * is not hiring. krill sends no row for a quiet company-day, so a missing day is 0.
 */
export function sameBoards(byDate: ReadonlyMap<IsoDay, DayRow>, base: IsoDay, day: IsoDay): boolean {
  let prevOpen = byDate.get(base)?.open ?? 0;
  if (prevOpen <= 0) return false;
  for (let d = addDays(base, 1); d <= day; d = addDays(d, 1)) {
    const r = byDate.get(d) ?? { date: d, open: 0, new: 0, closed: 0 };
    if ((r.open > 0 && prevOpen === 0) || isBoardEvent(r, prevOpen)) return false;
    prevOpen = r.open;
  }
  return true;
}

/**
 * Change of open roles from `base` to `day`, compared at the two endpoints.
 * like-for-like counts only companies present on both days with the same
 * boards throughout (see sameBoards); raw compares the full endpoint totals.
 * `rows` must hold every company-day from `base` to `day`.
 */
export function growthRatio(rows: readonly CompanyDayRow[], base: IsoDay, day: IsoDay, mode: GrowthMode): number | null {
  const byCompany = new Map<string, Map<IsoDay, DayRow>>();
  for (const r of rows) {
    if (r.date < base || r.date > day) continue;
    const days = byCompany.get(r.companyId) ?? new Map<IsoDay, DayRow>();
    days.set(r.date, r);
    byCompany.set(r.companyId, days);
  }
  let before = 0;
  let after = 0;
  for (const days of byCompany.values()) {
    const from = days.get(base);
    const to = days.get(day);
    if (mode === 'like-for-like' && !(from && to && sameBoards(days, base, day))) continue;
    before += from?.open ?? 0;
    after += to?.open ?? 0;
  }
  return before > 0 ? after / before - 1 : null;
}

export async function writeGrowth(tx: Sql, day: IsoDay, mode: GrowthMode): Promise<void> {
  const base = addDays(day, -7);
  const rows = await tx<{ date: IsoDay; company_id: string; open: number; new: number; closed: number }[]>`
    select date, company_id, open, new, closed from company_daily
    where family = '*' and new is not null and date >= ${base} and date <= ${day}`;
  // krill counted every role as new on its bootstrap days, so a week cannot start before the last of them.
  const value = base < FIRST_COMPARABLE_BASE
    ? null
    : growthRatio(rows.map((r) => ({ companyId: r.company_id, date: r.date, open: r.open, new: r.new, closed: r.closed })), base, day, mode);
  // Seven days of history is required: never label a shorter interval as a week.
  await tx`delete from market_change where as_of = ${day} and subject = 'market' and range = '1W'`;
  if (value !== null) await tx`insert into market_change(as_of, subject, range, base_date, change, partial, estimated)
    values (${day}, 'market', '1W', ${base}, ${value}, false, false)`;
}
