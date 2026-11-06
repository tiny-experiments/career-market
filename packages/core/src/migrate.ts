import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sql } from './db.ts';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** Applies plain SQL migrations in file-name order, each in its own transaction. */
export async function migrate(sql: Sql, dir = MIGRATIONS_DIR): Promise<string[]> {
  await sql`create table if not exists schema_migration (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migration`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const text = await readFile(path.join(dir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migration (name) values (${file})`;
    });
    applied.push(file);
  }
  return applied;
}
