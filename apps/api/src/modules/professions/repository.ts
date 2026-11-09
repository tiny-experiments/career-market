import { countryName, familyInfo, FAMILIES, skillLabel } from '@cm/core/codes';
import {
  addDays,
  daysBetween,
  FIRST_OBSERVED_DAY,
  isBootstrapDay,
  type IsoDay,
} from '@cm/core/dates';
import type { Queries as Sql } from '../../database/client.ts';
import {
  familyByCode,
  levelLabel,
  professionLongName,
  specialtyLabel,
  type CompanySignal,
  type ProfessionIndex,
  type ProfessionPage,
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
const TOP_SKILLS = 8;
const TOP_COMPANIES = 5;
const LATEST_ROLES = 5;

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
  const skills = await sql<{ skill: string; open: number }[]>`
    select skill, open from skill_daily
    where date = ${asOf} and family = ${family} and country = '*' order by open desc limit ${TOP_SKILLS}`;
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
        }))
      : {
          available: false,
          reason:
            'Company hiring trends are not available for this profession yet.',
        },
    skills: skills.map((s) => ({
      id: s.skill,
      label: skillLabel(s.skill),
      open: s.open,
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

/** Every profession with its open roles, 1W change and a 30-day trend (the /professions list). */
export async function professionIndex(sql: Sql): Promise<ProfessionIndex> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;
  const rows = await sql<
    { family: string; open: number; index_value: number }[]
  >`
    select family, open, index_value from family_daily where date = ${asOf}`;
  const ch = await changes(
    sql,
    asOf,
    rows.map((r) => `family:${r.family}`),
    '1W',
  );
  const sparkFrom = addDays(asOf, -(SPARK_DAYS - 1));
  const spark = await sql<{ family: string; index_value: number }[]>`
    select family, index_value from family_daily where date >= ${sparkFrom} and date <= ${asOf} order by date`;
  const order = new Map(FAMILIES.map((f, i) => [f.id, i]));
  return {
    asOf,
    builtAt: build.builtAt,
    rows: rows
      .map((r) => {
        const info = familyInfo(r.family);
        return {
          family: r.family,
          code: info.code,
          name: info.name,
          longName: professionLongName(r.family),
          open: r.open,
          change: ch.get(`family:${r.family}`) ?? null,
          spark: spark
            .filter((s) => s.family === r.family)
            .map((s) => Math.round((r.open * s.index_value) / r.index_value)),
        };
      })
      .sort(
        (a, b) =>
          b.open - a.open ||
          (order.get(a.family) ?? 99) - (order.get(b.family) ?? 99),
      ),
  };
}
