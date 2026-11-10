import {
  countryName,
  familyInfo,
  FAMILIES,
  NON_TECHNICAL_SKILLS,
  skillLabel,
} from '@cm/core/codes';
import {
  addDays,
  daysBetween,
  FIRST_COMPARABLE_BASE,
  FIRST_OBSERVED_DAY,
  isBootstrapDay,
  type IsoDay,
} from '@cm/core/dates';
import { skillSlug } from '@cm/core/screener';
import type { Queries as Sql } from '../../database/client.ts';
import {
  familyByCode,
  levelLabel,
  PROFESSION_REGIONS,
  professionLongName,
  specialtyLabel,
  type CompanySignal,
  type ProfessionCompanyRow,
  type ProfessionIndex,
  type ProfessionPage,
  type ProfessionRegionId,
} from '@cm/core/professions';
import type { Change } from '@cm/core/types';
import {
  changes,
  latestBuild,
  NotReadyError,
} from '../../database/readModel.ts';

import { NotFoundError } from '../../http/projectionErrors.ts';

const SPARK_DAYS = 30;
const TOP_COUNTRIES = 7;
const TOP_SKILLS = 10;
const TOP_COMPANIES = 6;
const LATEST_ROLES = 8;
const WEEK_DAYS = 7;

/** The newest comparable day at most a week back: the first days counted everything as new. */
function weekBase(asOf: IsoDay): IsoDay {
  const week = addDays(asOf, -WEEK_DAYS);
  return week < FIRST_COMPARABLE_BASE ? FIRST_COMPARABLE_BASE : week;
}

interface DayRow {
  date: IsoDay;
  family: string;
  index_value: number;
}

/** Like-for-like change against the day before, by family; a bootstrap day has no comparison. */
function dayChanges(rows: readonly DayRow[], asOf: IsoDay) {
  const out = new Map<string, number | null>();
  const days = [...new Set(rows.map((r) => r.date))].sort();
  const previous = days.filter((d) => d < asOf).at(-1);
  if (!previous || isBootstrapDay(previous)) return out;
  const before = new Map(
    rows.filter((r) => r.date === previous).map((r) => [r.family, r.index_value]),
  );
  for (const r of rows) {
    if (r.date !== asOf) continue;
    const base = before.get(r.family);
    out.set(r.family, base ? r.index_value / base - 1 : null);
  }
  return out;
}

/** One profession (a krill family) for the Profession page. Reads the read model only. */
export async function professionPage(
  sql: Sql,
  code: string,
): Promise<ProfessionPage> {
  const family = familyByCode(code);
  if (!family) throw new NotFoundError(`no profession with code ${code}`);
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;
  const info = familyInfo(family);

  const observed = await sql<
    {
      date: IsoDay;
      open: number;
      opened: number;
      closed: number;
      index_value: number;
    }[]
  >`
    select date, open, opened, closed, index_value from family_daily
    where family = ${family} and date <= ${asOf} order by date`;
  const today = observed.find((r) => r.date === asOf);
  if (!today)
    throw new NotFoundError(`profession ${code} has no data for ${asOf}`);
  const estimated = await sql<
    { date: IsoDay; open: number; opened: number; closed: number }[]
  >`
    select date, open, opened, closed from family_estimate_daily where family = ${family} order by date`;

  const series = [
    ...estimated.map((r) => ({
      date: r.date,
      open: r.open,
      new: r.opened,
      closed: r.closed,
      estimated: true,
      bootstrap: false,
    })),
    ...observed.map((r) => ({
      date: r.date,
      open: Math.round((today.open * r.index_value) / today.index_value),
      new: r.opened,
      closed: r.closed,
      estimated: false,
      bootstrap: isBootstrapDay(r.date),
    })),
  ];
  const hasEstimate = estimated.length > 0;

  const subject = `family:${family}`;
  const [c1w, c1m, c3m] = await Promise.all(
    (['1W', '1M', '3M'] as const).map((r) => changes(sql, asOf, [subject], r)),
  );
  const change1d = dayChanges(
    observed.slice(-2).map((r) => ({
      date: r.date,
      family,
      index_value: r.index_value,
    })),
    asOf,
  ).get(family);

  const specialties = await sql<{ specialty: string; open: number }[]>`
    select specialty, sum(open)::int as open from profession_daily
    where date = ${asOf} and family = ${family} and specialty <> '' group by specialty order by open desc`;
  const levels = await sql<{ level: string; open: number }[]>`
    select level, sum(open)::int as open from profession_daily
    where date = ${asOf} and family = ${family} group by level order by open desc`;
  const countries = await sql<{ country: string; open: number }[]>`
    select country, sum(open)::int as open from profession_daily
    where date = ${asOf} and family = ${family} group by country order by open desc`;
  const [snap] = await sql<
    {
      companies: number | null;
      median_days_open: number | null;
      remote: number | null;
      hybrid: number | null;
      onsite: number | null;
      work_mode_total: number | null;
      salary_n: number | null;
      salary_p25: number | null;
      salary_p50: number | null;
      salary_p75: number | null;
      salary_currency: string | null;
      salary_scope: string | null;
    }[]
  >`select companies, median_days_open, remote, hybrid, onsite, work_mode_total, salary_n, salary_p25, salary_p50,
           salary_p75, salary_currency, salary_scope
    from profession_snapshot where date = ${asOf} and family = ${family}`;
  const companyRows = await sql<
    {
      rank: number;
      company_id: string;
      name: string;
      domain: string | null;
      open: number;
      base_date: IsoDay | null;
      change: number | null;
      coverage_jump: boolean;
      partial: boolean;
      signal: CompanySignal | null;
    }[]
  >`select rank, company_id, name, domain, open, base_date, change, coverage_jump, partial, signal from profession_company
    where date = ${asOf} and family = ${family} order by rank limit ${TOP_COMPANIES}`;
  const companyIds = companyRows.map((c) => c.company_id).concat(['']);
  const companyRefs = await sql<{ company_id: string; slug: string }[]>`
    select company_id, slug from company where company_id in ${sql(companyIds)}`;
  const slugOf = new Map(companyRefs.map((c) => [c.company_id, c.slug]));
  const companyStates = await sql<
    { company_id: string; state: ProfessionCompanyRow['state'] }[]
  >`select company_id, state from company_signal
    where as_of = ${asOf} and company_id in ${sql(companyIds)}`;
  const stateOf = new Map(companyStates.map((c) => [c.company_id, c.state]));
  const skills = await sql<{ skill: string; open: number }[]>`
    select skill, open from skill_daily
    where date = ${asOf} and family = ${family} and country = '*'
      and skill not in ${sql([...NON_TECHNICAL_SKILLS])}
    order by open desc limit ${TOP_SKILLS}`;
  const skillBase = weekBase(asOf);
  const skillBaseRows = await sql<{ skill: string; open: number }[]>`
    select skill, open from skill_daily
    where date = ${skillBase} and family = ${family} and country = '*'
      and skill in ${sql(skills.map((s) => s.skill).concat(['']))}`;
  const baseOpen = new Map(skillBaseRows.map((s) => [s.skill, s.open]));
  const familyBaseOpen = observed.find((r) => r.date === skillBase)?.open ?? 0;
  const skillChange = (skill: string, open: number): number | null => {
    const base = baseOpen.get(skill);
    if (!base || !familyBaseOpen || !today.open) return null;
    return open / today.open / (base / familyBaseOpen) - 1;
  };
  const roles = await sql<
    {
      job_id: string;
      title: string;
      company_id: string | null;
      company_name: string;
      company_domain: string | null;
      location: string | null;
      work_mode: string | null;
      salary_text: string | null;
      opened_on: IsoDay;
    }[]
  >`select job_id, title, company_id, company_name, company_domain, location, work_mode, salary_text, opened_on
    from profession_latest_role where date = ${asOf} and family = ${family} order by rank limit ${LATEST_ROLES}`;

  const totalOpen = today.open;
  const located = countries.filter((c) => c.country !== '');
  const statedLevels = levels.filter((l) => l.level !== '');
  const statedTotal = statedLevels.reduce((n, l) => n + l.open, 0);
  const modes =
    snap && snap.remote !== null
      ? {
          remote: snap.remote,
          hybrid: snap.hybrid ?? 0,
          onsite: snap.onsite ?? 0,
        }
      : null;

  return {
    asOf,
    builtAt: build.builtAt,
    family,
    code: info.code,
    name: info.name,
    longName: professionLongName(family),
    open: totalOpen,
    changes: {
      '1W': c1w?.get(subject) ?? null,
      '1M': c1m?.get(subject) ?? null,
      '3M': c3m?.get(subject) ?? null,
    },
    change1d: change1d ?? null,
    specialties: specialties.map((s) => ({
      id: s.specialty,
      label: specialtyLabel(s.specialty),
      open: s.open,
    })),
    series,
    firstObservedDay: FIRST_OBSERVED_DAY,
    backcast: {
      available: hasEstimate,
      note: 'Open roles in this profession over time.',
    },
    salary:
      snap &&
      snap.salary_p25 !== null &&
      snap.salary_p75 !== null &&
      snap.salary_p50 !== null
        ? {
            available: true,
            p25: snap.salary_p25,
            p50: snap.salary_p50,
            p75: snap.salary_p75,
            n: snap.salary_n ?? 0,
            currency: snap.salary_currency ?? 'USD',
            scope: snap.salary_scope ?? 'US, senior',
          }
        : {
            available: false,
            reason:
              'Fewer than 30 senior US roles in this profession list their pay.',
            n: snap?.salary_n ?? null,
          },
    workMode: modes
      ? {
          ...modes,
          notStated: Math.max(
            0,
            (snap?.work_mode_total ?? totalOpen) -
              modes.remote -
              modes.hybrid -
              modes.onsite,
          ),
        }
      : null,
    medianDaysOpen: snap?.median_days_open ?? null,
    companiesHiring: snap?.companies ?? null,
    seniority: statedLevels.map((l) => ({
      id: l.level,
      label: levelLabel(l.level),
      open: l.open,
      share: statedTotal ? l.open / statedTotal : 0,
    })),
    seniorityNotStated: levels
      .filter((l) => l.level === '')
      .reduce((n, l) => n + l.open, 0),
    countries: located.slice(0, TOP_COUNTRIES).map((c) => ({
      code: c.country,
      name: countryName(c.country),
      open: c.open,
      share: totalOpen ? c.open / totalOpen : 0,
    })),
    countriesNotLocated: countries
      .filter((c) => c.country === '')
      .reduce((n, c) => n + c.open, 0),
    topCompanies: companyRows.length
      ? companyRows.map((c) => ({
          rank: c.rank,
          id: c.company_id,
          slug: slugOf.get(c.company_id) ?? null,
          name: c.name,
          domain: c.domain,
          open: c.open,
          change:
            c.change !== null && c.base_date
              ? ({
                  range: '1W',
                  value: c.change,
                  baseDate: c.base_date,
                  partial: c.partial,
                  estimated: false,
                } satisfies Change)
              : null,
          coverageJump: c.coverage_jump,
          signal: c.signal,
          state: stateOf.get(c.company_id) ?? null,
        }))
      : {
          available: false,
          reason:
            'Company hiring trends are not available for this profession yet.',
        },
    skills: skills.map((s) => ({
      id: s.skill,
      slug: skillSlug(s.skill),
      label: skillLabel(s.skill),
      open: s.open,
      share: totalOpen ? s.open / totalOpen : 0,
      change: skillChange(s.skill, s.open),
    })),
    latestRoles: roles.map((r) => ({
      id: r.job_id,
      title: r.title,
      companyId: r.company_id,
      company: r.company_name,
      companyDomain: r.company_domain,
      location: r.location,
      workMode: r.work_mode,
      salary: r.salary_text,
      openedOn: r.opened_on,
      ageDays: Math.max(0, daysBetween(r.opened_on, asOf)),
    })),
  };
}

/** Every profession with its open roles, changes, pay and trend (the /professions list). */
export async function professionIndex(
  sql: Sql,
  region: ProfessionRegionId | null = null,
): Promise<ProfessionIndex> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;
  const sparkFrom = addDays(asOf, -(SPARK_DAYS - 1));
  const weekFrom = addDays(asOf, -(WEEK_DAYS - 1));
  const days = await sql<
    (DayRow & { open: number; opened: number })[]
  >`select date, family, open, opened, index_value from family_daily
    where date >= ${sparkFrom} and date <= ${asOf} order by date`;
  const rows = days.filter((d) => d.date === asOf);
  const subjects = rows.map((r) => `family:${r.family}`);
  const [week, month, snapshots] = await Promise.all([
    changes(sql, asOf, subjects, '1W'),
    changes(sql, asOf, subjects, '1M'),
    sql<
      {
        family: string;
        companies: number | null;
        remote: number | null;
        hybrid: number | null;
        onsite: number | null;
        salary_p25: number | null;
        salary_p50: number | null;
        salary_p75: number | null;
      }[]
    >`select family, companies, remote, hybrid, onsite, salary_p25, salary_p50, salary_p75
      from profession_snapshot where date = ${asOf}`,
  ]);
  const snapshot = new Map(snapshots.map((s) => [s.family, s]));
  const scope = region
    ? await regionalScope(sql, asOf, sparkFrom, region)
    : null;
  const oneDay = dayChanges(days, asOf);
  const order = new Map(FAMILIES.map((f, i) => [f.id, i]));
  const isNewDay = (date: IsoDay) => date >= weekFrom && !isBootstrapDay(date);

  return {
    asOf,
    builtAt: build.builtAt,
    region,
    rows: rows
      .map((r) => {
        const info = familyInfo(r.family);
        const snap = snapshot.get(r.family);
        const history = days.filter((d) => d.family === r.family);
        const stated = snap
          ? (snap.remote ?? 0) + (snap.hybrid ?? 0) + (snap.onsite ?? 0)
          : 0;
        const pay =
          snap?.salary_p25 != null &&
          snap.salary_p50 != null &&
          snap.salary_p75 != null
            ? {
                low: snap.salary_p25,
                median: snap.salary_p50,
                high: snap.salary_p75,
              }
            : null;
        const worldwide = {
          open: r.open,
          change: week.get(`family:${r.family}`) ?? null,
          change1d: oneDay.get(r.family) ?? null,
          change1m: month.get(`family:${r.family}`)?.value ?? null,
          newThisWeek: history
            .filter((d) => isNewDay(d.date))
            .reduce((n, d) => n + d.opened, 0),
          companies: snap?.companies ?? null,
          remoteShare: snap && stated ? (snap.remote ?? 0) / stated : null,
          spark: history.map((d) =>
            Math.round((r.open * d.index_value) / r.index_value),
          ),
        };
        return {
          family: r.family,
          code: info.code,
          name: info.name,
          longName: professionLongName(r.family),
          pay,
          ...worldwide,
          ...(scope ? scope(r.family, history) : {}),
        };
      })
      .sort(
        (a, b) =>
          b.open - a.open ||
          (order.get(a.family) ?? 99) - (order.get(b.family) ?? 99),
      ),
  };
}

/**
 * One region's figures for a family. Roles are only counted by country per
 * day, so a change reads the family's like-for-like index scaled by how the
 * region's share of the family moved: a burst of newly read pages in one day
 * does not show up as growth.
 */
async function regionalScope(
  sql: Sql,
  asOf: IsoDay,
  sparkFrom: IsoDay,
  region: ProfessionRegionId,
) {
  const countries = PROFESSION_REGIONS.find((r) => r.id === region)!.countries;
  const rows = await sql<
    {
      date: IsoDay;
      family: string;
      region_open: number;
      region_opened: number;
      total: number;
    }[]
  >`select date, family,
      coalesce(sum(open) filter (where country in ${sql(countries)}), 0)::int as region_open,
      coalesce(sum(opened) filter (where country in ${sql(countries)}), 0)::int as region_opened,
      sum(open)::int as total
    from profession_daily where date >= ${sparkFrom} and date <= ${asOf}
    group by date, family order by date`;
  const byFamily = new Map<string, typeof rows>();
  for (const r of rows) {
    byFamily.set(r.family, [...(byFamily.get(r.family) ?? []), r]);
  }
  const weekFrom = addDays(asOf, -(WEEK_DAYS - 1));
  const base = weekBase(asOf);
  return (family: string, history: readonly DayRow[]) => {
    const days = byFamily.get(family) ?? [];
    const indexOn = new Map(history.map((d) => [d.date, d.index_value]));
    const today = days.find((d) => d.date === asOf);
    const level = (d: (typeof rows)[number] | undefined) =>
      d && d.total ? ((indexOn.get(d.date) ?? 0) * d.region_open) / d.total : 0;
    const now = level(today);
    const changeFrom = (day: (typeof rows)[number] | undefined) => {
      const then = level(day);
      return now && then ? now / then - 1 : null;
    };
    const previous = days.filter((d) => d.date < asOf).at(-1);
    const baseDay = days.find((d) => d.date >= base && d.date < asOf);
    const open = today?.region_open ?? 0;
    const weekChange = changeFrom(baseDay);
    return {
      open,
      change:
        weekChange === null
          ? null
          : ({
              range: '1W',
              value: weekChange,
              baseDate: baseDay?.date ?? base,
              partial: false,
              estimated: false,
            } satisfies Change),
      change1d:
        previous && !isBootstrapDay(previous.date) ? changeFrom(previous) : null,
      change1m: null,
      newThisWeek: days
        .filter((d) => d.date >= weekFrom && !isBootstrapDay(d.date))
        .reduce((n, d) => n + d.region_opened, 0),
      companies: null,
      remoteShare: null,
      spark: days.map((d) =>
        now ? Math.round((open * level(d)) / now) : d.region_open,
      ),
    };
  };
}
