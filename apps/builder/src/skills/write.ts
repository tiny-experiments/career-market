import { addDays, isBootstrapDay, RANGES, type IsoDay } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import type { Change } from '@cm/core/types';
import { chainIndexFromRows, type IndexRow } from '../compute/skillIndex.ts';
import { rebase, shareAdjustedIndex } from '../compute/chainIndex.ts';
import { computeChange, type ValuePoint } from '../compute/changes.ts';
import { compareSalaries } from '../compute/skillSalary.ts';
import {
  cutsForScope,
  estimateSkillHistory,
  mergeSeries,
  survivalFromBuckets,
  type SkillCutRow,
  type StoredBucket,
} from '../compute/skillSeries.ts';
import { SALARY_CURRENCY, roleLocation, type SkillPulled } from './pull.ts';

/** Day-by-day company and pair counts are kept this long (the 1M change needs 30 days). */
const KEEP_DAYS = 120;

async function insertRows(tx: Sql, table: string, rows: Record<string, unknown>[], columns: string[]): Promise<void> {
  const chunk = Math.max(1, Math.floor(60_000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + chunk) as never, ...(columns as never[]))}`;
  }
}

/** Raw facts from krill for the snapshot day, stored as krill served them. */
export async function writeSkillInputs(tx: Sql, T: IsoDay, p: SkillPulled): Promise<void> {
  const keepFrom = addDays(T, -KEEP_DAYS);

  await tx`delete from skill_summary where date = ${T}`;
  await insertRows(
    tx,
    'skill_summary',
    p.tracked.map((s) => ({ date: T, skill: s.id, slug: s.slug, open_total: s.total, primary_family: s.families[0]?.family ?? null })),
    ['date', 'skill', 'slug', 'open_total', 'primary_family'],
  );
  await tx`delete from skill_summary where date < ${keepFrom}`;

  await tx`delete from skill_tracked where date = ${T} or date < ${keepFrom}`;
  await insertRows(
    tx,
    'skill_tracked',
    [...p.tracked.map((s) => s.id), ...p.failed].map((skill) => ({ date: T, skill })),
    ['date', 'skill'],
  );

  await tx`delete from skill_age_cut where snapshot_date <= ${T}`;
  await insertRows(
    tx,
    'skill_age_cut',
    p.cuts.map((c) => ({ snapshot_date: T, skill: c.skill, family: c.family, cut_date: c.cutDate, count: c.count })),
    ['snapshot_date', 'skill', 'family', 'cut_date', 'count'],
  );

  await tx`delete from skill_company_daily where date = ${T} or date < ${keepFrom}`;
  await insertRows(
    tx,
    'skill_company_daily',
    [...p.companies.values()].flat().map((r) => ({ date: T, skill: r.skill, company_id: r.companyId, open: r.count })),
    ['date', 'skill', 'company_id', 'open'],
  );

  await tx`delete from skill_pair_daily where date = ${T} or date < ${keepFrom}`;
  await insertRows(
    tx,
    'skill_pair_daily',
    [...p.pairs.entries()].flatMap(([skill, rows]) => rows.map((r) => ({ date: T, skill, other: r.other, open: r.count }))),
    ['date', 'skill', 'other', 'open'],
  );

  for (const c of p.companyRefs) {
    await tx`
      insert into company_ref (company_id, name, domain, fetched_on) values (${c.id}, ${c.name}, ${c.domain}, ${T})
      on conflict (company_id) do update set name = excluded.name, domain = excluded.domain, fetched_on = excluded.fetched_on`;
  }

  const rewritten = p.tracked.map((s) => s.id);
  await tx`delete from skill_latest_role where date < ${keepFrom} ${rewritten.length ? tx`or skill in ${tx(rewritten)}` : tx``}`;
  const latestRows: Record<string, unknown>[] = [];
  for (const [skill, jobs] of p.latest) {
    jobs.forEach((j, i) => {
      const min = j.salary?.annualMin ?? null;
      const max = j.salary?.annualMax ?? min;
      latestRows.push({
        date: T,
        skill,
        rank: i + 1,
        job_id: j.id,
        title: j.title,
        company_id: j.company.id,
        company_name: j.company.name,
        location: roleLocation(j),
        salary_min: min === null ? null : Math.round(min),
        salary_max: max === null ? null : Math.round(max),
        salary_currency: min === null ? null : (j.salary?.currency ?? null),
        opened_on: j.openedAt,
      });
    });
  }
  await insertRows(tx, 'skill_latest_role', latestRows, [
    'date', 'skill', 'rank', 'job_id', 'title', 'company_id', 'company_name', 'location',
    'salary_min', 'salary_max', 'salary_currency', 'opened_on',
  ]);

  await tx`delete from skill_salary_effect where date < ${keepFrom} ${rewritten.length ? tx`or skill in ${tx(rewritten)}` : tx``}`;
  const salaryRows: Record<string, unknown>[] = [];
  for (const s of p.tracked) {
    const family = s.families[0]?.family;
    if (!family) continue;
    const sample = p.salary.get(family) ?? [];
    const cmp = compareSalaries(sample, s.id);
    salaryRows.push({
      date: T,
      skill: s.id,
      family,
      currency: SALARY_CURRENCY,
      n_with: cmp.nWith,
      n_without: cmp.nWithout,
      median_with: cmp.medianWith === null ? null : Math.round(cmp.medianWith),
      median_without: cmp.medianWithout === null ? null : Math.round(cmp.medianWithout),
      sample_size: sample.length,
    });
  }
  await insertRows(tx, 'skill_salary_effect', salaryRows, [
    'date', 'skill', 'family', 'currency', 'n_with', 'n_without', 'median_with', 'median_without', 'sample_size',
  ]);
}

interface DailyRow {
  date: IsoDay;
  skill: string;
  family: string;
  open: number;
}

/**
 * The skill demand chart and every skill change, recomputed from the stored
 * inputs. Runs after the market build in the same transaction: it reads the
 * market index and the survival curve that build wrote.
 */
export async function computeSkillPages(tx: Sql, T: IsoDay, log: Logger): Promise<Record<string, unknown>> {
  const skills = await tx<{ skill: string; primary_family: string | null }[]>`
    select skill, primary_family from skill_summary where date = ${T}`;
  if (skills.length === 0) return { skillPages: 0 };
  const ids = skills.map((s) => s.skill);

  const indexRows = await tx<IndexRow[]>`
    select date, open, link, matched_open, matched_previous_open, index_value from market_daily
    where not estimated and date <= ${T} order by date`;
  const index = chainIndexFromRows(indexRows, isBootstrapDay);
  const marketOpen = new Map(indexRows.map((r) => [r.date, r.open]));

  const buckets = await tx<StoredBucket[]>`select age_from, age_to, hazard from survival_curve where snapshot_date = ${T}`;
  const survival = buckets.length ? survivalFromBuckets(buckets) : null;

  const daily = await tx<DailyRow[]>`
    select date, skill, family, open from skill_daily
    where country = '*' and date <= ${T} and skill in ${tx(ids)}`;
  const dailyBySkill = groupBy(daily, (r) => r.skill);
  const cutRows = await tx<(SkillCutRow & { skill: string })[]>`
    select skill, family, cut_date, count from skill_age_cut where snapshot_date = ${T}`;
  const cutsBySkill = groupBy(cutRows, (r) => r.skill);

  const changeRows: Record<string, unknown>[] = [];
  const seriesRows: Record<string, unknown>[] = [];
  let estimatedSkills = 0;

  for (const s of skills) {
    const rows = dailyBySkill.get(s.skill) ?? [];
    const scopes = s.primary_family ? ['*', s.primary_family] : ['*'];
    for (const scope of scopes) {
      const counts = new Map<IsoDay, number>();
      for (const r of rows) if (scope === '*' || r.family === scope) counts.set(r.date, (counts.get(r.date) ?? 0) + r.open);
      const today = counts.get(T);
      if (today === undefined || today <= 0) continue;

      const share = new Map<IsoDay, number>();
      for (const [date, open] of counts) {
        const m = marketOpen.get(date);
        if (m && m > 0) share.set(date, open / m);
      }
      const observed = rebase(shareAdjustedIndex(index, share), today);
      const firstObserved = [...observed.keys()].sort()[0] ?? T;

      const scopeCuts = scopeRows(cutsBySkill.get(s.skill) ?? [], scope);
      const { cuts, datedTotal } = cutsForScope(scopeCuts, scope, T);
      const estimate = survival
        ? estimateSkillHistory({ asOf: T, cuts, datedTotal, totalOpen: today, survival, firstObserved, observedToday: today })
        : null;
      const merged = mergeSeries(estimate ?? [], observed);
      if (estimate) estimatedSkills++;

      for (const m of merged) seriesRows.push({ date: m.date, skill: s.skill, family: scope, estimated: m.estimated, open: m.open });
      if (scope === (s.primary_family ?? '*')) {
        const points: ValuePoint[] = merged.map((m) => ({ date: m.date, value: m.open, estimated: m.estimated }));
        for (const range of RANGES) pushChange(changeRows, T, `skillseries:${s.skill}`, computeChange(points, T, range));
      }
    }
  }

  await tx`delete from skill_series where skill in ${tx(ids)}`;
  await insertRows(tx, 'skill_series', seriesRows, ['date', 'skill', 'family', 'estimated', 'open']);

  // Company and pair changes: the same share-adjusted chain index, over the days we hold.
  const since = addDays(T, -KEEP_DAYS);
  const companyHistory = await tx<{ date: IsoDay; skill: string; key: string; open: number }[]>`
    select date, skill, company_id as key, open from skill_company_daily
    where date >= ${since} and date <= ${T} and skill in ${tx(ids)}`;
  const pairHistory = await tx<{ date: IsoDay; skill: string; key: string; open: number }[]>`
    select date, skill, other as key, open from skill_pair_daily
    where date >= ${since} and date <= ${T} and skill in ${tx(ids)}`;
  for (const [kind, history] of [['skillco', companyHistory], ['skillpair', pairHistory]] as const) {
    for (const [id, series] of groupBy(history, (r) => `${r.skill}\u0000${r.key}`)) {
      if (!series.some((r) => r.date === T)) continue;
      const share = new Map<IsoDay, number>();
      for (const r of series) {
        const m = marketOpen.get(r.date);
        if (m && m > 0) share.set(r.date, r.open / m);
      }
      const points: ValuePoint[] = shareAdjustedIndex(index, share).map((x) => ({ date: x.date, value: x.value, estimated: false }));
      const [skill, key] = id.split('\u0000') as [string, string];
      pushChange(changeRows, T, `${kind}:${skill}:${key}`, computeChange(points, T, '1M'));
    }
  }

  await tx`delete from market_change where as_of = ${T} and (subject like 'skillseries:%' or subject like 'skillco:%' or subject like 'skillpair:%')`;
  await insertRows(tx, 'market_change', changeRows, ['as_of', 'subject', 'range', 'base_date', 'change', 'partial', 'estimated']);

  const stats = { skillPages: skills.length, skillBackcasts: estimatedSkills, skillSeriesRows: seriesRows.length };
  log.info(stats, 'skill pages written');
  return stats;
}

/** Cuts of one scope for the back-cast; a profession with no roles at a cut counts 0 there. */
function scopeRows(rows: readonly (SkillCutRow & { skill: string })[], scope: string): SkillCutRow[] {
  if (scope === '*') return rows.filter((r) => r.family === '*');
  const byDate = new Map(rows.filter((r) => r.family === scope).map((r) => [r.cut_date, r.count]));
  return rows.filter((r) => r.family === '*').map((r) => ({ family: scope, cut_date: r.cut_date, count: byDate.get(r.cut_date) ?? 0 }));
}

function pushChange(rows: Record<string, unknown>[], T: IsoDay, subject: string, c: Change | null): void {
  if (!c) return;
  rows.push({ as_of: T, subject, range: c.range, base_date: c.baseDate, change: c.value, partial: c.partial, estimated: c.estimated });
}

function groupBy<T, K>(rows: readonly T[], key: (r: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}
