import { sql as ksql } from 'kysely';
import type { Database } from '../../database/client.ts';
import type { CompaniesPage, CompaniesQuery } from './domain.ts';
import {
  countryName,
  familyInfo,
  isNonTechnicalSkill,
  skillLabel,
  titleCase,
} from '@cm/core/codes';
import {
  companySeries,
  LEVEL_ORDER,
  STACK_GROUPS,
  type CompanyFacets,
  type CompanyMover,
  type CompanyPage,
  type CompanyProfileBlock,
  type CompanySignal,
  type CompanySignalState,
  type CompanySignalsOverview,
  type CompanySkillCount,
  type CompanyTeam,
  type CountValue,
} from '@cm/core/company';
import {
  addDays,
  FIRST_COMPARABLE_BASE,
  FIRST_OBSERVED_DAY,
  type IsoDay,
  type Range,
} from '@cm/core/dates';
import { fullWindow, MIN_FULL_DAYS } from '@cm/core/changes';
import { skillDomain } from '@cm/core/skills';
import type { Queries as Sql } from '../../database/client.ts';
import type { Change, Unavailable } from '@cm/core/types';
import { latestBuild, NotReadyError } from '../../database/readModel.ts';

/** Read-only queries for the Company page and the company lists. Nothing here calls krill. */

const SPARK_DAYS = 30;
/** Peers are not in v1: krill has no industry or similarity measure the captain accepted. */
const PEERS_COMING_SOON: Unavailable = {
  available: false,
  reason: 'Similar companies are not available yet.',
};

/** A company needs this many open roles to rank in "Companies ramping". */
const MIN_RAMPING_OPEN = 300;
/** ... and must have moved by at least this many roles, so a handful of postings is not a trend. */
const MIN_RAMPING_DELTA = 10;

interface ChangeRow {
  subject: string;
  range: Range;
  base_date: IsoDay;
  change: number;
  partial: boolean;
  estimated: boolean;
}

async function changesFor(
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

/** First day of a sparkline: 30 days back, never before the 3 Nov base day. */
function sparkStart(asOf: IsoDay): IsoDay {
  const windowStart = addDays(asOf, -(SPARK_DAYS - 1));
  return windowStart < FIRST_COMPARABLE_BASE
    ? FIRST_COMPARABLE_BASE
    : windowStart;
}

/** Open roles per day for each company over the sparkline window (quiet days are 0). */
async function sparks(
  sql: Sql,
  asOf: IsoDay,
  companyIds: string[],
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (companyIds.length === 0) return out;
  // Bootstrap days (2-3 Nov) are left out of sparklines like they are out of every change; 3 Nov is the base day.
  const from = sparkStart(asOf);
  const rows = await sql<{ company_id: string; date: IsoDay; open: number }[]>`
    select company_id, date, open from company_daily
    where family = '*' and new is not null and date >= ${from} and date <= ${asOf} and company_id in ${sql(companyIds)}
    order by date`;
  for (const id of companyIds) out.set(id, []);
  const byId = new Map<string, Map<IsoDay, number>>();
  for (const r of rows) {
    const m = byId.get(r.company_id) ?? new Map<IsoDay, number>();
    m.set(r.date, r.open);
    byId.set(r.company_id, m);
  }
  for (const id of companyIds) {
    const days = byId.get(id);
    if (!days) continue;
    const values: number[] = [];
    for (let d = from; d <= asOf; d = addDays(d, 1))
      values.push(days.get(d) ?? 0);
    out.set(id, values);
  }
  return out;
}

interface CompanyRow {
  company_id: string;
  slug: string;
  name: string;
  display_name: string | null;
  named: boolean | null;
  domain: string | null;
  careers_url: string | null;
  open: number;
  rank: number;
  profiled: boolean;
  updated_on: IsoDay;
}

/** Largest movers over one week among companies big enough to rank. */
export async function companiesRamping(
  sql: Sql,
  asOf: IsoDay,
  limit = 3,
): Promise<CompanyMover[]> {
  const rows = await sql<
    (CompanyRow & {
      change: number;
      base_date: IsoDay;
      partial: boolean;
      estimated: boolean;
    })[]
  >`
    select c.*, m.change, m.base_date, m.partial, m.estimated
    from company c join market_change m on m.subject = 'cpage:' || c.company_id and m.as_of = ${asOf} and m.range = '1W'
    where c.updated_on = ${asOf} and c.open >= ${MIN_RAMPING_OPEN} and m.change > 0
      and coalesce(c.named, c.domain is not null)
      and (c.open - c.open / (1 + m.change)) >= ${MIN_RAMPING_DELTA}
    order by m.change desc limit ${limit}`;
  const spark = await sparks(
    sql,
    asOf,
    rows.map((r) => r.company_id),
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: r.display_name ?? r.name,
    domain: r.domain,
    open: r.open,
    change: {
      range: '1W',
      value: r.change,
      baseDate: r.base_date,
      partial: r.partial,
      estimated: r.estimated,
    },
    spark: spark.get(r.company_id) ?? [],
  }));
}

/** A company needs this many open roles to appear among the week's biggest movers. */
const MIN_MOVER_OPEN = 100;
/** How many movers each card pages through. */
const MOVERS_PER_CARD = 15;

/** Biggest moves in one direction this week, among companies large enough and named clearly enough to show. */
async function movers(
  sql: Sql,
  asOf: IsoDay,
  direction: 'up' | 'down',
): Promise<CompanyMover[]> {
  const sign = direction === 'up' ? 1 : -1;
  const rows = await sql<
    (CompanyRow & {
      change: number;
      base_date: IsoDay;
      partial: boolean;
      estimated: boolean;
    })[]
  >`
    select c.*, m.change, m.base_date, m.partial, m.estimated
    from company c join market_change m on m.subject = 'cpage:' || c.company_id and m.as_of = ${asOf} and m.range = '1W'
    where c.updated_on = ${asOf} and c.open >= ${MIN_MOVER_OPEN} and c.domain is not null
      and coalesce(c.named, true)
      and m.change * ${sign}::int > 0 and m.base_date <= ${addDays(asOf, -MIN_FULL_DAYS['1W'])}
      and abs(c.open - c.open / (1 + m.change)) >= ${MIN_RAMPING_DELTA}
    order by m.change * ${sign}::int desc, c.company_id
    limit ${MOVERS_PER_CARD}`;
  const spark = await sparks(
    sql,
    asOf,
    rows.map((r) => r.company_id),
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: r.display_name ?? r.name,
    domain: r.domain,
    open: r.open,
    change: {
      range: '1W',
      value: r.change,
      baseDate: r.base_date,
      partial: r.partial,
      estimated: r.estimated,
    },
    spark: spark.get(r.company_id) ?? [],
  }));
}

/** The read behind the Companies page's market cards. */
export async function companySignalsOverview(
  sql: Sql,
): Promise<CompanySignalsOverview> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;
  const stateRows = await sql<{ state: CompanySignalState; n: number }[]>`
    select s.state, count(*)::int as n from company_signal s
    join company c on c.company_id = s.company_id and c.updated_on = ${asOf} and c.open > 0
    where s.as_of = ${asOf} group by s.state`;
  const counts: Record<CompanySignalState, number> = {
    RAMPING: 0,
    STEADY: 0,
    COOLING: 0,
    FREEZING: 0,
  };
  for (const row of stateRows) counts[row.state] = row.n;
  const [ramping, cooling] = await Promise.all([
    movers(sql, asOf, 'up'),
    movers(sql, asOf, 'down'),
  ]);
  return { counts, ramping, cooling };
}

interface FacetCount {
  value: string;
  count: number;
}

interface CompanyFacetRow {
  company_id: string;
  open: number;
  top_family: string | null;
  remote: number;
  stated_mode: number;
  families: FacetCount[];
  levels: FacetCount[];
  countries: FacetCount[];
  work_modes: FacetCount[];
  skills: FacetCount[];
  median_days_open: number | null;
  pay_n: number;
  pay_low: number | null;
  pay_median: number | null;
  pay_high: number | null;
}

/** Fewer roles listing pay than this and a pay range would describe a handful of postings. */
const MIN_PAY_ROLES = 5;

function remoteShareOf(row: { remote: number; stated_mode: number }): number | null {
  return row.stated_mode > 0 ? row.remote / row.stated_mode : null;
}

/** The largest companies, for the Companies page and the ticker. */
export async function companyDirectory(
  sql: Sql,
  db: Database,
  query: CompaniesQuery,
): Promise<CompaniesPage> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  let base = db
    .selectFrom('company as c')
    .leftJoin('company_signal as s', (join) =>
      join
        .onRef('s.company_id', '=', 'c.company_id')
        .on('s.as_of', '=', build.asOf),
    )
    .leftJoin('market_change as m', (join) =>
      join
        .on('m.subject', '=', ksql<string>`'cpage:' || c.company_id`)
        .on('m.as_of', '=', build.asOf)
        .on('m.range', '=', '1W')
        .on('m.base_date', '<=', addDays(build.asOf, -MIN_FULL_DAYS['1W'])),
    )
    .leftJoin('market_change as month', (join) =>
      join
        .on('month.subject', '=', ksql<string>`'cpage:' || c.company_id`)
        .on('month.as_of', '=', build.asOf)
        .on('month.range', '=', '1M')
        .on('month.base_date', '<=', addDays(build.asOf, -MIN_FULL_DAYS['1M'])),
    )
    .where('c.updated_on', '=', build.asOf)
    .where('c.open', '>', 0);
  if (query.q)
    base = base.where((eb) => {
      const pattern = `%${query.q?.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      return eb.or([
        eb('c.name', 'ilike', pattern),
        eb('c.display_name', 'ilike', pattern),
      ]);
    });
  if (query.signal)
    base = base.where('s.state', '=', query.signal.toUpperCase());
  const count = await base
    .select(ksql<number>`count(*)::int`.as('total'))
    .executeTakeFirstOrThrow();
  const order = {
    open: 'c.open',
    name: ksql`lower(coalesce(c.display_name, c.name))`,
    rank: 'c.rank',
    change1w: 'm.change',
    change30d: 'month.change',
  } as const;
  const rows = await base
    .selectAll('c')
    .orderBy(order[query.sort], (ob) =>
      (query.dir === 'asc' ? ob.asc() : ob.desc()).nullsLast(),
    )
    .orderBy('c.company_id', 'asc')
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .execute();
  const ids = rows.map((r) => r.company_id);
  const subjects = ids.map((id) => `cpage:${id}`);
  const [changes, monthChanges, spark, facetRows] = await Promise.all([
    changesFor(sql, build.asOf, subjects, '1W'),
    changesFor(sql, build.asOf, subjects, '1M'),
    sparks(sql, build.asOf, ids),
    ids.length
      ? sql<Pick<CompanyFacetRow, 'company_id' | 'top_family' | 'remote' | 'stated_mode'>[]>`
          select company_id, top_family, remote, stated_mode from company_facet where company_id in ${sql(ids)}`
      : Promise.resolve([]),
  ]);
  const facets = new Map(facetRows.map((f) => [f.company_id, f]));
  const signals = ids.length
    ? await sql<{ company_id: string; state: CompanySignalState }[]>`
        select company_id, state from company_signal where as_of = ${build.asOf} and company_id in ${sql(ids)}`
    : [];
  const state = new Map(signals.map((s) => [s.company_id, s.state]));
  const items = rows.map((r) => {
    const facet = facets.get(r.company_id);
    return {
      slug: r.slug,
      name: r.display_name ?? r.name,
      domain: r.domain,
      open: r.open,
      rank: r.rank,
      change: fullWindow(changes.get(`cpage:${r.company_id}`), build.asOf),
      change30d: fullWindow(monthChanges.get(`cpage:${r.company_id}`), build.asOf),
      spark: spark.get(r.company_id) ?? [],
      state: state.get(r.company_id) ?? null,
      topProfession: facet?.top_family
        ? {
            family: facet.top_family,
            name: familyInfo(facet.top_family).name,
          }
        : null,
      remoteShare: facet ? remoteShareOf(facet) : null,
    };
  });
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total: count.total,
  };
}

/** A company's slug by krill id, for links from other read-model rows. */
export async function companySlugs(
  sql: Sql,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<
    { company_id: string; slug: string }[]
  >`select company_id, slug from company where company_id in ${sql(ids)}`;
  return new Map(rows.map((r) => [r.company_id, r.slug]));
}

/** The latest build's skills that have a page, for linking a company's skills. */
async function trackedSkillSlugs(sql: Sql): Promise<Map<string, string>> {
  const rows = await sql<{ skill: string; slug: string }[]>`
    select distinct on (s.skill) s.skill, s.slug
    from skill_summary s
    join skill_tracked t on t.skill = s.skill and t.date = (select max(date) from skill_tracked)
    order by s.skill, s.date desc`;
  return new Map(rows.map((r) => [r.skill, r.slug]));
}

function facetsOf(row: CompanyFacetRow, slugs: Map<string, string>): CompanyFacets {
  const count = (f: FacetCount, label: string) => ({
    value: f.value,
    label,
    count: f.count,
  });
  const skills: CompanySkillCount[] = row.skills
    .filter((s) => !isNonTechnicalSkill(s.value))
    .map((s) => ({
    ...count(s, skillLabel(s.value)),
    slug: slugs.get(s.value) ?? null,
    domain: skillDomain(s.value),
  }));
  return {
    open: row.open,
    remoteShare: remoteShareOf(row),
    families: row.families.map((f) => count(f, familyInfo(f.value).name)),
    levels: row.levels.map((l) => count(l, levelLabel(l.value))),
    countries: row.countries.map((c) => ({
      ...count(c, countryName(c.value)),
      code: c.value,
    })),
    workModes: row.work_modes.map((m) => count(m, titleCase(m.value))),
    skills,
    medianDaysOpen: row.median_days_open,
    pay:
      row.pay_n >= MIN_PAY_ROLES &&
      row.pay_low !== null &&
      row.pay_median !== null &&
      row.pay_high !== null
        ? {
            roles: row.pay_n,
            low: row.pay_low,
            median: row.pay_median,
            high: row.pay_high,
          }
        : null,
  };
}

function levelLabel(level: string): string {
  return titleCase(level);
}

function profileBlock(profile: {
  total: number;
  levels: CountValue[];
  skills: CountValue[];
  countries: CountValue[];
  work_modes: CountValue[];
  median_days_open: number | null;
}): CompanyProfileBlock {
  const stack = STACK_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    items: profile.skills
      .filter((s) => !isNonTechnicalSkill(s.value))
      .filter((s) =>
        (g.namespaces as readonly string[]).includes(
          s.value.split(':')[0] ?? '',
        ),
      )
      .filter((s) => s.value !== 'domain:machine-learning')
      .sort((a, b) => b.count - a.count)
      .slice(0, g.max)
      .map((s) => ({
        value: s.value,
        label: skillLabel(s.value),
        count: s.count,
      })),
  }));
  // Largest level first, as the legend and the donut read; equal counts keep seniority order.
  const levels = [...profile.levels]
    .sort(
      (a, b) =>
        b.count - a.count ||
        LEVEL_ORDER.indexOf(a.value as never) -
          LEVEL_ORDER.indexOf(b.value as never),
    )
    .map((l) => ({
      value: l.value,
      label: levelLabel(l.value),
      count: l.count,
    }));
  return {
    total: profile.total,
    stack,
    countries: profile.countries.map((c) => ({
      code: c.value,
      value: c.value,
      label: countryName(c.value),
      count: c.count,
    })),
    remote: profile.work_modes.find((w) => w.value === 'remote')?.count ?? null,
    levels,
    medianDaysOpen: profile.median_days_open,
  };
}

export async function companyPage(
  sql: Sql,
  slug: string,
): Promise<CompanyPage | null> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;
  const [co] = await sql<
    CompanyRow[]
  >`select * from company where (slug = ${slug} or company_id = ${slug}) and updated_on = ${asOf}`;
  if (!co) return null;
  const id = co.company_id;

  const daily = await sql<
    { date: IsoDay; open: number; new: number; closed: number }[]
  >`
    select date, open, new, closed from company_daily
    where company_id = ${id} and family = '*' and new is not null and date <= ${asOf} order by date`;
  const series = companySeries(daily, asOf);
  const lastDay = series.days.at(-1);
  const unclearOn = lastDay?.boardChange ? lastDay.date : null;

  const [signalRow] = await sql<
    {
      state: CompanySignalState;
      window_from: IsoDay;
      window_days: number;
      opened: number;
      closed: number;
      open_base: number;
      partial: boolean;
      explainer: string;
    }[]
  >`select state, window_from, window_days, opened, closed, open_base, partial, explainer from company_signal
    where as_of = ${asOf} and company_id = ${id}`;
  const [changes, weekChanges, facetRows, skillSlugs] = await Promise.all([
    changesFor(sql, asOf, [`cpage:${id}`], '1M'),
    changesFor(sql, asOf, [`cpage:${id}`], '1W'),
    sql<CompanyFacetRow[]>`select * from company_facet where company_id = ${id}`,
    trackedSkillSlugs(sql),
  ]);
  const signal: CompanySignal | null = signalRow
    ? {
        state: signalRow.state,
        windowDays: signalRow.window_days,
        windowFrom: signalRow.window_from,
        partial: signalRow.partial,
        opened: signalRow.opened,
        closed: signalRow.closed,
        ratio:
          signalRow.closed > 0 ? signalRow.opened / signalRow.closed : null,
        change: changes.get(`cpage:${id}`) ?? null,
      }
    : null;

  // Growing teams: profession slices of a profiled company.
  const famToday = await sql<{ family: string; open: number }[]>`
    select family, sum(open)::int as open from company_slice_daily
    where company_id = ${id} and date = ${asOf} group by family having sum(open) > 0 order by sum(open) desc`;
  const famChanges = await changesFor(
    sql,
    asOf,
    famToday.map((f) => `cfam:${id}:${f.family}`),
    '1M',
  );
  const sparkFrom = sparkStart(asOf);
  const famSpark = famToday.length
    ? await sql<{ family: string; date: IsoDay; open: number }[]>`
        select family, date, sum(open)::int as open from company_slice_daily
        where company_id = ${id} and date >= ${sparkFrom} and date <= ${asOf} group by family, date`
    : [];
  const teams: CompanyTeam[] = famToday.slice(0, 6).map((f) => {
    const days = new Map(
      famSpark
        .filter((s) => s.family === f.family)
        .map((s) => [s.date, s.open]),
    );
    const spark: number[] = [];
    for (let d = sparkFrom; d <= asOf; d = addDays(d, 1))
      spark.push(days.get(d) ?? 0);
    return {
      family: f.family,
      name: familyInfo(f.family).name,
      open: f.open,
      change: famChanges.get(`cfam:${id}:${f.family}`) ?? null,
      spark,
    };
  });

  const [prof] = await sql<
    {
      total: number;
      levels: CountValue[];
      skills: CountValue[];
      countries: CountValue[];
      work_modes: CountValue[];
      median_days_open: number | null;
    }[]
  >`select total, levels, skills, countries, work_modes, median_days_open from company_profile
    where as_of = ${asOf} and company_id = ${id}`;
  const profile: CompanyProfileBlock | Unavailable = prof
    ? profileBlock(prof)
    : {
        available: false,
        reason:
          'Career Market profiles the largest companies by open roles. This company is not profiled yet.',
      };

  return {
    asOf,
    builtAt: build.builtAt,
    company: {
      id,
      slug: co.slug,
      name: co.display_name ?? co.name,
      domain: co.domain,
      careersUrl: co.careers_url,
      open: co.open,
      rank: co.rank,
    },
    profiled: co.profiled,
    signal,
    explainer: signalRow
      ? {
          RAMPING: 'Openings are growing faster than closures.',
          STEADY: 'Hiring is holding steady.',
          COOLING: 'Closures are outpacing new openings.',
          FREEZING: 'Few new openings are replacing closed roles.',
        }[signalRow.state]
      : 'Hiring trends are not available yet.',
    unclearOn,
    series: series.days.map((d) => ({
      date: d.date,
      open: d.open,
      opened: d.new,
      closed: d.closed,
      excluded: d.excluded,
      boardChange: d.boardChange,
    })),
    firstObservedDay: FIRST_OBSERVED_DAY,
    flow: signalRow
      ? {
          opened: signalRow.opened,
          closed: signalRow.closed,
          windowDays: signalRow.window_days,
          since: signalRow.window_from,
        }
      : null,
    teams,
    profile,
    roleFilters: {
      professions: famToday.map((f) => ({
        value: f.family,
        label: familyInfo(f.family).name,
        count: f.open,
      })),
      countries: prof ? profileBlock(prof).countries.slice(0, 12) : [],
      remote: prof ? profileBlock(prof).remote : null,
    },
    peers: PEERS_COMING_SOON,
    change7d: fullWindow(weekChanges.get(`cpage:${id}`), asOf),
    change30d: fullWindow(changes.get(`cpage:${id}`), asOf),
    facets: facetRows[0] ? facetsOf(facetRows[0], skillSlugs) : null,
  };
}

/** The krill company id behind a slug (for live job lists). */
export async function companyIdOf(
  sql: Sql,
  slug: string,
): Promise<string | null> {
  const [row] = await sql<
    { company_id: string }[]
  >`select company_id from company where (slug = ${slug} or company_id = ${slug}) and updated_on = (select max(snapshot_date) from build_run where status = 'ok')`;
  return row?.company_id ?? null;
}
