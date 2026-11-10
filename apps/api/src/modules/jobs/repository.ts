import {
  familyInfo,
  isNonTechnicalSkill,
  skillLabel,
  titleCase,
} from '@cm/core/codes';
import {
  addDays,
  FIRST_COMPARABLE_BASE,
  type IsoDay,
  type Range,
} from '@cm/core/dates';
import type { Queries as Sql } from '../../database/client.ts';
import {
  companySignal,
  employmentLabel,
  jobVerdict,
  MIN_WINDOW_N,
  payMidpoint,
  postingHealth,
  SIGNAL_HISTORY_DAYS,
  salaryPosition,
  salaryRangeShort,
  shortLocation,
  splitLocations,
  workModeLabel,
  type ClosedJobPayload,
  type CompanyTrend,
  type JobCompany,
  type JobContext,
  type JobPagePayload,
  type JobPosting,
  type JobSalary,
  type ProfessionTrend,
  type SalaryBand,
  type SimilarRole,
  type TypicalWindow,
} from '@cm/core/job';
import type { KrillJob, KrillJobDetail } from '@cm/core/krillJob';
import { companySeries } from '@cm/core/company';
import type { Change, Unavailable } from '@cm/core/types';
import type { JobsPulseCounts, JobsRepository } from './domain.ts';
import { latestBuild } from '../../database/readModel.ts';

/**
 * The Job page: one posting from the job mirror joined with the read model
 * (profession trend, pay band, typical posting window). The page never fails
 * as a whole because a side panel could not be filled: each panel carries its
 * own honest "unavailable" state.
 */

const SPARK_DAYS = 30;
const SIMILAR_COUNT = 4;
const TYPICAL_WINDOW_DAYS = 28;

/** Collects whether any side panel fell back because its read failed. */
interface Fallbacks {
  degraded: boolean;
}

export interface JobDeps {
  sql: Sql;
  jobs: JobsRepository;
  /** Look up company domains for similar roles (only useful when a logo service is configured). */
  withLogos: boolean;
}

export type JobResult =
  | { kind: 'open'; payload: JobPagePayload }
  | { kind: 'closed'; payload: ClosedJobPayload }
  | { kind: 'missing' };

export async function jobPage(deps: JobDeps, id: string): Promise<JobResult> {
  const lookup = await deps.jobs.lookup(id);
  if (lookup.kind === 'missing') return { kind: 'missing' };
  if (lookup.kind === 'closed') {
    const t = lookup.tombstone;
    return {
      kind: 'closed',
      payload: {
        status: 'closed',
        id: t.id,
        closedAt: t.closedAt,
        openedAt: t.openedAt,
        openedSource: t.openedSource,
        family: t.family,
        familyName: t.family ? familyInfo(t.family).name : null,
      },
    };
  }

  const job = lookup.job;
  const build = await latestBuild(deps.sql);
  const asOf = build?.asOf ?? null;
  const fallbacks: Fallbacks = { degraded: false };
  const [company, band, window, profession, similar, skillSlugs] =
    await Promise.all([
      companyFor(deps, job, asOf),
      salaryBandFor(deps.sql, job),
      typicalWindow(deps.sql, job.family, asOf),
      professionTrendFor(deps.sql, job.family, asOf),
      similarRoles(deps, fallbacks, job),
      skillPages(deps.sql, job.skills),
    ]);

  const posting = toPosting(job, company, skillSlugs);
  const context: JobContext = {
    verdict: jobVerdict(
      {
        ageDays: job.ageDays,
        repostCount: job.repostCount,
        staleScore: job.staleScore,
        openedSource: job.openedSource,
      },
      window,
    ),
    health: postingHealth(
      {
        ageDays: job.ageDays,
        repostCount: job.repostCount,
        openedSource: job.openedSource,
      },
      window,
    ),
    salaryBand: band,
    companyTrend: company.trend,
    professionTrend: profession,
    similar,
  };
  return {
    kind: 'open',
    payload: {
      status: 'open',
      asOf,
      degraded: fallbacks.degraded,
      job: posting,
      context,
    },
  };
}

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:'
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}

export function toSalary(job: Pick<KrillJob, 'salary'>): JobSalary | null {
  const s = job.salary;
  if (!s) return null;
  return {
    currency: s.currency,
    annualMin: s.annualMin,
    annualMax: s.annualMax,
    summary: s.summary ?? null,
  };
}

function toPosting(
  job: KrillJobDetail,
  company: {
    domain: string | null;
    slug: string | null;
    name: string | null;
  },
  skillSlugs: ReadonlyMap<string, string>,
): JobPosting {
  const evidence = new Map(
    (job.skillEvidence ?? []).map((e) => [e.id, e.count]),
  );
  const skills = job.skills
    .filter((id) => !isNonTechnicalSkill(id))
    .map((id) => ({ id, label: skillLabel(id), count: evidence.get(id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map(({ id, label }) => ({
      id,
      label,
      slug: skillSlugs.get(id) ?? null,
    }));
  const places = splitLocations(
    job.locations.length > 0 ? job.locations : job.places.map((p) => p.label),
  );
  const first = places[0] ?? null;
  return {
    id: job.id,
    title: job.title,
    company: {
      id: job.company.id,
      name: company.name ?? job.company.name,
      domain: company.domain,
      slug: company.slug,
    },
    applyUrl: httpUrl(job.applyUrl) ?? httpUrl(job.url),
    postingUrl: httpUrl(job.url),
    location: first ? shortLocation(first) : null,
    moreLocations: Math.max(0, places.length - 1),
    country: job.places[0]?.countryCode ?? null,
    level: job.level,
    employmentType: employmentLabel(job.employmentType),
    workMode: workModeLabel(job.workMode),
    salary: toSalary(job),
    family: job.family,
    specialty: job.specialty,
    openedAt: job.openedAt,
    openedSource: job.openedSource,
    lastSeenAt: job.lastSeenAt,
    ageDays: job.ageDays,
    repostCount: job.repostCount,
    staleScore: job.staleScore,
    description: job.description?.trim() ? job.description : null,
    skills,
  };
}

/** Which of these skills have a page of their own. */
async function skillPages(
  sql: Sql,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<{ skill: string; slug: string }[]>`
    select skill, slug from skill_summary
    where date = (select max(date) from skill_summary) and skill in ${sql(ids)}`;
  return new Map(rows.map((row) => [row.skill, row.slug]));
}

// ---------- Salary vs. band ----------

interface BandRow {
  specialty: string;
  level: string;
  n: number;
  p25: number;
  p50: number;
  p75: number;
}

async function salaryBandFor(
  sql: Sql,
  job: KrillJobDetail,
): Promise<SalaryBand | Unavailable> {
  const pay = job.salary;
  const midpoint = pay ? payMidpoint(pay.annualMin, pay.annualMax) : null;
  if (!pay || midpoint === null)
    return { available: false, reason: 'This posting lists no pay.' };
  const country = job.places[0]?.countryCode ?? null;
  if (pay.currency !== 'USD' || country !== 'US' || !job.family) {
    return {
      available: false,
      reason:
        'Pay bands cover US roles priced in USD for now. Other markets list pay too rarely for a fair band.',
    };
  }
  const rows = await sql<BandRow[]>`
    select specialty, level, n, p25, p50, p75 from pay_band
    where date = (select max(date) from pay_band) and country = 'US' and currency = 'USD' and family = ${job.family}`;
  const level = job.level ?? '';
  const specialty = job.specialty ?? '';
  const pick =
    (level && specialty
      ? rows.find((r) => r.specialty === specialty && r.level === level)
      : undefined) ??
    (level
      ? rows.find((r) => r.specialty === '' && r.level === level)
      : undefined) ??
    rows.find((r) => r.specialty === '' && r.level === '');
  if (!pick) {
    return {
      available: false,
      reason:
        rows.length === 0
          ? 'Pay comparisons are not available yet.'
          : 'Fewer than 30 US roles with listed pay in this profession, so there is no fair band.',
    };
  }
  const { position, verdict } = salaryPosition(midpoint, pick);
  const fam = familyInfo(job.family).name;
  const who = [
    pick.level ? titleCase(pick.level) : null,
    pick.specialty ? titleCase(pick.specialty) : null,
    fam,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    available: true,
    currency: 'USD',
    midpoint,
    p25: pick.p25,
    p50: pick.p50,
    p75: pick.p75,
    n: pick.n,
    position,
    verdict,
    basis: `Middle half of listed pay (25th to 75th percentile of the pay midpoint) for ${who} roles in the US, from ${pick.n} of the newest open roles that list pay.`,
  };
}

// ---------- Posting health ----------

/**
 * How long roles stayed open before krill saw them close, from the sampled
 * closings of the last 4 weeks: the profession's own when it has enough, else
 * the whole tech market's. Null with fewer than MIN_WINDOW_N closings.
 */
async function typicalWindow(
  sql: Sql,
  family: string | null,
  asOf: IsoDay | null,
): Promise<TypicalWindow | null> {
  if (!asOf) return null;
  const since = addDays(asOf, -TYPICAL_WINDOW_DAYS);
  const query = async (fam: string | null) => {
    const [row] = await sql<
      {
        n: number;
        p25: number | null;
        p50: number | null;
        p75: number | null;
      }[]
    >`
      select count(*)::int as n,
        percentile_cont(0.25) within group (order by age) as p25,
        percentile_cont(0.5) within group (order by age) as p50,
        percentile_cont(0.75) within group (order by age) as p75
      from (select (detected_on - opened_on) as age from closing_sample
            where detected_on > ${since} and (${fam}::text is null or family = ${fam}::text)) c`;
    return row;
  };
  for (const fam of family ? [family, null] : [null]) {
    const row = await query(fam);
    if (
      row &&
      row.n >= MIN_WINDOW_N &&
      row.p50 !== null &&
      row.p25 !== null &&
      row.p75 !== null
    ) {
      return {
        scope: fam ? familyInfo(fam).name : 'tech',
        n: row.n,
        medianDays: Math.round(row.p50),
        p25Days: Math.round(row.p25),
        p75Days: Math.round(row.p75),
      };
    }
  }
  return null;
}

// ---------- Profession trend ----------

async function professionTrendFor(
  sql: Sql,
  family: string | null,
  asOf: IsoDay | null,
): Promise<ProfessionTrend | Unavailable> {
  if (!asOf)
    return { available: false, reason: 'Hiring trends are not available yet.' };
  if (!family)
    return { available: false, reason: 'This posting has no profession yet.' };
  const info = familyInfo(family);
  const from = addDays(asOf, -(SPARK_DAYS - 1));
  const rows = await sql<{ date: IsoDay; open: number; index_value: number }[]>`
    select date, open, index_value from family_daily
    where family = ${family} and date >= ${from} and date <= ${asOf} order by date`;
  const today = rows.find((r) => r.date === asOf);
  if (!today)
    return {
      available: false,
      reason: 'Hiring trends are not available for this profession yet.',
    };
  const [change] = await sql<
    {
      range: Range;
      base_date: IsoDay;
      change: number;
      partial: boolean;
      estimated: boolean;
    }[]
  >`
    select range, base_date, change, partial, estimated from market_change
    where as_of = ${asOf} and subject = ${`family:${family}`} and range = '1W'`;
  const value: Change | null = change
    ? {
        range: change.range,
        value: change.change,
        baseDate: change.base_date,
        partial: change.partial,
        estimated: change.estimated,
      }
    : null;
  return {
    available: true,
    family,
    code: info.code,
    name: info.name,
    open: today.open,
    change: value,
    spark: rows.map((r) =>
      Math.round((today.open * r.index_value) / today.index_value),
    ),
  };
}

// ---------- Company trend ----------

/** One open-role count per day from the first usable day through `to`, last SPARK_DAYS only; a day krill sent no row for is 0. */
function dailyOpen(
  usable: readonly { date: IsoDay; open: number }[],
  to: IsoDay,
): number[] {
  const first = usable[0];
  if (!first) return [];
  const byDay = new Map(usable.map((i) => [i.date, i.open]));
  const values: number[] = [];
  for (let d = first.date; d <= to; d = addDays(d, 1))
    values.push(byDay.get(d) ?? 0);
  return values.slice(-SPARK_DAYS);
}

/** The employer's domain (for the logo), its page and its trend. */
async function companyFor(
  deps: JobDeps,
  job: KrillJobDetail,
  asOf: IsoDay | null,
): Promise<{
  domain: string | null;
  name: string | null;
  slug: string | null;
  trend: CompanyTrend | Unavailable;
}> {
  const to = asOf ?? job.lastSeenAt;
  const from = addDays(to, -(SPARK_DAYS + 5));
  const [company] = await deps.sql<
    {
      domain: string | null;
      name: string | null;
      slug: string;
      openJobs: number;
    }[]
  >`
    select domain, display_name as name, slug, open as "openJobs" from company where company_id = ${job.company.id}`;
  const items = await deps.sql<
    { date: IsoDay; open: number; new: number; closed: number }[]
  >`
    select date, open, new, closed from company_daily where company_id = ${job.company.id}
      and family = '*' and new is not null and date >= ${from} and date <= ${to} order by date`;
  const domain = company?.domain ?? null;
  const name = company?.name ?? null;
  const slug = company?.slug ?? null;
  // Only the current segment: a board event or a re-count (as when duplicate records were merged) moves roles that were not hired or closed.
  const start = companySeries(items, to, from).segmentStart;
  const usableFrom = start && start > FIRST_COMPARABLE_BASE ? start : FIRST_COMPARABLE_BASE;
  const usable = items.filter((i) => i.date > usableFrom);
  const open =
    company?.openJobs ?? usable.at(-1)?.open ?? items.at(-1)?.open ?? null;
  if (open === null)
    return {
      domain,
      name,
      slug,
      trend: {
        available: false,
        reason: 'Company hiring history is not available yet.',
      },
    };
  const signal = companySignal(usable);
  return {
    domain,
      name,
      slug,
    trend: {
      available: true,
      open,
      spark: dailyOpen(usable, to),
      firstDay: usable[0]?.date ?? null,
      signal,
      signalNote:
        signal === null
          ? `Needs ${SIGNAL_HISTORY_DAYS} days of company history; ${usable.length} so far (comparable history starts on ${usable[0]?.date ?? 'its first day'}).`
          : null,
    },
  };
}

// ---------- Similar roles ----------

async function similarRoles(
  deps: JobDeps,
  fallbacks: Fallbacks,
  job: KrillJobDetail,
): Promise<JobContext['similar']> {
  if (!job.family)
    return {
      available: false,
      reason:
        'This posting has no profession yet, so there is nothing to compare it with.',
    };
  const country = job.places[0]?.countryCode ?? undefined;
  const topSkills = (
    job.tools.length > 0
      ? job.tools
      : job.languages.length > 0
        ? job.languages
        : job.skills
  ).slice(0, 3);
  const base = {
    family: job.family,
    specialty: job.specialty ?? undefined,
    level: job.level ?? undefined,
    country,
    limit: 12,
  };
  try {
    let items = await deps.jobs.similar({
      ...base,
      skillsAny: topSkills.length ? topSkills : undefined,
    });
    if (items.length < SIMILAR_COUNT + 1 && topSkills.length > 0)
      items = await deps.jobs.similar(base);
    const picked = pickSimilar(items, job.id);
    const companies = new Map<string, JobCompany>();
    await Promise.all(
      picked.map(async (j) => {
        const [row] = await deps.sql<
          { domain: string | null; name: string | null; slug: string }[]
        >`select domain, display_name as name, slug from company where company_id = ${j.company.id}`;
        companies.set(j.company.id, {
          id: j.company.id,
          name: row?.name ?? j.company.name,
          domain: row?.domain ?? null,
          slug: row?.slug ?? null,
        });
      }),
    );
    const roles: SimilarRole[] = picked.map((j) => {
      const first =
        splitLocations(
          j.locations.length > 0 ? j.locations : j.places.map((p) => p.label),
        )[0] ?? null;
      return {
        id: j.id,
        title: j.title,
        company: companies.get(j.company.id) as JobCompany,
        location: first ? shortLocation(first) : null,
        salaryLabel: salaryRangeShort(toSalary(j)),
      };
    });
    if (roles.length === 0)
      return { available: false, reason: 'No similar open roles found.' };
    return { available: true, roles };
  } catch {
    fallbacks.degraded = true;
    return {
      available: false,
      reason: 'Similar roles could not be loaded. Try again shortly.',
    };
  }
}

/** The first roles that are not this one, one per company before a company repeats. */
export function pickSimilar(
  items: readonly KrillJob[],
  selfId: string,
  count = SIMILAR_COUNT,
): KrillJob[] {
  const others = items.filter((j) => j.id !== selfId);
  const seen = new Set<string>();
  const firstPerCompany = others.filter((j) =>
    seen.has(j.company.id) ? false : (seen.add(j.company.id), true),
  );
  const rest = others.filter((j) => !firstPerCompany.includes(j));
  return [...firstPerCompany, ...rest].slice(0, count);
}

/** The name and site we show for each employer. */
export async function companyIdentities(
  sql: Sql,
  ids: string[],
): Promise<Map<string, { name: string | null; domain: string | null }>> {
  if (!ids.length) return new Map();
  const rows = await sql<
    { company_id: string; name: string | null; domain: string | null }[]
  >`select company_id, display_name as name, domain from company where company_id in ${sql(ids)}`;
  return new Map(
    rows.map((r) => [r.company_id, { name: r.name, domain: r.domain }]),
  );
}
export async function resolveCompany(
  sql: Sql,
  value: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const [row] = await sql<
    { id: string; slug: string; name: string }[]
  >`select company_id as id, slug, coalesce(display_name, name) as name from company
    where company_id = ${value} or slug = ${value}
    order by (company_id = ${value}) desc limit 1`;
  return row ?? null;
}
export async function jobFacets(sql: Sql) {
  const build = await latestBuild(sql);
  if (!build) return { facets: [] };
  const facets = await sql<
    { kind: string; value: string; count: number }[]
  >`select kind, value, count from screener_facet where as_of = ${build.asOf} order by kind, count desc`;
  return {
    facets: facets.map((facet) =>
      facet.kind === 'family'
        ? { ...facet, label: familyInfo(facet.value).name }
        : facet,
    ),
  };
}

const PULSE_DAYS = 30;
const PULSE_PROFESSIONS = 5;

export interface JobsPulse extends JobsPulseCounts {
  /** Change in open roles against a week ago; null until there is a week to compare. */
  change1w: number | null;
  /** Daily open roles and new roles, oldest first. */
  openSpark: number[];
  newSpark: number[];
  workModes: { remote: number; hybrid: number; onsite: number };
  professions: {
    family: string;
    code: string;
    name: string;
    open: number;
    change1w: number | null;
  }[];
}

/** The strip above the Jobs table. Read-model figures plus the mirror's live counts. */
export async function jobsPulse(
  sql: Sql,
  jobs: Pick<JobsRepository, 'pulseCounts'>,
): Promise<JobsPulse> {
  const build = await latestBuild(sql);
  const counts = await jobs.pulseCounts();
  if (!build)
    return {
      ...counts,
      change1w: null,
      openSpark: [],
      newSpark: [],
      workModes: { remote: 0, hybrid: 0, onsite: 0 },
      professions: [],
    };
  const [days, changes, modes, professions] = await Promise.all([
    sql<{ open: number; opened: number }[]>`
      select open, opened from market_daily
      where date > ${addDays(build.asOf, -PULSE_DAYS)} and date <= ${build.asOf} and not estimated
      order by date`,
    sql<{ subject: string; change: number }[]>`
      select subject, change from market_change
      where as_of = ${build.asOf} and range = '1W' and (subject = 'market' or subject like 'family:%')`,
    sql<{ value: string; count: number }[]>`
      select value, count from screener_facet where as_of = ${build.asOf} and kind = 'workMode'`,
    sql<{ family: string; code: string; open: number }[]>`
      select family, code, open from family_daily
      where date = ${build.asOf} order by open desc limit ${PULSE_PROFESSIONS}`,
  ]);
  const changeOf = new Map(changes.map((row) => [row.subject, row.change]));
  const mode = (value: string) =>
    modes.find((row) => row.value === value)?.count ?? 0;
  return {
    ...counts,
    change1w: changeOf.get('market') ?? null,
    openSpark: days.map((day) => day.open),
    newSpark: days.map((day) => day.opened),
    workModes: {
      remote: mode('remote'),
      hybrid: mode('hybrid'),
      onsite: mode('onsite'),
    },
    professions: professions.map((row) => ({
      family: row.family,
      code: row.code,
      name: familyInfo(row.family).name,
      open: row.open,
      change1w: changeOf.get(`family:${row.family}`) ?? null,
    })),
  };
}
