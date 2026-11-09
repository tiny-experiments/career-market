import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sql } from './db.ts';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** One ordered migration set, atomically applied and serialized across API/worker startup. */
export async function migrate(sql: Sql, dir = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const migrations = await Promise.all(files.map(async (name) => ({ name, text: await readFile(path.join(dir, name), 'utf8') })));
  const applied: string[] = [];
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(712903, 1)`;
    await tx`create table if not exists schema_migration (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
    const done = new Set((await tx<{ name: string }[]>`select name from schema_migration`).map((row) => row.name));
    for (const migration of migrations) {
      if (done.has(migration.name)) continue;
      await tx.unsafe(migration.text);
      await tx`insert into schema_migration (name) values (${migration.name})`;
      applied.push(migration.name);
    }
  });
  return applied;
}
