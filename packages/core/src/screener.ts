/**
 * Shared by the read API and the web app: the Screener's filters (read from the
 * URL), the payloads it serves, page slugs for search results, and the
 * company signal rule.
 */
import type { IsoDay } from './dates.ts';
import type { Change } from './types.ts';

// ---------- Modes, sorts, filters ----------

export const SCREENER_MODES = ['companies', 'professions', 'skills'] as const;
export type ScreenerMode = (typeof SCREENER_MODES)[number];

export const SORT_KEYS = ['open', 'name', 'change1w', 'change1m', 'remote'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const JOB_SORTS = ['newest', 'opened', 'salary'] as const;
export type JobSort = (typeof JOB_SORTS)[number];

/** Seniority groups of the summary strip and the filter, each a set of krill levels. */
export const LEVEL_GROUPS = [
  { key: 'entry', label: 'Entry', levels: ['intern', 'junior'] },
  { key: 'mid', label: 'Mid', levels: ['mid'] },
  { key: 'senior', label: 'Senior', levels: ['senior'] },
  { key: 'staff', label: 'Staff+', levels: ['staff', 'principal'] },
  { key: 'management', label: 'Management', levels: ['manager', 'director', 'executive'] },
] as const;
export type LevelGroupKey = (typeof LEVEL_GROUPS)[number]['key'];

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABEL: Record<WorkMode, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

/** Regions krill knows (a job placed in, or remote-open to, a country of the region). */
export const REGIONS = [
  { id: 'north-america', label: 'North America' },
  { id: 'europe', label: 'Europe' },
  { id: 'eu', label: 'European Union' },
  { id: 'dach', label: 'DACH' },
  { id: 'nordics', label: 'Nordics' },
  { id: 'benelux', label: 'Benelux' },
  { id: 'apac', label: 'Asia-Pacific' },
  { id: 'latam', label: 'Latin America' },
  { id: 'mena', label: 'Middle East & North Africa' },
] as const;

export const GROWTH_STATES = ['ramping', 'steady', 'cooling', 'freezing'] as const;
export type GrowthState = (typeof GROWTH_STATES)[number];
export const GROWTH_LABEL: Record<GrowthState, string> = {
  ramping: 'Ramping',
  steady: 'Steady',
  cooling: 'Cooling',
  freezing: 'Freezing',
};

/** "Posted within" options, in days (krill dates are whole days). */
export const POSTED_WITHIN_DAYS = [1, 3, 7, 14, 30] as const;

export const SALARY_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;
export const SALARY_STEPS: Record<string, readonly number[]> = {
  USD: [100_000, 150_000, 200_000, 250_000, 300_000],
  EUR: [60_000, 80_000, 100_000, 120_000, 150_000],
  GBP: [50_000, 70_000, 90_000, 110_000, 140_000],
};

export interface ScreenerFilters {
  region: string | null;
  country: string | null;
  workMode: WorkMode | null;
  level: LevelGroupKey | null;
  family: string | null;
  skill: string | null;
  growth: GrowthState | null;
  salary: { currency: string; min: number } | null;
  postedWithin: number | null;
}

export interface ScreenerQuery {
  mode: ScreenerMode;
  filters: ScreenerFilters;
  sort: SortKey;
  dir: 'asc' | 'desc';
  jobSort: JobSort;
  /** krill cursor of the next page of matching jobs. */
  cursor: string | null;
}

export const EMPTY_FILTERS: ScreenerFilters = {
  region: null,
  country: null,
  workMode: null,
  level: null,
  family: null,
  skill: null,
  growth: null,
  salary: null,
  postedWithin: null,
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function pick(params: Params, key: string): string | null {
  const v = params instanceof URLSearchParams ? params.get(key) : params[key];
  const one = Array.isArray(v) ? v[0] : v;
  return one && one.trim() !== '' ? one.trim() : null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Parses the Screener URL; anything unknown is dropped, never trusted. */
export function parseScreenerQuery(params: Params): ScreenerQuery {
  const salaryRaw = pick(params, 'salary');
  let salary: ScreenerFilters['salary'] = null;
  if (salaryRaw) {
    const [currency, amount] = salaryRaw.split(':');
    const min = Number(amount);
    if (currency && (SALARY_CURRENCIES as readonly string[]).includes(currency) && Number.isInteger(min) && min > 0 && min <= 10_000_000) {
      salary = { currency, min };
    }
  }
  const country = pick(params, 'country');
  const family = pick(params, 'family');
  const skill = pick(params, 'skill');
  const posted = Number(pick(params, 'posted'));
  const sortRaw = pick(params, 'sort');
  const mode = oneOf(pick(params, 'mode'), SCREENER_MODES) ?? 'companies';
  const sort = oneOf(sortRaw, SORT_KEYS) ?? 'open';
  return {
    mode,
    filters: {
      region: oneOf(pick(params, 'region'), REGIONS.map((r) => r.id)),
      country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null,
      workMode: oneOf(pick(params, 'workMode'), WORK_MODES),
      level: oneOf(pick(params, 'level'), LEVEL_GROUPS.map((g) => g.key)),
      family: family && /^[a-z0-9-]{1,40}$/.test(family) ? family : null,
      skill: skill && /^[a-z0-9:+#._-]{1,60}$/i.test(skill) ? skill : null,
      growth: oneOf(pick(params, 'growth'), GROWTH_STATES),
      salary,
      postedWithin: (POSTED_WITHIN_DAYS as readonly number[]).includes(posted) ? posted : null,
    },
    sort,
    dir: pick(params, 'dir') === 'asc' ? 'asc' : 'desc',
    jobSort: oneOf(pick(params, 'jobs'), JOB_SORTS) ?? 'newest',
    cursor: (() => {
      const c = pick(params, 'cursor');
      return c && c.length <= 500 && /^[A-Za-z0-9_-]+$/.test(c) ? c : null;
    })(),
  };
}

/** True when any filter narrows the market (the table then needs live krill facets). */
export function isFiltered(f: ScreenerFilters): boolean {
  return Object.values(f).some((v) => v !== null);
}

/** Filters that change the krill query. Growth only filters the rows we already hold. */
export function hasKrillFilter(f: ScreenerFilters): boolean {
  return isFiltered({ ...f, growth: null });
}

/** Query string for a Screener URL; defaults are left out. */
export function screenerHref(q: Partial<Omit<ScreenerQuery, 'filters'>> & { filters?: Partial<ScreenerFilters> }): string {
  const p = new URLSearchParams();
  const f = { ...EMPTY_FILTERS, ...q.filters };
  if (q.mode && q.mode !== 'companies') p.set('mode', q.mode);
  if (f.region) p.set('region', f.region);
  if (f.country) p.set('country', f.country);
  if (f.workMode) p.set('workMode', f.workMode);
  if (f.level) p.set('level', f.level);
  if (f.family) p.set('family', f.family);
  if (f.skill) p.set('skill', f.skill);
  if (f.growth) p.set('growth', f.growth);
  if (f.salary) p.set('salary', `${f.salary.currency}:${f.salary.min}`);
  if (f.postedWithin) p.set('posted', String(f.postedWithin));
  if (q.sort && q.sort !== 'open') p.set('sort', q.sort);
  if (q.dir === 'asc') p.set('dir', 'asc');
  if (q.jobSort && q.jobSort !== 'newest') p.set('jobs', q.jobSort);
  if (q.cursor) p.set('cursor', q.cursor);
  const s = p.toString();
  return s ? `/screener?${s}` : '/screener';
}

// ---------- Signal rule ----------

/** Comparable days of company history a signal needs. */
export const MIN_SIGNAL_DAYS = 7;
/** Net change in open roles over the signal window. */
export const RAMPING_AT = 0.03;
export const COOLING_AT = -0.03;
export const FREEZING_AT = -0.1;

/**
 * Company signal from the net change in open roles over the window krill's
 * company statistics cover (up to 30 days): at least +3% is ramping, at most
 * -3% cooling, at most -10% freezing, anything between steady. null while
 * fewer than MIN_SIGNAL_DAYS comparable days exist.
 */
export function companySignal(netChange: number | null, days: number): GrowthState | null {
  if (netChange === null || days < MIN_SIGNAL_DAYS) return null;
  if (netChange <= FREEZING_AT) return 'freezing';
  if (netChange <= COOLING_AT) return 'cooling';
  if (netChange >= RAMPING_AT) return 'ramping';
  return 'steady';
}

// ---------- Slugs ----------

/** "NVIDIA Corp." -> "nvidia-corp" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Page slug of a skill id: "ml:pytorch" -> "pytorch". Collisions between namespaces keep the namespace. */
export function skillSlug(id: string, taken?: ReadonlySet<string>): string {
  const bare = slugify(id.includes(':') ? id.slice(id.indexOf(':') + 1) : id) || 'skill';
  if (!taken || !taken.has(bare)) return bare;
  return slugify(id.replace(':', '-')) || bare;
}

export function professionHref(code: string): string {
  return `/professions/${code.toLowerCase()}`;
}
export const companyHref = (slug: string) => `/companies/${slug}`;
export const skillHref = (slug: string) => `/skills/${slug}`;

// ---------- Payloads ----------

export interface SkillChip {
  id: string;
  label: string;
}

export interface ScreenerRow {
  id: string;
  kind: ScreenerMode;
  href: string;
  label: string;
  /** Ticker code of a profession or a listed company. */
  ticker: string | null;
  domain: string | null;
  /** Open roles under the active filters (all open roles when none apply). */
  open: number;
  change1w: Change | null;
  change1m: Change | null;
  signal: GrowthState | null;
  topProfession: string | null;
  topSkills: SkillChip[];
  /** Remote / roles that state a work mode; null when none state one. */
  remoteShare: number | null;
  /** Roles stating a work mode / all open roles of this subject. */
  statedShare: number | null;
  spark: number[];
}

export interface MixRow {
  key: string;
  label: string;
  count: number;
  /** count / total of the mix. */
  share: number;
}

export interface ScreenerSummary {
  open: number;
  levels: MixRow[];
  workModes: MixRow[];
  /** Roles with no stated work mode. */
  workModeUnstated: number;
  countries: { code: string; name: string; count: number }[];
}

export interface ScreenerJob {
  id: string;
  title: string;
  company: { id: string; name: string; domain: string | null };
  url: string;
  location: string | null;
  workMode: WorkMode | null;
  level: string | null;
  levelLabel: string | null;
  salary: string | null;
  /** Days since the role opened. */
  ageDays: number;
  openedAt: IsoDay;
}

export type JobsPanel =
  | { available: true; total: number; jobs: ScreenerJob[]; nextCursor: string | null; sort: JobSort; salaryCurrency: string }
  | { available: false; reason: string };

export interface ScreenerOptions {
  families: { id: string; code: string; name: string }[];
  countries: { code: string; name: string; count: number }[];
  skills: { id: string; label: string; count: number }[];
}

export interface ScreenerPayload {
  asOf: IsoDay;
  builtAt: string;
  mode: ScreenerMode;
  filters: ScreenerFilters;
  filtered: boolean;
  sort: SortKey;
  dir: 'asc' | 'desc';
  /** Roles matching the filters. */
  matches: number;
  rows: ScreenerRow[];
  /** Rows the table holds before the display cap. */
  rowTotal: number;
  /** Plain-language notes about what the numbers cover. */
  notes: string[];
  /** Companies mode: the filter hides the signal because no company has one yet. */
  growthUnavailable: string | null;
  summary: ScreenerSummary | { available: false; reason: string };
  jobs: JobsPanel;
  options: ScreenerOptions;
}

export type SearchKind = 'profession' | 'company' | 'skill';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
  open: number;
  domain: string | null;
}

export interface SearchResults {
  query: string;
  groups: { kind: SearchKind; title: string; hits: SearchHit[] }[];
}

export interface RoleHit {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
}
