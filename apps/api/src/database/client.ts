import {
  Kysely,
  PostgresDialect,
  sql as kyselySql,
  type RawBuilder,
} from 'kysely';
import pg from 'pg';
import type { DB } from './generated.ts';

export type Database = Kysely<DB>;
export function createDatabase(url: string): Database {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: url,
        max: 10,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 15_000,
        types: {
          getTypeParser: (oid, format) =>
            oid === 1082
              ? (value: string) => value
              : pg.types.getTypeParser(oid, format),
        },
      }),
    }),
  });
}

/** Parameterised Kysely raw queries for the existing aggregate projections. */
export interface Queries {
  <Rows extends unknown[]>(
    parts: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Rows>;
  (values: readonly unknown[]): RawBuilder<unknown>;
}
export function createQueries(db: Database): Queries {
  function query<Rows extends unknown[]>(
    parts: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Rows>;
  function query(values: readonly unknown[]): RawBuilder<unknown>;
  function query(
    parts: TemplateStringsArray | readonly unknown[],
    ...values: unknown[]
  ) {
    if (!('raw' in parts)) return kyselySql`(${kyselySql.join(parts)})`;
    return kyselySql<unknown>(parts as TemplateStringsArray, ...values)
      .execute(db)
      .then((result) => result.rows);
  }
  return query;
}
