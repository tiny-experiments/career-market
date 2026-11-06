import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { IsoDay } from '@cm/core/dates';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import type { KrillJob } from '../../builder/src/krill/skillApi.ts';
import type { SkillPulled } from '../../builder/src/skills/pull.ts';
import { writeSkillInputs } from '../../builder/src/skills/write.ts';
import { skillIndex, skillPage } from '../src/skillPage.ts';

/**
 * Runs against a scratch Postgres (CI starts one): set TEST_DATABASE_URL to a
 * database that may be wiped. The builder writes two nights through
 * writeSkillInputs and the API reads them back.
 */
const url = process.env.TEST_DATABASE_URL;

const DAY1 = '2026-11-04' as IsoDay;
const DAY2 = '2026-11-05' as IsoDay;

function job(id: string, openedAt: IsoDay): KrillJob {
  return { id, title: `Role ${id}`, company: { id: 'acme', name: 'Acme' }, places: [], openedAt, skills: [] };
}

function pulled(tracked: Record<string, number>, failed: string[], openedAt: IsoDay): SkillPulled {
  const ids = Object.keys(tracked);
  return {
    tracked: ids.map((id) => ({ id, slug: id.split(':')[1] as string, total: tracked[id] as number, families: [{ family: 'ml', count: tracked[id] as number }] })),
    failed,
    cuts: [],
    companies: new Map(ids.map((id) => [id, [{ skill: id, companyId: 'acme', count: 3 }]])),
    pairs: new Map(),
    latest: new Map(ids.map((id) => [id, [job(`${id}-${openedAt}`, openedAt)]])),
    companyRefs: [{ id: 'acme', name: 'Acme', domain: 'acme.example' }],
    salary: new Map(),
    salarySampleSize: new Map(),
  };
}

describe.skipIf(!url)('skill pages when krill fails a skill on the latest night', () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = createSql(url as string, { max: 2 });
    await sql`drop schema public cascade`;
    await sql`create schema public`;
    await migrate(sql);
    await sql`insert into build_run (snapshot_date, status, finished_at) values (${DAY2}, 'ok', now())`;
    await sql`insert into skill_daily (date, skill, family, country, open) values
      (${DAY1}, 'ml:jax', 'ml', '*', 120), (${DAY1}, 'ml:pytorch', 'ml', '*', 900), (${DAY1}, 'ml:tensorflow', 'ml', '*', 400),
      (${DAY2}, 'ml:pytorch', 'ml', '*', 950), (${DAY2}, 'ml:keras', 'ml', '*', 80)`;

    await sql.begin((tx) => writeSkillInputs(tx as unknown as Sql, DAY1, pulled({ 'ml:jax': 120, 'ml:pytorch': 900, 'ml:tensorflow': 400 }, [], DAY1)));
    await sql.begin((tx) => writeSkillInputs(tx as unknown as Sql, DAY2, pulled({ 'ml:pytorch': 950, 'ml:keras': 80 }, ['ml:jax'], DAY2)));
  });

  afterAll(async () => {
    await sql?.end();
  });

  it('keeps the failed skill rows of its last good day and rewrites the others', async () => {
    const roles = await sql<{ skill: string; job_id: string }[]>`select skill, job_id from skill_latest_role order by skill`;
    expect(roles.map((r) => [r.skill, r.job_id])).toEqual([
      ['ml:jax', `ml:jax-${DAY1}`],
      ['ml:keras', `ml:keras-${DAY2}`],
      ['ml:pytorch', `ml:pytorch-${DAY2}`],
      ['ml:tensorflow', `ml:tensorflow-${DAY1}`],
    ]);
    const effects = await sql<{ skill: string; date: IsoDay }[]>`select skill, date from skill_salary_effect order by skill`;
    expect(effects.map((e) => [e.skill, e.date])).toEqual([
      ['ml:jax', DAY1],
      ['ml:keras', DAY2],
      ['ml:pytorch', DAY2],
      ['ml:tensorflow', DAY1],
    ]);
  });

  it('serves the failed skill from its own latest day and marks it stale', async () => {
    const jax = await skillPage(sql, 'jax');
    expect(jax).toMatchObject({ asOf: DAY1, stale: true, totalOpen: 120 });
    expect(jax?.latestRoles.map((r) => r.id)).toEqual([`ml:jax-${DAY1}`]);
    expect(await skillPage(sql, 'pytorch')).toMatchObject({ asOf: DAY2, stale: false, totalOpen: 950 });
  });

  it('lists the failed skill with its own day and drops a skill that left the tracked set', async () => {
    const index = await skillIndex(sql);
    expect(index.asOf).toBe(DAY2);
    expect(index.skills.map((s) => [s.id, s.open, s.asOf])).toEqual([
      ['ml:pytorch', 950, DAY2],
      ['ml:jax', 120, DAY1],
      ['ml:keras', 80, DAY2],
    ]);
    expect(await skillPage(sql, 'tensorflow')).toBeNull();
  });
});
