import { familyInfo, isTileSkill, skillLabel } from '@cm/core/codes';
import { daysBetween, formatDayLong, type IsoDay, type Range } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import {
  skillCategory,
  skillDomain,
  skillNamespace,
  type SkillCompanyRow,
  type SkillIndexPayload,
  type SkillPagePayload,
  type SkillPairRow,
  type SkillPeer,
  type SkillProfessionRow,
  type SkillRoleRow,
  type SkillSalaryEffect,
} from '@cm/core/skills';
import type { Change, Unavailable } from '@cm/core/types';
import { latestBuild, NotReadyError } from './readModel.ts';

/** Read-only queries behind the Skill page. Nothing here calls krill. */

const PROFESSION_ROWS = 4;
const COMPANY_ROWS = 5;
const PAIR_ROWS = 6;
/** Each side of the salary comparison needs this many priced roles (builder: MIN_SALARY_SIDE). */
const MIN_SALARY_SIDE = 50;

interface SummaryRow {
  date: IsoDay;
  skill: string;
  slug: string;
  open_total: number;
  primary_family: string | null;
}

async function latestSkillDay(sql: Sql): Promise<IsoDay> {
  const [row] = await sql<{ date: IsoDay | null }[]>`select max(date) as date from skill_summary`;
  if (!row?.date) throw new NotReadyError();
  return row.date;
}

async function changeMap(sql: Sql, asOf: IsoDay, subjects: string[], range: Range): Promise<Map<string, Change>> {
  if (subjects.length === 0) return new Map();
  const rows = await sql<{ subject: string; range: Range; base_date: IsoDay; change: number; partial: boolean; estimated: boolean }[]>`
    select subject, range, base_date, change, partial, estimated from market_change
    where as_of = ${asOf} and range = ${range} and subject in ${sql(subjects)}`;
  return new Map(
    rows.map((r) => [r.subject, { range: r.range, value: r.change, baseDate: r.base_date, partial: r.partial, estimated: r.estimated }]),
  );
}

/** The page of one skill, found by its URL slug (or its bare name); null when no tracked skill matches. */
export async function skillPage(sql: Sql, slug: string): Promise<SkillPagePayload | null> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const D = await latestSkillDay(sql);

  const [row] = await sql<SummaryRow[]>`
    select date, skill, slug, open_total, primary_family from skill_summary
    where date = ${D} and (slug = ${slug} or split_part(skill, ':', 2) = ${slug})
    order by (slug = ${slug}) desc, open_total desc limit 1`;
  if (!row || !row.primary_family) return null;
  const id = row.skill;
  const family = row.primary_family;
  const info = familyInfo(family);

  // Roles naming the skill per profession (krill's per-profession skill facets).
  const perFamily = await sql<{ family: string; open: number }[]>`
    select family, open from skill_daily where date = ${D} and skill = ${id} and country = '*' order by open desc`;
  const primaryOpen = perFamily.find((f) => f.family === family)?.open ?? 0;
  const [fam] = await sql<{ open: number }[]>`select open from family_daily where date = ${D} and family = ${family}`;
  const familyOpen = fam?.open ?? 0;

  const change = (await changeMap(sql, D, [`skillseries:${id}`], '1M')).get(`skillseries:${id}`) ?? null;

  const series = await sql<{ date: IsoDay; open: number; estimated: boolean }[]>`
    select date, open, estimated from skill_series where skill = ${id} and family = ${family} and date <= ${D} order by date`;
  const firstObservedDay = series.find((p) => !p.estimated)?.date ?? D;
  const hasEstimate = series.some((p) => p.estimated);

  // Names the skill's slug when it has a page of its own.
  const slugRows = await sql<{ skill: string; slug: string }[]>`select skill, slug from skill_summary where date = ${D}`;
  const slugOf = new Map(slugRows.map((r) => [r.skill, r.slug]));

  const peerRows = await sql<{ skill: string; open: number }[]>`
    select skill, open from skill_daily
    where date = ${D} and family = ${family} and country = '*' and skill like ${`${skillNamespace(id)}:%`} and skill <> ${id}
    order by open desc limit 12`;
  const peers: SkillPeer[] = [
    { id, slug: row.slug, label: skillLabel(id), domain: skillDomain(id), open: primaryOpen, self: true },
    ...peerRows
      .filter((p) => isTileSkill(p.skill))
      .slice(0, 2)
      .map((p) => ({ id: p.skill, slug: slugOf.get(p.skill) ?? null, label: skillLabel(p.skill), domain: skillDomain(p.skill), open: p.open, self: false })),
  ].sort((a, b) => b.open - a.open);

  const allNamed = perFamily.reduce((n, f) => n + f.open, 0) || row.open_total;
  const professions: SkillProfessionRow[] = perFamily.slice(0, PROFESSION_ROWS).map((f) => {
    const fi = familyInfo(f.family);
    return { family: f.family, code: fi.code, name: fi.name, open: f.open, share: f.open / allNamed };
  });

  const companyRows = await sql<{ company_id: string; open: number; name: string | null; domain: string | null }[]>`
    select d.company_id, d.open, r.name, r.domain from skill_company_daily d
    left join company_ref r on r.company_id = d.company_id
    where d.date = ${D} and d.skill = ${id} order by d.open desc, d.company_id limit ${COMPANY_ROWS}`;
  const companyChanges = await changeMap(sql, D, companyRows.map((c) => `skillco:${id}:${c.company_id}`), '1M');
  const companies: SkillCompanyRow[] = companyRows.map((c) => ({
    id: c.company_id,
    name: c.name ?? c.company_id,
    domain: c.domain,
    open: c.open,
    change: companyChanges.get(`skillco:${id}:${c.company_id}`) ?? null,
  }));

  const pairRows = await sql<{ other: string; open: number }[]>`
    select other, open from skill_pair_daily where date = ${D} and skill = ${id} order by open desc limit 40`;
  const shownPairs = pairRows.filter((p) => isTileSkill(p.other)).slice(0, PAIR_ROWS);
  const pairChanges = await changeMap(sql, D, shownPairs.map((p) => `skillpair:${id}:${p.other}`), '1M');
  const pairs: SkillPairRow[] = shownPairs.map((p) => ({
    id: p.other,
    slug: slugOf.get(p.other) ?? null,
    label: skillLabel(p.other),
    domain: skillDomain(p.other),
    open: p.open,
    share: row.open_total > 0 ? p.open / row.open_total : 0,
    change: pairChanges.get(`skillpair:${id}:${p.other}`) ?? null,
  }));

  const [fx] = await sql<
    { family: string; currency: string; n_with: number; n_without: number; median_with: number | null; median_without: number | null; sample_size: number }[]
  >`select family, currency, n_with, n_without, median_with, median_without, sample_size from skill_salary_effect where skill = ${id} limit 1`;
  const salaryEffect = salaryEffectOf(fx);

  const roleRows = await sql<
    {
      job_id: string;
      title: string;
      company_id: string;
      company_name: string;
      domain: string | null;
      location: string | null;
      salary_min: number | null;
      salary_max: number | null;
      salary_currency: string | null;
      opened_on: IsoDay;
    }[]
  >`
    select l.job_id, l.title, l.company_id, l.company_name, r.domain, l.location, l.salary_min, l.salary_max, l.salary_currency, l.opened_on
    from skill_latest_role l left join company_ref r on r.company_id = l.company_id
    where l.skill = ${id} order by l.rank`;
  const latestRoles: SkillRoleRow[] = roleRows.map((r) => ({
    id: r.job_id,
    title: r.title,
    company: { id: r.company_id, name: r.company_name, domain: r.domain },
    location: r.location,
    salary:
      r.salary_min !== null && r.salary_max !== null && r.salary_currency
        ? { min: r.salary_min, max: r.salary_max, currency: r.salary_currency }
        : null,
    openedOn: r.opened_on,
    ageDays: Math.max(0, daysBetween(r.opened_on, D)),
  }));

  return {
    asOf: D,
    builtAt: build.builtAt,
    id,
    slug: row.slug,
    label: skillLabel(id),
    category: skillCategory(id),
    domain: skillDomain(id),
    primary: {
      family,
      code: info.code,
      name: info.name,
      open: primaryOpen,
      familyOpen,
      share: familyOpen > 0 ? primaryOpen / familyOpen : 0,
    },
    totalOpen: row.open_total,
    change,
    series: series.map((p) => ({ date: p.date, open: p.open, estimated: p.estimated })),
    firstObservedDay,
    seriesNote: hasEstimate
      ? `Before ${formatDayLong(firstObservedDay)} the line is estimated: a survival-corrected back-cast from the posted dates of the open roles that name ${skillLabel(id)} and the closings krill detects.`
      : `${skillLabel(id)} counts are observed from ${formatDayLong(firstObservedDay)}. Estimated history appears once enough closings are sampled to fit the survival curve.`,
    peers,
    professions,
    companies,
    pairs,
    salaryEffect,
    latestRoles,
  };
}

function salaryEffectOf(
  fx:
    | { family: string; currency: string; n_with: number; n_without: number; median_with: number | null; median_without: number | null; sample_size: number }
    | undefined,
): SkillSalaryEffect | Unavailable {
  if (!fx) return { available: false, reason: 'Not computed yet: it appears after the next build.' };
  const name = familyInfo(fx.family).name;
  if (fx.median_with === null || fx.median_without === null) {
    return {
      available: false,
      reason: `Needs ${MIN_SALARY_SIDE} US roles with listed USD pay on each side. The latest sample of ${fx.sample_size} priced ${name} roles has ${fx.n_with} naming this skill and ${fx.n_without} without it.`,
    };
  }
  return {
    available: true,
    family: fx.family,
    familyName: name,
    currency: fx.currency,
    delta: fx.median_with - fx.median_without,
    medianWith: fx.median_with,
    medianWithout: fx.median_without,
    nWith: fx.n_with,
    nWithout: fx.n_without,
    scope: `US ${name} roles with listed ${fx.currency} pay (${fx.sample_size} sampled, at most 5 per company)`,
  };
}

/** Every tracked skill, largest first: the list behind /skills. */
export async function skillIndex(sql: Sql): Promise<SkillIndexPayload> {
  const D = await latestSkillDay(sql);
  const rows = await sql<{ skill: string; slug: string; open_total: number; primary_family: string | null; primary_open: number | null }[]>`
    select s.skill, s.slug, s.open_total, s.primary_family, d.open as primary_open
    from skill_summary s
    left join skill_daily d on d.date = s.date and d.skill = s.skill and d.family = s.primary_family and d.country = '*'
    where s.date = ${D} order by s.open_total desc, s.skill`;
  const changes = await changeMap(sql, D, rows.map((r) => `skillseries:${r.skill}`), '1M');
  return {
    asOf: D,
    skills: rows
      .filter((r) => r.primary_family)
      .map((r) => ({
        id: r.skill,
        slug: r.slug,
        label: skillLabel(r.skill),
        category: skillCategory(r.skill),
        domain: skillDomain(r.skill),
        open: r.open_total,
        primaryName: familyInfo(r.primary_family as string).name,
        primaryOpen: r.primary_open ?? 0,
        change: changes.get(`skillseries:${r.skill}`) ?? null,
      })),
  };
}
