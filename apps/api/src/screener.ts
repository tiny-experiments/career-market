import { countryName, familyInfo, FAMILIES, isTileSkill, skillLabel, companyTicker } from '@cm/core/codes';
import { addDays, daysBetween, FIRST_COMPARABLE_BASE, type IsoDay, type Range } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import {
  companyHref,
  hasKrillFilter,
  isFiltered,
  LEVEL_GROUPS,
  MIN_SIGNAL_DAYS,
  professionHref,
  skillHref,
  slugify,
  type GrowthState,
  type JobSort,
  type JobsPanel,
  type MixRow,
  type ScreenerFilters,
  type ScreenerJob,
  type ScreenerOptions,
  type ScreenerPayload,
  type ScreenerQuery,
  type ScreenerRow,
  type ScreenerSummary,
  type SkillChip,
  type SortKey,
  type WorkMode,
} from '@cm/core/screener';
import type { Change } from '@cm/core/types';
import { z } from 'zod';
import { KrillLive, KrillLiveError } from './krillLive.ts';
import { latestBuild, NotReadyError } from './readModel.ts';

/** Rows the table shows at most. */
const MAX_ROWS = 100;
const SPARK_DAYS = 30;
const JOBS_PAGE = 20;
/** Share of facet values requested from krill under a filter. */
const FACET_LIMIT = 1000;

// ---------- krill live shapes ----------

const count = z.number().int().nonnegative();
const facetList = z.array(z.object({ value: z.string(), count }));
const liveFacetsSchema = z.object({
  total: count,
  facets: z.object({
    family: facetList,
    level: facetList,
    skill: facetList,
    country: facetList,
    workMode: facetList,
    company: facetList,
  }),
});
type LiveFacets = z.infer<typeof liveFacetsSchema>;

const liveJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.object({ id: z.string(), name: z.string() }),
  url: z.string(),
  applyUrl: z.string().nullable(),
  workMode: z.string().nullable(),
  locations: z.array(z.string()),
  places: z.array(z.object({ label: z.string(), city: z.string().nullable(), admin1Code: z.string().nullable(), countryCode: z.string().nullable() })),
  salary: z
    .object({ annualMin: z.number().nullable(), annualMax: z.number().nullable(), currency: z.string().nullable(), summary: z.string().nullable() })
    .nullable(),
  level: z.string().nullable(),
  openedAt: z.string(),
});
const liveJobPageSchema = z.object({
  items: z.array(liveJobSchema),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});

// ---------- filters -> krill ----------

/** krill query parameters of the active filters, for /v1/facets and /v1/jobs. */
export function krillFilterParams(f: ScreenerFilters, asOf: IsoDay): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (f.region) p.region = f.region;
  if (f.country) p.country = f.country;
  if (f.workMode) p.workMode = f.workMode;
  if (f.level) p.level = (LEVEL_GROUPS.find((g) => g.key === f.level)?.levels ?? []).join(',');
  if (f.family) p.family = f.family;
  if (f.skill) p.skills = f.skill;
  if (f.salary) {
    p.salaryMin = f.salary.min;
    p.currency = f.salary.currency;
  }
  if (f.postedWithin) p.openedSince = addDays(asOf, -f.postedWithin);
  return p;
}

// ---------- read model rows ----------

interface ChangeRow {
  subject: string;
  range: Range;
  base_date: IsoDay;
  change: number;
  partial: boolean;
  estimated: boolean;
}

async function changeMap(sql: Sql, asOf: IsoDay, subjects: string[]): Promise<Map<string, { '1W'?: Change; '1M'?: Change }>> {
  const out = new Map<string, { '1W'?: Change; '1M'?: Change }>();
  if (subjects.length === 0) return out;
  const rows = await sql<ChangeRow[]>`
    select subject, range, base_date, change, partial, estimated from market_change
    where as_of = ${asOf} and range in ('1W', '1M') and subject in ${sql(subjects)}`;
  for (const r of rows) {
    const entry = out.get(r.subject) ?? {};
    entry[r.range as '1W' | '1M'] = { range: r.range, value: r.change, baseDate: r.base_date, partial: r.partial, estimated: r.estimated };
    out.set(r.subject, entry);
  }
  return out;
}

function remoteShare(m: { remote: number; hybrid: number; onsite: number }, open: number): { remote: number | null; stated: number | null } {
  const stated = m.remote + m.hybrid + m.onsite;
  return { remote: stated > 0 ? m.remote / stated : null, stated: open > 0 && stated > 0 ? Math.min(1, stated / open) : null };
}

const chipsOf = (ids: readonly string[]): SkillChip[] => ids.map((id) => ({ id, label: skillLabel(id) }));

interface Ctx {
  sql: Sql;
  asOf: IsoDay;
  sparkFrom: IsoDay;
  /** Open roles under the krill filters, by id, when filters apply. */
  counts: Map<string, number> | null;
}

async function companyRows(ctx: Ctx): Promise<{ rows: ScreenerRow[]; unlisted: number }> {
  const { sql, asOf } = ctx;
  const base = await sql<
    {
      company_id: string; slug: string; name: string; domain: string | null; open: number; top_family: string | null;
      top_skills: string[]; remote: number; hybrid: number; onsite: number; signal: GrowthState | null;
    }[]
  >`select company_id, slug, name, domain, open, top_family, top_skills, remote, hybrid, onsite, signal
    from screener_company where as_of = ${asOf}`;
  const changes = await changeMap(sql, asOf, base.map((c) => `company:${c.company_id}`));
  const sparkRows = await sql<{ company_id: string; open: number }[]>`
    select company_id, open from screener_company_day
    where family = '*' and date >= ${ctx.sparkFrom} and date <= ${asOf} order by date`;
  const spark = new Map<string, number[]>();
  for (const r of sparkRows) {
    const list = spark.get(r.company_id);
    if (list) list.push(r.open);
    else spark.set(r.company_id, [r.open]);
  }
  const known = new Set(base.map((c) => c.company_id));
  const rows: ScreenerRow[] = [];
  for (const c of base) {
    const open = ctx.counts ? (ctx.counts.get(c.company_id) ?? 0) : c.open;
    if (open <= 0) continue;
    const share = remoteShare(c, c.open);
    const ch = changes.get(`company:${c.company_id}`);
    rows.push({
      id: c.company_id,
      kind: 'companies',
      href: companyHref(c.slug),
      label: c.name,
      ticker: companyTicker(c.name) ?? null,
      domain: c.domain,
      open,
      change1w: ch?.['1W'] ?? null,
      change1m: ch?.['1M'] ?? null,
      signal: c.signal,
      topProfession: c.top_family ? familyInfo(c.top_family).name : null,
      topSkills: chipsOf(c.top_skills),
      remoteShare: share.remote,
      statedShare: share.stated,
      spark: spark.get(c.company_id) ?? [],
    });
  }
  const unlisted = ctx.counts ? [...ctx.counts.keys()].filter((id) => !known.has(id)).length : 0;
  return { rows, unlisted };
}

async function professionRows(ctx: Ctx): Promise<ScreenerRow[]> {
  const { sql, asOf } = ctx;
  const today = await sql<{ family: string; open: number; index_value: number }[]>`
    select family, open, index_value from family_daily where date = ${asOf}`;
  const mix = await sql<{ id: string; remote: number; hybrid: number; onsite: number }[]>`
    select id, remote, hybrid, onsite from screener_subject where as_of = ${asOf} and kind = 'family'`;
  const mixBy = new Map(mix.map((m) => [m.id, m]));
  const changes = await changeMap(sql, asOf, today.map((f) => `family:${f.family}`));
  const sparkRows = await sql<{ family: string; index_value: number }[]>`
    select family, index_value from family_daily where date >= ${ctx.sparkFrom} and date <= ${asOf} order by date`;
  const topSkills = await sql<{ family: string; skill: string; open: number }[]>`
    select family, skill, open from skill_daily where date = ${asOf} and country = '*' order by open desc`;
  const rows: ScreenerRow[] = [];
  for (const f of today) {
    const open = ctx.counts ? (ctx.counts.get(f.family) ?? 0) : f.open;
    if (open <= 0) continue;
    const info = familyInfo(f.family);
    const m = mixBy.get(f.family);
    const share = m ? remoteShare(m, f.open) : { remote: null, stated: null };
    const ch = changes.get(`family:${f.family}`);
    rows.push({
      id: f.family,
      kind: 'professions',
      href: professionHref(info.code),
      label: info.name,
      ticker: info.code,
      domain: null,
      open,
      change1w: ch?.['1W'] ?? null,
      change1m: ch?.['1M'] ?? null,
      signal: null,
      topProfession: null,
      topSkills: chipsOf(topSkills.filter((s) => s.family === f.family && isTileSkill(s.skill)).slice(0, 3).map((s) => s.skill)),
      remoteShare: share.remote,
      statedShare: share.stated,
      spark: sparkRows.filter((s) => s.family === f.family).map((s) => Math.round((f.open * s.index_value) / f.index_value)),
    });
  }
  return rows;
}

async function skillRows(ctx: Ctx): Promise<ScreenerRow[]> {
  const { sql, asOf } = ctx;
  let ids: { id: string; open: number }[];
  if (ctx.counts) {
    ids = [...ctx.counts.entries()].filter(([id]) => isTileSkill(id)).map(([id, open]) => ({ id, open })).sort((a, b) => b.open - a.open).slice(0, MAX_ROWS);
  } else {
    ids = (
      await sql<{ id: string; open: number }[]>`
        select id, open from screener_subject where as_of = ${asOf} and kind = 'skill' order by open desc`
    ).map((r) => ({ id: r.id, open: r.open }));
  }
  if (ids.length === 0) return [];
  const names = ids.map((s) => s.id);
  const mix = await sql<{ id: string; top_family: string | null; remote: number; hybrid: number; onsite: number; open: number }[]>`
    select id, top_family, remote, hybrid, onsite, open from screener_subject
    where as_of = ${asOf} and kind = 'skill' and id in ${sql(names)}`;
  const mixBy = new Map(mix.map((m) => [m.id, m]));
  const changes = await changeMap(sql, asOf, names.map((s) => `skill:${s}`));
  const slugRows = await sql<{ id: string; slug: string }[]>`
    select id, slug from search_entry where as_of = ${asOf} and kind = 'skill' and id in ${sql(names)}`;
  const slugBy = new Map(slugRows.map((r) => [r.id, r.slug]));
  const sparkRows = await sql<{ skill: string; open: number }[]>`
    select skill, sum(open)::int as open from skill_daily
    where country = '*' and date >= ${ctx.sparkFrom} and date <= ${asOf} and skill in ${sql(names)}
    group by skill, date order by date`;
  return ids.map((s) => {
    const m = mixBy.get(s.id);
    const share = m ? remoteShare(m, m.open) : { remote: null, stated: null };
    const ch = changes.get(`skill:${s.id}`);
    return {
      id: s.id,
      kind: 'skills' as const,
      href: skillHref(slugBy.get(s.id) ?? slugify(s.id.includes(':') ? s.id.slice(s.id.indexOf(':') + 1) : s.id)),
      label: skillLabel(s.id),
      ticker: null,
      domain: null,
      open: s.open,
      change1w: ch?.['1W'] ?? null,
      change1m: ch?.['1M'] ?? null,
      signal: null,
      topProfession: m?.top_family ? familyInfo(m.top_family).name : null,
      topSkills: [],
      remoteShare: share.remote,
      statedShare: share.stated,
      spark: sparkRows.filter((x) => x.skill === s.id).map((x) => x.open),
    };
  });
}

// ---------- sorting and growth ----------

function sortValue(r: ScreenerRow, key: SortKey): number | string | null {
  switch (key) {
    case 'open':
      return r.open;
    case 'name':
      return r.label.toLowerCase();
    case 'change1w':
      return r.change1w?.value ?? null;
    case 'change1m':
      return r.change1m?.value ?? null;
    case 'remote':
      return r.remoteShare;
  }
}

export function sortRows(rows: ScreenerRow[], key: SortKey, dir: 'asc' | 'desc'): ScreenerRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === null && y === null) return b.open - a.open;
    if (x === null) return 1; // rows without a value always sort last
    if (y === null) return -1;
    if (x < y) return -1 * sign;
    if (x > y) return 1 * sign;
    return b.open - a.open;
  });
}

// ---------- summary ----------

function mixOf(items: { key: string; label: string; count: number }[]): MixRow[] {
  const total = items.reduce((n, i) => n + i.count, 0);
  return items.map((i) => ({ ...i, share: total > 0 ? i.count / total : 0 }));
}

function summaryFrom(
  total: number,
  levels: { value: string; count: number }[],
  workModes: { value: string; count: number }[],
  countries: { value: string; count: number }[],
): ScreenerSummary {
  const levelCount = (g: (typeof LEVEL_GROUPS)[number]) => levels.filter((l) => (g.levels as readonly string[]).includes(l.value)).reduce((n, l) => n + l.count, 0);
  const groups = LEVEL_GROUPS.map((g) => ({ key: g.key, label: g.label, count: levelCount(g) }));
  const modes: { key: WorkMode; label: string; count: number }[] = [
    { key: 'remote', label: 'Remote', count: workModes.find((w) => w.value === 'remote')?.count ?? 0 },
    { key: 'hybrid', label: 'Hybrid', count: workModes.find((w) => w.value === 'hybrid')?.count ?? 0 },
    { key: 'onsite', label: 'On-site', count: workModes.find((w) => w.value === 'onsite')?.count ?? 0 },
  ];
  const stated = modes.reduce((n, m) => n + m.count, 0);
  return {
    open: total,
    levels: mixOf(groups),
    workModes: mixOf(modes),
    workModeUnstated: Math.max(0, total - stated),
    countries: countries.slice(0, 5).map((c) => ({ code: c.value, name: countryName(c.value), count: c.count })),
  };
}

// ---------- jobs ----------

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', INR: '₹', JPY: '¥', CHF: 'CHF ' };

function compactMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

export function formatSalary(s: { annualMin: number | null; annualMax: number | null; currency: string | null } | null): string | null {
  if (!s || (s.annualMin === null && s.annualMax === null)) return null;
  const sym = s.currency ? (CURRENCY_SYMBOL[s.currency] ?? `${s.currency} `) : '';
  const lo = s.annualMin ?? s.annualMax;
  const hi = s.annualMax ?? s.annualMin;
  if (lo === null || hi === null) return null;
  return lo === hi ? `${sym}${compactMoney(lo)}` : `${sym}${compactMoney(lo)} – ${sym}${compactMoney(hi)}`;
}

function levelLabel(level: string | null): string | null {
  if (!level) return null;
  return LEVEL_GROUPS.find((g) => (g.levels as readonly string[]).includes(level))?.label ?? null;
}

function locationOf(j: z.infer<typeof liveJobSchema>): string | null {
  const first = j.places[0]?.label ?? j.locations[0] ?? null;
  const more = Math.max(j.places.length, j.locations.length) - 1;
  return first ? (more > 0 ? `${first} +${more}` : first) : null;
}

const KRILL_JOB_SORT: Record<JobSort, string> = { newest: 'newest', opened: 'opened', salary: 'salary' };

async function jobsPanel(live: KrillLive, sql: Sql, q: ScreenerQuery, asOf: IsoDay, total: number): Promise<JobsPanel> {
  const f = q.filters;
  const salaryCurrency = f.salary?.currency ?? 'USD';
  const params: Record<string, string | number | undefined> = {
    ...krillFilterParams(f, asOf),
    sort: KRILL_JOB_SORT[q.jobSort],
    pageSize: JOBS_PAGE,
    cursor: q.cursor ?? undefined,
  };
  if (q.jobSort === 'salary') params.currency = salaryCurrency;
  try {
    const page = await live.get('/v1/jobs', params, liveJobPageSchema);
    const ids = [...new Set(page.items.map((j) => j.company.id))];
    const domains = ids.length
      ? await sql<{ company_id: string; domain: string | null }[]>`
          select company_id, domain from screener_company where as_of = ${asOf} and company_id in ${sql(ids)}`
      : [];
    const domainBy = new Map(domains.map((d) => [d.company_id, d.domain]));
    const jobs: ScreenerJob[] = page.items.map((j) => ({
      id: j.id,
      title: j.title,
      company: { id: j.company.id, name: j.company.name, domain: domainBy.get(j.company.id) ?? null },
      url: j.applyUrl ?? j.url,
      location: locationOf(j),
      workMode: (['remote', 'hybrid', 'onsite'] as const).find((m) => m === j.workMode) ?? null,
      level: j.level,
      levelLabel: levelLabel(j.level),
      salary: formatSalary(j.salary),
      ageDays: Math.max(0, daysBetween(j.openedAt, asOf)),
      openedAt: j.openedAt,
    }));
    return { available: true, total, jobs, nextCursor: page.nextCursor, sort: q.jobSort, salaryCurrency };
  } catch (err) {
    return { available: false, reason: err instanceof KrillLiveError ? `Matching roles could not be loaded from krill: ${err.message}.` : 'Matching roles could not be loaded.' };
  }
}

// ---------- options ----------

async function options(sql: Sql, asOf: IsoDay): Promise<ScreenerOptions> {
  const facets = await sql<{ kind: string; value: string; count: number }[]>`
    select kind, value, count from screener_facet where as_of = ${asOf} and kind in ('country', 'skill') order by count desc`;
  const countries = facets.filter((f) => f.kind === 'country').slice(0, 80).map((f) => ({ code: f.value, name: countryName(f.value), count: f.count }));
  countries.sort((a, b) => a.name.localeCompare(b.name));
  const skills = facets
    .filter((f) => f.kind === 'skill' && isTileSkill(f.value))
    .slice(0, 120)
    .map((f) => ({ id: f.value, label: skillLabel(f.value), count: f.count }));
  skills.sort((a, b) => a.label.localeCompare(b.label));
  return {
    families: FAMILIES.map((f) => ({ id: f.id, code: f.code, name: f.name })),
    countries,
    skills,
  };
}

// ---------- the payload ----------

export async function screener(sql: Sql, live: KrillLive, q: ScreenerQuery): Promise<ScreenerPayload> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;
  const f = q.filters;
  const notes: string[] = [];
  const krillFiltered = hasKrillFilter(f);

  // Under a filter krill counts the open roles; the read model supplies everything else about each row.
  let facets: LiveFacets | null = null;
  let liveError: string | null = null;
  if (krillFiltered) {
    try {
      facets = await live.get('/v1/facets', { ...krillFilterParams(f, asOf), limit: FACET_LIMIT }, liveFacetsSchema);
    } catch (err) {
      liveError = err instanceof KrillLiveError ? err.message : 'krill could not be reached';
    }
  }

  const sparkFrom = addDays(asOf, -(SPARK_DAYS - 1));
  let counts: Map<string, number> | null = null;
  if (facets) {
    const list = q.mode === 'companies' ? facets.facets.company : q.mode === 'professions' ? facets.facets.family : facets.facets.skill;
    counts = new Map(list.map((x) => [x.value, x.count]));
  }
  const ctx: Ctx = { sql, asOf, sparkFrom, counts };

  let rows: ScreenerRow[] = [];
  let unlisted = 0;
  if (!(krillFiltered && !facets)) {
    if (q.mode === 'companies') {
      const r = await companyRows(ctx);
      rows = r.rows;
      unlisted = r.unlisted;
    } else if (q.mode === 'professions') rows = await professionRows(ctx);
    else rows = await skillRows(ctx);
  }

  let growthUnavailable: string | null = null;
  if (f.growth) {
    if (!rows.some((r) => r.signal !== null)) {
      const [h] = await sql<{ days: number }[]>`select greatest(count(distinct date) - 1, 0)::int as days from screener_company_day where date >= ${FIRST_COMPARABLE_BASE} and date <= ${asOf}`;
      growthUnavailable = `Signals need ${MIN_SIGNAL_DAYS} days of company history; krill's company statistics hold ${h?.days ?? 0} comparable day${h?.days === 1 ? '' : 's'} so far (2–3 Nov were bootstrap days).`;
    }
    rows = rows.filter((r) => r.signal === f.growth);
  }

  const sorted = sortRows(rows, q.sort, q.dir);
  const rowTotal = sorted.length;
  const shown = sorted.slice(0, MAX_ROWS);

  if (krillFiltered && facets) {
    notes.push('Open roles follow your filters. Change, signal, top profession, top skills, remote share and trend describe each row overall, not only the filtered roles.');
    if (q.mode === 'companies' && unlisted > 0) {
      notes.push(`${unlisted} more companies match but sit outside the 150 largest hiring companies the Screener lists.`);
    }
  }
  if (q.mode === 'companies') notes.push('Company changes follow the open roles krill holds for each company, so a company whose boards krill only just began fetching can show a large jump.');
  if (q.mode === 'skills') notes.push('Skills show the tools, languages and platforms named in open roles.');

  // Summary and match count.
  let matches: number;
  let summary: ScreenerPayload['summary'];
  if (krillFiltered) {
    if (facets) {
      matches = facets.total;
      summary = summaryFrom(facets.total, facets.facets.level, facets.facets.workMode, facets.facets.country);
    } else {
      matches = 0;
      summary = { available: false, reason: 'The summary needs krill to count the roles for these filters.' };
    }
  } else {
    const rowsF = await sql<{ kind: string; value: string; count: number }[]>`
      select kind, value, count from screener_facet where as_of = ${asOf} and kind in ('total', 'level', 'workMode', 'country') order by count desc`;
    const by = (k: string) => rowsF.filter((r) => r.kind === k);
    matches = by('total')[0]?.count ?? 0;
    summary = summaryFrom(matches, by('level'), by('workMode'), by('country'));
  }

  const jobs = krillFiltered && !facets ? ({ available: false, reason: 'Matching roles need krill to count the filters.' } as const) : await jobsPanel(live, sql, q, asOf, matches);

  return {
    asOf,
    builtAt: build.builtAt,
    mode: q.mode,
    filters: f,
    filtered: isFiltered(f),
    sort: q.sort,
    dir: q.dir,
    matches,
    rows: shown,
    rowTotal,
    notes,
    growthUnavailable,
    liveError: liveError ? `krill could not count the roles for these filters (${liveError}). Try again in a minute.` : null,
    summary,
    jobs,
    options: await options(sql, asOf),
  };
}
