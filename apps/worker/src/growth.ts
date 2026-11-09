import type { Sql } from '@cm/core/db';
import { addDays } from '@cm/core/dates';

/** Compare endpoint company cohorts, not a chain of different daily panels. */
export function growthRatio(base: ReadonlyMap<string, number>, current: ReadonlyMap<string, number>, mode: 'like-for-like' | 'raw'): number | null {
  const ids = mode === 'raw' ? new Set([...base.keys(), ...current.keys()]) : new Set([...base.keys()].filter((id) => current.has(id)));
  let before = 0;
  let after = 0;
  for (const id of ids) { before += base.get(id) ?? 0; after += current.get(id) ?? 0; }
  return before > 0 ? after / before - 1 : null;
}

export async function writeGrowth(tx: Sql, day: string, mode: 'like-for-like' | 'raw'): Promise<void> {
  const base = addDays(day, -7);
  const rows = await tx<{ date: string; company_id: string; open: number }[]>`
    select date, company_id, open from company_daily where family = '*' and date in (${base}, ${day})`;
  const value = growthRatio(new Map(rows.filter((r) => r.date === base).map((r) => [r.company_id, r.open])),
    new Map(rows.filter((r) => r.date === day).map((r) => [r.company_id, r.open])), mode);
  // Seven days of history is required: never label a shorter interval as a week.
  await tx`delete from market_change where as_of = ${day} and subject = 'market' and range = '1W'`;
  if (value !== null) await tx`insert into market_change(as_of, subject, range, base_date, change, partial, estimated)
    values (${day}, 'market', '1W', ${base}, ${value}, false, false)`;
}
