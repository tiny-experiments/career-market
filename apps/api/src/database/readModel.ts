import type { IsoDay, Range } from '@cm/core/dates';
import type { Change } from '@cm/core/types';
import type { Queries as Sql } from './client.ts';
import { NotReadyError } from '../http/projectionErrors.ts';
interface ChangeRow {
  subject: string;
  range: Range;
  base_date: IsoDay;
  change: number;
  partial: boolean;
  estimated: boolean;
}

export { NotReadyError };

export async function latestBuild(
  sql: Sql,
): Promise<{ asOf: IsoDay; builtAt: string } | null> {
  const [row] = await sql<{ snapshot_date: IsoDay; finished_at: Date }[]>`
    select snapshot_date, finished_at from build_run
    where status = 'ok' order by snapshot_date desc, finished_at desc limit 1`;
  return row
    ? { asOf: row.snapshot_date, builtAt: row.finished_at.toISOString() }
    : null;
}

export async function changes(
  sql: Sql,
  asOf: IsoDay,
  subjects: string[],
  range: Range,
): Promise<Map<string, Change>> {
  if (subjects.length === 0) return new Map();
  const rows = await sql<ChangeRow[]>`
    select subject, range, base_date, change, partial, estimated from market_change
    where as_of = ${asOf} and range = ${range} and subject in ${sql(subjects)}`;
  return new Map(
    rows.map((r) => [
      r.subject,
      {
        range: r.range,
        value: r.change,
        baseDate: r.base_date,
        partial: r.partial,
        estimated: r.estimated,
      },
    ]),
  );
}
