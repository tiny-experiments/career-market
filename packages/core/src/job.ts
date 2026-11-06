/**
 * The Job page: payload types the read API serves and the web app renders, plus
 * the small rules that turn krill's job record into display values. Plain JSON
 * and pure functions, so the rules are unit-tested without a database.
 */
import type { IsoDay } from './dates.ts';
import type { Change, Unavailable } from './types.ts';

export interface JobCompany {
  id: string;
  name: string;
  /** Registrable domain krill holds for the company (feeds the logo service); null when unknown. */
  domain: string | null;
}

export interface JobSalary {
  currency: string | null;
  /** Annualised bounds when krill could annualise the listed pay. */
  annualMin: number | null;
  annualMax: number | null;
  /** The posting's own pay sentence, when the employer gave one. */
  summary: string | null;
}

export interface JobSkill {
  id: string;
  label: string;
}

export interface JobPosting {
  id: string;
  title: string;
  company: JobCompany;
  /** Employer page for the posting (never null: falls back to the posting URL). */
  applyUrl: string | null;
  postingUrl: string | null;
  /** "Cupertino, California, US"; extra locations in `moreLocations`. */
  location: string | null;
  moreLocations: number;
  country: string | null;
  level: string | null;
  employmentType: string | null;
  workMode: string | null;
  salary: JobSalary | null;
  family: string | null;
  specialty: string | null;
  /** Posted day when the employer gave one, else the day krill first saw it. */
  openedAt: IsoDay;
  openedSource: 'posted' | 'first_seen';
  lastSeenAt: IsoDay;
  ageDays: number | null;
  repostCount: number;
  /** krill's 0..1 stale score (70% age up to 60 days, 30% reposts up to 3). */
  staleScore: number | null;
  /** The employer's text, unchanged. */
  description: string | null;
  skills: JobSkill[];
}

export interface TypicalWindow {
  /** What the window covers, in plain words: "AI & ML" or "tech". */
  scope: string;
  n: number;
  medianDays: number;
  p25Days: number;
  p75Days: number;
}

export interface PostingHealth {
  state: 'active' | 'ghost';
  headline: string;
  detail: string;
  /** Rules that fired for a possible ghost job. */
  reasons: string[];
  typical: TypicalWindow | null;
}

export interface SalaryBand {
  available: true;
  currency: string;
  /** The role's own midpoint, annualised. */
  midpoint: number;
  p25: number;
  p50: number;
  p75: number;
  n: number;
  /** Where the midpoint sits between p25 and p75, clamped to 0..1. */
  position: number;
  verdict: 'below band' | 'below median' | 'at market median' | 'above median' | 'above band';
  /** What the band measures, for the tooltip: "US roles with listed pay: Senior AI & ML Engineering". */
  basis: string;
}

export type CompanySignalState = 'RAMPING' | 'STEADY' | 'COOLING' | 'FREEZING';

export interface CompanyTrend {
  available: true;
  /** Open tech roles at the company now (krill /v1/companies). */
  open: number;
  /** Daily open roles, oldest first, bootstrap days excluded. */
  spark: number[];
  firstDay: IsoDay | null;
  signal: CompanySignalState | null;
  /** Why there is no signal yet. */
  signalNote: string | null;
}

export interface ProfessionTrend {
  available: true;
  family: string;
  code: string;
  name: string;
  open: number;
  change: Change | null;
  spark: number[];
}

export interface SimilarRole {
  id: string;
  title: string;
  company: JobCompany;
  location: string | null;
  salaryLabel: string | null;
}

export interface JobContext {
  health: PostingHealth;
  salaryBand: SalaryBand | Unavailable;
  companyTrend: CompanyTrend | Unavailable;
  professionTrend: ProfessionTrend | Unavailable;
  similar: { available: true; roles: SimilarRole[] } | Unavailable;
}

export interface JobPagePayload {
  status: 'open';
  asOf: IsoDay | null;
  /** True when a side panel fell back because a krill call failed or was refused; the page is worth retrying soon. */
  degraded: boolean;
  job: JobPosting;
  context: JobContext;
}

export interface ClosedJobPayload {
  status: 'closed';
  id: string;
  closedAt: IsoDay;
  openedAt: IsoDay;
  openedSource: 'posted' | 'first_seen';
  family: string | null;
  familyName: string | null;
}

/** Days a posting has been open before it counts as a possible ghost job. */
export const GHOST_AGE_DAYS = 120;
/** Reposts that make a posting a possible ghost job. */
export const GHOST_REPOSTS = 2;
/** A pay band needs this many listed-pay roles. */
export const MIN_BAND_N = 30;
/** A "typical posting window" needs this many sampled closings. */
export const MIN_WINDOW_N = 30;
/** Company signals need this many days of company history. */
export const SIGNAL_HISTORY_DAYS = 30;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Posting health, from rules only: a posting is a possible ghost job when it has
 * been open 120 days or more, or was reposted twice or more. Otherwise it looks
 * active. When enough closings were sampled, the text adds how long similar roles
 * stayed open before they closed.
 */
export function postingHealth(
  input: { ageDays: number | null; repostCount: number; openedSource: 'posted' | 'first_seen' },
  typical: TypicalWindow | null,
): PostingHealth {
  const age = input.ageDays;
  const reasons: string[] = [];
  if (age !== null && age >= GHOST_AGE_DAYS) reasons.push(`open ${plural(age, 'day')}`);
  if (input.repostCount >= GHOST_REPOSTS) reasons.push(`reposted ${plural(input.repostCount, 'time')}`);

  const typicalText = typical
    ? ` Roles in ${typical.scope} that closed in the last 4 weeks were open a median of ${plural(typical.medianDays, 'day')} (middle half ${typical.p25Days}–${typical.p75Days} days, ${typical.n} roles).`
    : '';

  if (reasons.length > 0) {
    return {
      state: 'ghost',
      headline: 'Possible ghost job',
      detail: `${capitalise(reasons.join(', '))}.${typicalText}`,
      reasons,
      typical,
    };
  }
  const seen = input.openedSource === 'posted' ? 'Posted' : 'First seen';
  const when = age === null ? 'recently' : age === 0 ? 'today' : `${plural(age, 'day')} ago`;
  return {
    state: 'active',
    headline: 'Looks active',
    detail: `${seen} ${when} and still open.${typicalText}`,
    reasons,
    typical,
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Where a role's pay midpoint sits against a market band (25th to 75th percentile). */
export function salaryPosition(
  midpoint: number,
  band: { p25: number; p50: number; p75: number },
): { position: number; verdict: SalaryBand['verdict'] } {
  const span = band.p75 - band.p25;
  const position = span > 0 ? Math.min(1, Math.max(0, (midpoint - band.p25) / span)) : 0.5;
  let verdict: SalaryBand['verdict'];
  if (midpoint < band.p25) verdict = 'below band';
  else if (midpoint > band.p75) verdict = 'above band';
  else if (Math.abs(midpoint - band.p50) <= 0.05 * band.p50) verdict = 'at market median';
  else verdict = midpoint < band.p50 ? 'below median' : 'above median';
  return { position, verdict };
}

/** Midpoint of listed pay; one bound alone stands for itself. */
export function payMidpoint(min: number | null, max: number | null): number | null {
  if (min !== null && max !== null) return (min + max) / 2;
  return min ?? max;
}

/** The p-th percentile (0..1) of an ascending list, linear between ranks. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error('percentile of an empty list');
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (rank - lo);
}

/**
 * Company signal from 30 days of daily open, new and closed counts. Null until
 * the history is long enough. RAMPING: open roles up 5% or more and more roles
 * opened than closed. FREEZING: open roles down 10% or more and closings at
 * least twice the openings. COOLING: open roles down 5% or more. Else STEADY.
 */
export function companySignal(
  days: readonly { open: number; new: number; closed: number }[],
): CompanySignalState | null {
  if (days.length < SIGNAL_HISTORY_DAYS) return null;
  const window = days.slice(-SIGNAL_HISTORY_DAYS);
  const first = (window[0] as { open: number }).open;
  const last = (window.at(-1) as { open: number }).open;
  if (first <= 0) return null;
  const change = last / first - 1;
  const opened = window.reduce((n, d) => n + d.new, 0);
  const closed = window.reduce((n, d) => n + d.closed, 0);
  if (change >= 0.05 && opened > closed) return 'RAMPING';
  if (change <= -0.1 && closed >= 2 * opened) return 'FREEZING';
  if (change <= -0.05) return 'COOLING';
  return 'STEADY';
}

/** "Sr. Machine Learning Engineer, Siri Speech" -> "sr-machine-learning-engineer-siri-speech". */
export function jobSlug(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'role';
}

/** krill ids look like kr_ followed by lowercase letters and digits. */
export function isJobId(id: string): boolean {
  return /^kr_[a-z0-9]{6,40}$/.test(id);
}

/** Employer-written enum to words: FULL_TIME -> "Full-time". */
export function employmentLabel(value: string | null): string | null {
  if (!value) return null;
  const known: Record<string, string> = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    CONTRACTOR: 'Contract',
    TEMPORARY: 'Temporary',
    INTERN: 'Internship',
    INTERNSHIP: 'Internship',
    FREELANCE: 'Freelance',
    VOLUNTEER: 'Volunteer',
  };
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (known[key]) return known[key];
  const words = key.toLowerCase().split('_').filter(Boolean).join(' ');
  return words ? capitalise(words) : null;
}

export function workModeLabel(value: string | null): string | null {
  if (!value) return null;
  const known: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', 'on-site': 'On-site' };
  return known[value.toLowerCase()] ?? capitalise(value);
}

const COUNTRY_SUFFIX: Record<string, string> = {
  'United States of America': 'US',
  'United States': 'US',
  'United Kingdom': 'UK',
  'United Arab Emirates': 'UAE',
};

/** Employers often join several places in one string ("Austin, TX; San Jose, CA"): one entry per place. */
export function splitLocations(locations: readonly string[]): string[] {
  return locations
    .flatMap((l) => l.split(/\s*;\s*|\s+\|\s+/))
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "Cupertino, California, United States" -> "Cupertino, California, US". */
export function shortLocation(label: string): string {
  for (const [long, short] of Object.entries(COUNTRY_SUFFIX)) {
    if (label === long) return short;
    if (label.endsWith(`, ${long}`)) return `${label.slice(0, -long.length)}${short}`;
  }
  return label;
}

/** "$184,700"; other currencies use their ISO code in front. */
export function formatMoney(amount: number, currency: string | null): string {
  const n = Math.round(amount);
  const grouped = new Intl.NumberFormat('en-US').format(n);
  if (!currency || currency === 'USD') return `$${grouped}`;
  return `${currency} ${grouped}`;
}

/** "$185K": whole thousands. */
export function formatMoneyShort(amount: number, currency: string | null): string {
  const k = Math.round(amount / 1000);
  const body = new Intl.NumberFormat('en-US').format(k);
  if (!currency || currency === 'USD') return `$${body}K`;
  return `${currency} ${body}K`;
}

/** "$184,700 – $324,800 / year", or null when the posting lists no annual pay. */
export function salaryLabel(salary: JobSalary | null): string | null {
  if (!salary) return null;
  const { annualMin: lo, annualMax: hi, currency } = salary;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null && lo !== hi) return `${formatMoney(lo, currency)} – ${formatMoney(hi, currency)} / year`;
  return `${formatMoney((lo ?? hi) as number, currency)} / year`;
}

/** "$185K – $325K", for compact rows. */
export function salaryRangeShort(salary: JobSalary | null): string | null {
  if (!salary) return null;
  const { annualMin: lo, annualMax: hi, currency } = salary;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null && lo !== hi) return `${formatMoneyShort(lo, currency)} – ${formatMoneyShort(hi, currency)}`;
  return formatMoneyShort((lo ?? hi) as number, currency);
}
