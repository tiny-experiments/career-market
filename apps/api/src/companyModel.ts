import { countryName, familyInfo, skillLabel, titleCase } from '@cm/core/codes';
import {
  companySeries,
  EXPLAINER_NO_SIGNAL,
  LEVEL_ORDER,
  STACK_GROUPS,
  type CompanyDirectoryRow,
  type CompanyMover,
  type CompanyPage,
  type CompanyPeer,
  type CompanyProfileBlock,
  type CompanySignal,
  type CompanySignalState,
  type CompanyTeam,
  type CountValue,
} from '@cm/core/company';
import { addDays, FIRST_COMPARABLE_BASE, FIRST_OBSERVED_DAY, type IsoDay, type Range } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Change, Unavailable } from '@cm/core/types';
import { latestBuild, NotReadyError } from './readModel.ts';

/** Read-only queries for the Company page and the company lists. Nothing here calls krill. */

const SPARK_DAYS = 30;
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

async function changesFor(sql: Sql, asOf: IsoDay, subjects: string[], range: Range): Promise<Map<string, Change>> {
  if (subjects.length === 0) return new Map();
  const rows = await sql<ChangeRow[]>`
    select subject, range, base_date, change, partial, estimated from market_change
    where as_of = ${asOf} and range = ${range} and subject in ${sql(subjects)}`;
  return new Map(
    rows.map((r) => [r.subject, { range: r.range, value: r.change, baseDate: r.base_date, partial: r.partial, estimated: r.estimated }]),
  );
}

/** Open roles per day for each company over the sparkline window (quiet days are 0). */
async function sparks(sql: Sql, asOf: IsoDay, companyIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (companyIds.length === 0) return out;
  // Bootstrap days (2-3 Nov) are left out of sparklines like they are out of every change; 3 Nov is the base day.
  const windowStart = addDays(asOf, -(SPARK_DAYS - 1));
  const from = windowStart < FIRST_COMPARABLE_BASE ? FIRST_COMPARABLE_BASE : windowStart;
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
    for (let d = from; d <= asOf; d = addDays(d, 1)) values.push(days.get(d) ?? 0);
    out.set(id, values);
  }
  return out;
}

interface CompanyRow {
  company_id: string;
  slug: string;
  name: string;
  domain: string | null;
  careers_url: string | null;
  open: number;
  rank: number;
  profiled: boolean;
  updated_on: IsoDay;
}

/** Largest movers over one week among companies big enough to rank. */
export async function companiesRamping(sql: Sql, asOf: IsoDay, limit = 3): Promise<CompanyMover[]> {
  const rows = await sql<(CompanyRow & { change: number; base_date: IsoDay; partial: boolean; estimated: boolean })[]>`
    select c.*, m.change, m.base_date, m.partial, m.estimated
    from company c join market_change m on m.subject = 'company:' || c.company_id and m.as_of = ${asOf} and m.range = '1W'
    where c.updated_on = ${asOf} and c.open >= ${MIN_RAMPING_OPEN} and m.change > 0
      and (c.open - c.open / (1 + m.change)) >= ${MIN_RAMPING_DELTA}
    order by m.change desc limit ${limit}`;
  const spark = await sparks(sql, asOf, rows.map((r) => r.company_id));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    domain: r.domain,
    open: r.open,
    change: { range: '1W', value: r.change, baseDate: r.base_date, partial: r.partial, estimated: r.estimated },
    spark: spark.get(r.company_id) ?? [],
  }));
}

/** The largest companies, for the Companies page and the ticker. */
export async function companyDirectory(sql: Sql, limit = 50): Promise<CompanyDirectoryRow[]> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const rows = await sql<CompanyRow[]>`
    select * from company where updated_on = ${build.asOf} order by rank limit ${limit}`;
  const ids = rows.map((r) => r.company_id);
  const changes = await changesFor(sql, build.asOf, ids.map((id) => `company:${id}`), '1W');
  const spark = await sparks(sql, build.asOf, ids);
  const signals = ids.length
    ? await sql<{ company_id: string; state: CompanySignalState }[]>`
        select company_id, state from company_signal where as_of = ${build.asOf} and company_id in ${sql(ids)}`
    : [];
  const state = new Map(signals.map((s) => [s.company_id, s.state]));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    domain: r.domain,
    open: r.open,
    rank: r.rank,
    change: changes.get(`company:${r.company_id}`) ?? null,
    spark: spark.get(r.company_id) ?? [],
    state: state.get(r.company_id) ?? null,
  }));
}

/** A company's slug by krill id, for links from other read-model rows. */
export async function companySlugs(sql: Sql, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<{ company_id: string; slug: string }[]>`select company_id, slug from company where company_id in ${sql(ids)}`;
  return new Map(rows.map((r) => [r.company_id, r.slug]));
}

function levelLabel(level: string): string {
  return titleCase(level);
}

function profileBlock(
  profile: { total: number; levels: CountValue[]; skills: CountValue[]; countries: CountValue[]; work_modes: CountValue[]; median_days_open: number | null },
): CompanyProfileBlock {
  const stack = STACK_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    items: profile.skills
      .filter((s) => (g.namespaces as readonly string[]).includes(s.value.split(':')[0] ?? ''))
      .filter((s) => s.value !== 'domain:machine-learning')
      .sort((a, b) => b.count - a.count)
      .slice(0, g.max)
      .map((s) => ({ value: s.value, label: skillLabel(s.value), count: s.count })),
  }));
  // Largest level first, as the legend and the donut read; equal counts keep seniority order.
  const levels = [...profile.levels]
    .sort((a, b) => b.count - a.count || LEVEL_ORDER.indexOf(a.value as never) - LEVEL_ORDER.indexOf(b.value as never))
    .map((l) => ({ value: l.value, label: levelLabel(l.value), count: l.count }));
  return {
    total: profile.total,
    stack,
    countries: profile.countries.map((c) => ({ code: c.value, value: c.value, label: countryName(c.value), count: c.count })),
    remote: profile.work_modes.find((w) => w.value === 'remote')?.count ?? null,
    levels,
    medianDaysOpen: profile.median_days_open,
  };
}

export async function companyPage(sql: Sql, slug: string): Promise<CompanyPage | null> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;
  const [co] = await sql<CompanyRow[]>`select * from company where (slug = ${slug} or company_id = ${slug}) and updated_on = ${asOf}`;
  if (!co) return null;
  const id = co.company_id;

  const daily = await sql<{ date: IsoDay; open: number; new: number; closed: number }[]>`
    select date, open, new, closed from company_daily
    where company_id = ${id} and family = '*' and new is not null and date <= ${asOf} order by date`;
  const series = companySeries(daily, asOf);

  const [signalRow] = await sql<
    { state: CompanySignalState; window_from: IsoDay; window_days: number; opened: number; closed: number; open_base: number; partial: boolean; explainer: string }[]
  >`select state, window_from, window_days, opened, closed, open_base, partial, explainer from company_signal
    where as_of = ${asOf} and company_id = ${id}`;
  const changes = await changesFor(sql, asOf, [`company:${id}`], '1M');
  const signal: CompanySignal | null = signalRow
    ? {
        state: signalRow.state,
        windowDays: signalRow.window_days,
        windowFrom: signalRow.window_from,
        partial: signalRow.partial,
        opened: signalRow.opened,
        closed: signalRow.closed,
        ratio: signalRow.closed > 0 ? signalRow.opened / signalRow.closed : null,
        change: changes.get(`company:${id}`) ?? null,
      }
    : null;

  // Growing teams: profession slices of a profiled company.
  const famToday = await sql<{ family: string; open: number }[]>`
    select family, sum(open)::int as open from company_slice_daily
    where company_id = ${id} and date = ${asOf} group by family having sum(open) > 0 order by sum(open) desc`;
  const famChanges = await changesFor(sql, asOf, famToday.map((f) => `cfam:${id}:${f.family}`), '1M');
  const famSpark = famToday.length
    ? await sql<{ family: string; date: IsoDay; open: number }[]>`
        select family, date, sum(open)::int as open from company_slice_daily
        where company_id = ${id} and date >= ${FIRST_COMPARABLE_BASE} and date <= ${asOf} group by family, date order by date`
    : [];
  const teams: CompanyTeam[] = famToday.slice(0, 6).map((f) => ({
    family: f.family,
    name: familyInfo(f.family).name,
    open: f.open,
    change: famChanges.get(`cfam:${id}:${f.family}`) ?? null,
    spark: famSpark.filter((s) => s.family === f.family).map((s) => s.open),
  }));

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
    : { available: false, reason: 'Career Market profiles the largest companies by open roles. This company is not profiled yet.' };

  const peers = await peersOf(sql, asOf, id, co.profiled);

  return {
    asOf,
    builtAt: build.builtAt,
    company: { id, slug: co.slug, name: co.name, domain: co.domain, careersUrl: co.careers_url, open: co.open, rank: co.rank },
    profiled: co.profiled,
    signal,
    explainer: signalRow?.explainer ?? EXPLAINER_NO_SIGNAL,
    series: series.days.map((d) => ({ date: d.date, open: d.open, opened: d.new, closed: d.closed, excluded: d.excluded })),
    firstObservedDay: FIRST_OBSERVED_DAY,
    flow: signalRow ? { opened: signalRow.opened, closed: signalRow.closed, windowDays: signalRow.window_days, since: signalRow.window_from } : null,
    teams,
    profile,
    roleFilters: {
      professions: famToday.map((f) => ({ value: f.family, label: familyInfo(f.family).name, count: f.open })),
      countries: prof ? profileBlock(prof).countries.slice(0, 12) : [],
      remote: prof ? profileBlock(prof).remote : null,
    },
    peers,
  };
}

async function peersOf(sql: Sql, asOf: IsoDay, id: string, profiled: boolean): Promise<CompanyPeer[] | Unavailable> {
  if (!profiled) {
    return { available: false, reason: 'Similar companies are found among the largest companies by open roles, and this one is not profiled yet.' };
  }
  const rows = await sql<(CompanyRow & { similarity: number })[]>`
    select c.*, p.similarity from company_peer p join company c on c.company_id = p.peer_id
    where p.as_of = ${asOf} and p.company_id = ${id} and c.updated_on = ${asOf} order by p.rank`;
  if (rows.length === 0) return { available: false, reason: 'No other profiled company hires for a similar mix of roles and skills.' };
  const changes = await changesFor(sql, asOf, rows.map((r) => `company:${r.company_id}`), '1M');
  const spark = await sparks(sql, asOf, rows.map((r) => r.company_id));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    domain: r.domain,
    open: r.open,
    change: changes.get(`company:${r.company_id}`) ?? null,
    spark: spark.get(r.company_id) ?? [],
  }));
}

/** The krill company id behind a slug (for live job lists). */
export async function companyIdOf(sql: Sql, slug: string): Promise<string | null> {
  const [row] = await sql<{ company_id: string }[]>`select company_id from company where slug = ${slug} or company_id = ${slug}`;
  return row?.company_id ?? null;
}
