import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import { skillIndex, skillPage } from '../src/skillPage.ts';

/**
 * Runs against a scratch Postgres: set TEST_DATABASE_URL to a database that may
 * be wiped (every table of the read model is dropped and recreated).
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('skill pages when krill failed a skill on the latest night', () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = createSql(url as string, { max: 2 });
    await sql`drop schema public cascade`;
    await sql`create schema public`;
    await migrate(sql);
    await sql`insert into build_run (snapshot_date, status, finished_at) values ('2026-11-05', 'ok', now())`;
    await sql`insert into skill_summary (date, skill, slug, open_total, primary_family) values
      ('2026-11-04', 'ml:jax', 'jax', 120, 'ml'),
      ('2026-11-04', 'ml:pytorch', 'pytorch', 900, 'ml'),
      ('2026-11-05', 'ml:pytorch', 'pytorch', 950, 'ml'),
      ('2026-10-01', 'ml:old', 'old', 50, 'ml')`;
    await sql`insert into skill_daily (date, skill, family, country, open) values
      ('2026-11-04', 'ml:jax', 'ml', '*', 120),
      ('2026-11-05', 'ml:pytorch', 'ml', '*', 950)`;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it('serves the skill from its own latest day', async () => {
    const page = await skillPage(sql, 'jax');
    expect(page?.asOf).toBe('2026-11-04');
    expect(page?.totalOpen).toBe(120);
    expect((await skillPage(sql, 'pytorch'))?.asOf).toBe('2026-11-05');
  });

  it('lists it in the index at its own numbers and drops skills gone for over a week', async () => {
    const index = await skillIndex(sql);
    expect(index.asOf).toBe('2026-11-05');
    expect(index.skills.map((s) => [s.id, s.open])).toEqual([
      ['ml:pytorch', 950],
      ['ml:jax', 120],
    ]);
    expect(await skillPage(sql, 'old')).toBeNull();
  });
});
