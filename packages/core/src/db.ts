import postgres from 'postgres';

export type Sql = postgres.Sql;

/** One postgres.js pool. Dates stay ISO strings (yyyy-mm-dd) end to end. */
export function createSql(databaseUrl: string, options: { max?: number } = {}): Sql {
  return postgres(databaseUrl, {
    max: options.max ?? 5,
    onnotice: () => {},
    types: {
      // 1082 = date: keep the plain calendar day, never a JS Date in local time.
      date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v },
    },
    transform: { undefined: null },
  });
}
