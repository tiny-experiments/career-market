import {
  familyInfo,
  isNonTechnicalSkill,
  NON_TECHNICAL_SKILLS,
  isTileSkill,
  skillLabel,
} from '@cm/core/codes';
import { fullWindow } from '@cm/core/changes';
import { addDays, daysBetween, type IsoDay, type Range } from '@cm/core/dates';
import type { Queries as Sql } from '../../database/client.ts';
import {
  skillCategory,
  skillDomain,
  type SkillCompanyRow,
  type SkillIndexPayload,
  type SkillPay,
  type SkillPagePayload,
  type SkillPairRow,
  type SkillPeer,
  type SkillProfessionRow,
  type SkillRoleRow,
  type SkillSalaryEffect,
} from '@cm/core/skills';
import type { Change, Unavailable } from '@cm/core/types';
import { latestBuild, NotReadyError } from '../../database/readModel.ts';

/** Read-only queries behind the Skill page. Nothing here calls krill. */

const PROFESSION_ROWS = 4;
const COMPANY_ROWS = 5;
const PAIR_ROWS = 6;
/** Days in a skill's sparkline. */
const SPARK_DAYS = 30;
/** Fewer roles listing pay than this and a pay range would describe a handful of postings. */
const MIN_PAY_ROLES = 5;

interface SkillFacetRow {
  skill: string;
  remote: number;
  stated_mode: number;
  pay_n: number;
  pay_low: number | null;
  pay_median: number | null;
  pay_high: number | null;
}

function remoteShareOf(row: SkillFacetRow | undefined): number | null {
  return row && row.stated_mode > 0 ? row.remote / row.stated_mode : null;
}

function payOf(row: SkillFacetRow | undefined): SkillPay | null {
  if (
    !row ||
    row.pay_n < MIN_PAY_ROLES ||
    row.pay_low === null ||
    row.pay_median === null ||
    row.pay_high === null
  )
    return null;
  return {
    roles: row.pay_n,
    low: row.pay_low,
    median: row.pay_median,
    high: row.pay_high,
  };
}

/** Each side of the salary comparison needs this many priced roles (builder: MIN_SALARY_SIDE). */
const MIN_SALARY_SIDE = 50;
interface SummaryRow {
  date: IsoDay;
  skill: string;
  slug: string;
  open_total: number;
  primary_family: string | null;
}

/** The latest build's tracked set. A skill is served only while it is in it, from its own latest summary day. */
async function latestSkillDay(sql: Sql): Promise<IsoDay> {
  const [row] = await sql<
    { date: IsoDay | null }[]
  >`select max(date) as date from skill_tracked`;
  if (!row?.date) throw new NotReadyError();
  return row.date;
}

async function changeMap(
  sql: Sql,
  asOf: IsoDay,
  subjects: string[],
  range: Range,
): Promise<Map<string, Change>> {
  if (subjects.length === 0) return new Map();
  const rows = await sql<
    {
      subject: string;
      range: Range;
      base_date: IsoDay;
      change: number;
      partial: boolean;
      estimated: boolean;
    }[]
  >`
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

/** The page of one skill, found by its URL slug (or its bare name); null when no tracked skill matches. */
export async function skillPage(
  sql: Sql,
  slug: string,
): Promise<SkillPagePayload | null> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const latest = await latestSkillDay(sql);

  const [row] = await sql<SummaryRow[]>`
    select s.date, s.skill, s.slug, s.open_total, s.primary_family
    from skill_summary s join skill_tracked t on t.skill = s.skill and t.date = ${latest}
    where s.slug = ${slug} or split_part(s.skill, ':', 2) = ${slug}
    order by (s.slug = ${slug}) desc, s.date desc, s.open_total desc limit 1`;
  if (!row || !row.primary_family || isNonTechnicalSkill(row.skill))
    return null;
  const D = row.date;
  const id = row.skill;
  const family = row.primary_family;
  const info = familyInfo(family);

  // Roles naming the skill per profession (krill's per-profession skill facets).
  const perFamily = await sql<{ family: string; open: number }[]>`
    select family, open from skill_daily where date = ${D} and skill = ${id} and country = '*' order by open desc`;
  const primaryOpen = perFamily.find((f) => f.family === family)?.open ?? 0;
  const [fam] = await sql<
    { open: number }[]
  >`select open from family_daily where date = ${D} and family = ${family}`;
  const familyOpen = fam?.open ?? 0;

  const change =
    (await changeMap(sql, D, [`skillseries:${id}`], '1M')).get(
      `skillseries:${id}`,
    ) ?? null;
  const change7d =
    fullWindow(
      (await changeMap(sql, D, [`skillseries:${id}`], '1W')).get(
        `skillseries:${id}`,
      ),
      D,
    );
  const [facet] = await sql<SkillFacetRow[]>`
    select skill, remote, stated_mode, pay_n, pay_low, pay_median, pay_high from skill_facet where skill = ${id}`;
  const [standing] = await sql<{ rank: number }[]>`
    select rank from (
      select distinct on (s.skill) s.skill, s.open_total
      from skill_summary s join skill_tracked t on t.skill = s.skill and t.date = ${latest}
      order by s.skill, s.date desc
    ) latest
    cross join lateral (
      select count(*)::int + 1 as rank from (
        select distinct on (o.skill) o.open_total
        from skill_summary o join skill_tracked ot on ot.skill = o.skill and ot.date = ${latest}
        order by o.skill, o.date desc
      ) others where others.open_total > latest.open_total
    ) r
    where latest.skill = ${id}`;

  const series = await sql<
    { date: IsoDay; open: number; estimated: boolean }[]
  >`
    select date, open, estimated from skill_series where skill = ${id} and family = ${family} and date <= ${D} order by date`;
  const firstObservedDay = series.find((p) => !p.estimated)?.date ?? D;

  // Names the skill's slug when it has a page of its own.
  const slugRows = await sql<{ skill: string; slug: string }[]>`
    select distinct on (s.skill) s.skill, s.slug
    from skill_summary s join skill_tracked t on t.skill = s.skill and t.date = ${latest}
    order by s.skill, s.date desc`;
  const slugOf = new Map(slugRows.map((r) => [r.skill, r.slug]));

  // Peers: the largest other skills of the same kind (PyTorch: TensorFlow, JAX) in the same profession.
  const peerCandidates = await sql<{ skill: string; open: number }[]>`
    select skill, open from skill_daily
    where date = ${D} and family = ${family} and country = '*' and skill <> ${id}
    order by open desc limit 400`;
  const kind = skillCategory(id);
  const peerRows = peerCandidates.filter(
    (p) => skillCategory(p.skill) === kind && isTileSkill(p.skill),
  );
  const peers: SkillPeer[] = [
    {
      id,
      slug: row.slug,
      label: skillLabel(id),
      domain: skillDomain(id),
      open: primaryOpen,
      self: true,
    },
    ...peerRows
      .slice(0, 2)
      .map((p) => ({
        id: p.skill,
        slug: slugOf.get(p.skill) ?? null,
        label: skillLabel(p.skill),
        domain: skillDomain(p.skill),
        open: p.open,
        self: false,
      })),
  ].sort((a, b) => b.open - a.open);

  const allNamed = perFamily.reduce((n, f) => n + f.open, 0) || row.open_total;
  const professions: SkillProfessionRow[] = perFamily
    .slice(0, PROFESSION_ROWS)
    .map((f) => {
      const fi = familyInfo(f.family);
      return {
        family: f.family,
        code: fi.code,
        name: fi.name,
        open: f.open,
        share: f.open / allNamed,
      };
    });

  const companyRows = await sql<
    {
      company_id: string;
      open: number;
      name: string | null;
      domain: string | null;
      slug: string | null;
    }[]
  >`
    select d.company_id, d.open, r.name, coalesce(r.domain, c.domain) as domain, c.slug from skill_company_daily d
    left join company_ref r on r.company_id = d.company_id
    left join company c on c.company_id = d.company_id
    where d.date = ${D} and d.skill = ${id} order by d.open desc, d.company_id limit ${COMPANY_ROWS}`;
  const companyChanges = await changeMap(
    sql,
    D,
    companyRows.map((c) => `skillco:${id}:${c.company_id}`),
    '1M',
  );
  const companies: SkillCompanyRow[] = companyRows.map((c) => ({
    id: c.company_id,
    slug: c.slug,
    name: c.name ?? c.company_id,
    domain: c.domain,
    open: c.open,
    change: fullWindow(companyChanges.get(`skillco:${id}:${c.company_id}`), D),
  }));

  const pairRows = await sql<{ other: string; open: number }[]>`
    select other, open from skill_pair_daily where date = ${D} and skill = ${id} order by open desc limit 40`;
  const shownPairs = pairRows
    .filter((p) => isTileSkill(p.other))
    .slice(0, PAIR_ROWS);
  const pairChanges = await changeMap(
    sql,
    D,
    shownPairs.map((p) => `skillpair:${id}:${p.other}`),
    '1M',
  );
  const pairs: SkillPairRow[] = shownPairs.map((p) => ({
    id: p.other,
    slug: slugOf.get(p.other) ?? null,
    label: skillLabel(p.other),
    domain: skillDomain(p.other),
    open: p.open,
    share: row.open_total > 0 ? p.open / row.open_total : 0,
    change: fullWindow(pairChanges.get(`skillpair:${id}:${p.other}`), D),
  }));

  const [fx] = await sql<
    {
      family: string;
      currency: string;
      n_with: number;
      n_without: number;
      median_with: number | null;
      median_without: number | null;
      sample_size: number;
    }[]
  >`select family, currency, n_with, n_without, median_with, median_without, sample_size from skill_salary_effect where skill = ${id} and date = ${D} limit 1`;
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
    where l.skill = ${id} and l.date = ${D} order by l.rank`;
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
    stale: D < latest,
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
    series: series.map((p) => ({
      date: p.date,
      open: p.open,
      estimated: p.estimated,
    })),
    firstObservedDay,
    seriesNote: 'Open roles naming this skill over time.',
    peers,
    professions,
    companies,
    pairs,
    salaryEffect,
    latestRoles,
    change7d,
    rank: standing?.rank ?? null,
    remoteShare: remoteShareOf(facet),
    pay: payOf(facet),
  };
}

function salaryEffectOf(
  fx:
    | {
        family: string;
        currency: string;
        n_with: number;
        n_without: number;
        median_with: number | null;
        median_without: number | null;
        sample_size: number;
      }
    | undefined,
): SkillSalaryEffect | Unavailable {
  if (!fx)
    return {
      available: false,
      reason: 'Pay comparisons are not available yet.',
    };
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
  const tracked = await sql<
    {
      skill: string;
      slug: string;
      date: IsoDay;
      open_total: number;
      primary_family: string | null;
      primary_open: number | null;
      base_date: IsoDay | null;
      change: number | null;
      partial: boolean | null;
      estimated: boolean | null;
    }[]
  >`
    select * from (
      select distinct on (s.skill) s.skill, s.slug, s.date, s.open_total, s.primary_family, d.open as primary_open,
        c.base_date, c.change, c.partial, c.estimated
      from skill_summary s
      join skill_tracked t on t.skill = s.skill and t.date = ${D}
      left join skill_daily d on d.date = s.date and d.skill = s.skill and d.family = s.primary_family and d.country = '*'
      left join market_change c on c.as_of = s.date and c.subject = 'skillseries:' || s.skill and c.range = '1M'
      order by s.skill, s.date desc
    ) latest
    order by open_total desc, skill`;
  const rows = tracked.filter((r) => !isNonTechnicalSkill(r.skill));
  const subjects = rows.map((r) => `skillseries:${r.skill}`);
  const ids = rows.map((r) => r.skill);
  const sparkFrom = addDays(D, -(SPARK_DAYS - 1));
  const [weekRows, facetRows, sparkRows, effectRows, pairRows] = ids.length
    ? await Promise.all([
        sql<(Change & { subject: string; as_of: IsoDay })[]>`
          select distinct on (subject) subject, as_of, range, base_date as "baseDate", change as value, partial, estimated
          from market_change where range = '1W' and subject in ${sql(subjects)} and as_of <= ${D}
          order by subject, as_of desc`,
        sql<SkillFacetRow[]>`
          select skill, remote, stated_mode, pay_n, pay_low, pay_median, pay_high from skill_facet where skill in ${sql(ids)}`,
        sql<{ skill: string; date: IsoDay; open: number }[]>`
          select p.skill, p.date, p.open from skill_series p
          join skill_summary s on s.skill = p.skill and s.primary_family = p.family
            and s.date = (select max(date) from skill_summary where skill = p.skill)
          where p.skill in ${sql(ids)} and p.date >= ${sparkFrom} and p.date <= ${D}
          order by p.date`,
        sql<{ skill: string; median_with: number; median_without: number }[]>`
          select distinct on (skill) skill, median_with, median_without from skill_salary_effect
          where skill in ${sql(ids)} and median_with is not null and median_without is not null
          order by skill, date desc`,
        sql<{ skill: string; other: string; open: number }[]>`
          select distinct on (skill) skill, other, open from skill_pair_daily
          where date = ${D} and skill in ${sql(ids)}
            and other not in ${sql([...NON_TECHNICAL_SKILLS])}
          order by skill, open desc, other`,
      ])
    : [[], [], [], [], []];
  const week = new Map(weekRows.map((r) => [r.subject, r]));
  const facets = new Map(facetRows.map((f) => [f.skill, f]));
  const spark = new Map<string, number[]>();
  for (const point of sparkRows)
    spark.set(point.skill, [...(spark.get(point.skill) ?? []), point.open]);
  const effects = new Map(effectRows.map((e) => [e.skill, e]));
  const pairs = new Map(pairRows.map((p) => [p.skill, p]));
  const slugOf = new Map(rows.map((r) => [r.skill, r.slug]));
  const indexExtras = (skill: string) => {
    const weekChange = week.get(`skillseries:${skill}`);
    const effect = effects.get(skill);
    const pair = pairs.get(skill);
    const open = rows.find((r) => r.skill === skill)?.open_total ?? 0;
    return {
      change7d: fullWindow(
        weekChange
          ? {
              range: '1W' as const,
              value: weekChange.value,
              baseDate: weekChange.baseDate,
              partial: weekChange.partial,
              estimated: weekChange.estimated,
            }
          : null,
        D,
      ),
      spark: spark.get(skill) ?? [],
      remoteShare: remoteShareOf(facets.get(skill)),
      pay: payOf(facets.get(skill)),
      payEffect: effect ? effect.median_with - effect.median_without : null,
      topPair:
        pair && open > 0
          ? {
              id: pair.other,
              slug: slugOf.get(pair.other) ?? null,
              label: skillLabel(pair.other),
              domain: skillDomain(pair.other),
              share: pair.open / open,
            }
          : null,
    };
  };
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
        asOf: r.date,
        primaryName: familyInfo(r.primary_family as string).name,
        primaryOpen: r.primary_open ?? 0,
        change:
          r.base_date !== null && r.change !== null
            ? {
                range: '1M' as const,
                value: r.change,
                baseDate: r.base_date,
                partial: !!r.partial,
                estimated: !!r.estimated,
              }
            : null,
        ...indexExtras(r.skill),
      })),
  };
}
