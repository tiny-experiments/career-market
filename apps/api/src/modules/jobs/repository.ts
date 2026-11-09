import { familyInfo, skillLabel, titleCase } from '@cm/core/codes';
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
import type { Change, Unavailable } from '@cm/core/types';
import type { JobsRepository } from './domain.ts';
import { latestBuild } from '../../database/readModel.ts';

/**
 * The Job page: one posting from krill (live, cached an hour) joined with the
 * read model (profession trend, pay band, typical posting window). The page
 * never fails as a whole because a side panel could not be filled: each panel
 * carries its own honest "unavailable" state.
 */

const SPARK_DAYS = 30;
const SIMILAR_COUNT = 4;
const TYPICAL_WINDOW_DAYS = 28;

/** Collects whether any side panel fell back because a krill call failed or was refused. */
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
  const [company, band, window, profession, similar] = await Promise.all([
    companyFor(deps, job, asOf),
    salaryBandFor(deps.sql, job),
    typicalWindow(deps.sql, job.family, asOf),
    professionTrendFor(deps.sql, job.family, asOf),
    similarRoles(deps, fallbacks, job),
  ]);

  const posting = toPosting(job, company.domain, company.name);
  const context: JobContext = {
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
  domain: string | null,
  displayName: string | null,
): JobPosting {
  const evidence = new Map(
    (job.skillEvidence ?? []).map((e) => [e.id, e.count]),
  );
  const skills = [...job.skills]
    .map((id) => ({ id, label: skillLabel(id), count: evidence.get(id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map(({ id, label }) => ({ id, label }));
  const places = splitLocations(
    job.locations.length > 0 ? job.locations : job.places.map((p) => p.label),
  );
  const first = places[0] ?? null;
  return {
    id: job.id,
    title: job.title,
    company: {
      id: job.company.id,
      name: displayName ?? job.company.name,
      domain,
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

/** The employer's domain (for the logo) and its trend: today's count from /v1/companies, history from krill K2. */
async function companyFor(
  deps: JobDeps,
  job: KrillJobDetail,
  asOf: IsoDay | null,
): Promise<{
  domain: string | null;
  name: string | null;
  trend: CompanyTrend | Unavailable;
}> {
  const to = asOf ?? job.lastSeenAt;
  const [company] = await deps.sql<
    { domain: string | null; name: string | null; openJobs: number }[]
  >`
    select domain, display_name as name, open as "openJobs" from company where company_id = ${job.company.id}`;
  const items = await deps.sql<
    { date: IsoDay; open: number; new: number; closed: number }[]
  >`
    select date, open, new, closed from company_daily where company_id = ${job.company.id}
      and family = '*' and new is not null and date >= ${addDays(to, -(SPARK_DAYS + 5))} and date <= ${to} order by date`;
  const domain = company?.domain ?? null;
  const name = company?.name ?? null;
  const usable = items.filter((i) => i.date > FIRST_COMPARABLE_BASE);
  const open =
    company?.openJobs ?? usable.at(-1)?.open ?? items.at(-1)?.open ?? null;
  if (open === null)
    return {
      domain,
      name,
      trend: {
        available: false,
        reason: 'Company hiring history is not available yet.',
      },
    };
  const signal = companySignal(usable);
  return {
    domain,
    name,
    trend: {
      available: true,
      open,
      spark: usable.slice(-SPARK_DAYS).map((i) => i.open),
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
  const base: Record<string, string | number | undefined> = {
    ...(job.specialty ? { specialty: job.specialty } : { family: job.family }),
    level: job.level ?? undefined,
    country,
    sort: 'newest',
    pageSize: 12,
  };
  try {
    let items = await deps.jobs.similar({
      ...base,
      skillsAny: topSkills.length ? topSkills.join(',') : undefined,
    });
    if (items.length < SIMILAR_COUNT + 1 && topSkills.length > 0)
      items = await deps.jobs.similar(base);
    const picked = pickSimilar(items, job.id);
    const companies = new Map<string, JobCompany>();
    await Promise.all(
      picked.map(async (j) => {
        const [row] = await deps.sql<
          { domain: string | null; name: string | null }[]
        >`select domain, display_name as name from company where company_id = ${j.company.id}`;
        const domain = row?.domain ?? null;
        companies.set(j.company.id, {
          id: j.company.id,
          name: row?.name ?? j.company.name,
          domain,
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
): Promise<string | null> {
  const [row] = await sql<
    { company_id: string }[]
  >`select company_id from company
    where company_id = ${value} or slug = ${value} or lower(name) = lower(${value}) or lower(display_name) = lower(${value})
    order by (company_id = ${value}) desc, open desc limit 1`;
  return row?.company_id ?? null;
}
export async function jobFacets(sql: Sql) {
  const build = await latestBuild(sql);
  if (!build) return { facets: [] };
  const facets = await sql<
    { kind: string; value: string; count: number }[]
  >`select kind, value, count from screener_facet where as_of = ${build.asOf} order by kind, count desc`;
  return { facets };
}
