/**
 * Company page payloads and the small helpers the builder, the read API and the
 * web app share. Plain JSON: numbers, strings, ISO days.
 */
import { addDays, FIRST_OBSERVED_DAY, isBootstrapDay, type IsoDay } from './dates.ts';
import type { Change, Unavailable } from './types.ts';

export type CompanySignalState = 'RAMPING' | 'STEADY' | 'COOLING' | 'FREEZING';

/** "NVIDIA Corp." -> "nvidia-corp"; never empty. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'company';
}

/** Skill groups of the Tech stack profile, by krill skill namespace. */
export const STACK_GROUPS = [
  { id: 'languages', label: 'Languages', namespaces: ['lang'], max: 4 },
  { id: 'domains', label: 'Domains', namespaces: ['domain'], max: 4 },
  { id: 'platform', label: 'Platform', namespaces: ['os', 'infra', 'cloud'], max: 4 },
  { id: 'ai', label: 'AI', namespaces: ['ml'], max: 4 },
] as const;
export type StackGroupId = (typeof STACK_GROUPS)[number]['id'];

/** Seniority levels from the highest to the lowest, as the donut and its legend list them. */
export const LEVEL_ORDER = ['executive', 'director', 'principal', 'staff', 'senior', 'manager', 'mid', 'junior', 'intern'] as const;
/** Levels that count as "Senior+" in the donut caption. */
export const SENIOR_PLUS = new Set(['senior', 'staff', 'principal', 'director', 'executive']);

export interface CompanyRef {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
}

export interface CompanySignal {
  state: CompanySignalState;
  /** Days inside the window the signal covers (30 at most). */
  windowDays: number;
  windowFrom: IsoDay;
  /** The window is shorter than 30 days: history is still short. */
  partial: boolean;
  opened: number;
  closed: number;
  /** opened / closed; null when nothing closed. */
  ratio: number | null;
  /** Change of open roles over the window. */
  change: Change | null;
}

export interface CompanyTrendPoint {
  date: IsoDay;
  open: number;
  /** krill "new": jobs first seen that day. */
  opened: number;
  closed: number;
  /** krill bootstrap day or the first fetch of this company's board: flows are not real hiring. */
  excluded: boolean;
}

export interface CompanyTeam {
  family: string;
  name: string;
  open: number;
  change: Change | null;
  spark: number[];
}

export interface CountValue {
  value: string;
  label: string;
  count: number;
}

export interface CompanyPeer {
  slug: string;
  name: string;
  domain: string | null;
  open: number;
  change: Change | null;
  spark: number[];
}

export interface CompanyProfileBlock {
  total: number;
  /** Open roles that name a skill, grouped like the Tech stack profile. */
  stack: { id: StackGroupId; label: string; items: CountValue[] }[];
  /** Placed in a country (a role can name several), largest first. */
  countries: (CountValue & { code: string })[];
  remote: number | null;
  levels: CountValue[];
  medianDaysOpen: number | null;
}

export interface CompanyPage {
  asOf: IsoDay;
  builtAt: string;
  company: CompanyRef & { careersUrl: string | null; open: number; rank: number };
  /** Profiled companies get facets, a board url and a median age; the others show an honest empty state. */
  profiled: boolean;
  signal: CompanySignal | null;
  /** One rule-written sentence about the window. */
  explainer: string;
  series: CompanyTrendPoint[];
  firstObservedDay: IsoDay;
  /** Openings and closings over the signal window. */
  flow: { opened: number; closed: number; windowDays: number; since: IsoDay } | null;
  teams: CompanyTeam[];
  profile: CompanyProfileBlock | Unavailable;
  /** Profession and country filter options for the Current roles list. */
  roleFilters: { professions: CountValue[]; countries: CountValue[]; remote: number | null };
  peers: CompanyPeer[] | Unavailable;
}

export interface CompanyJob {
  id: string;
  title: string;
  team: string | null;
  location: string;
  workMode: 'onsite' | 'hybrid' | 'remote' | null;
  level: string | null;
  ageDays: number;
  url: string;
}

export type CompanyJobsPayload =
  | { available: true; total: number; items: CompanyJob[] }
  | Unavailable;

export interface CompanyMover {
  slug: string;
  name: string;
  domain: string | null;
  open: number;
  change: Change | null;
  spark: number[];
}

export interface CompanyDirectoryRow extends CompanyMover {
  rank: number;
  state: CompanySignalState | null;
}

/** Said under the chart while no comparable day exists. */
export const EXPLAINER_NO_SIGNAL =
  'Needs a few more comparable days: krill counted every role on 2 and 3 Nov as new, so those days are left out.';

export interface DayRow {
  date: IsoDay;
  open: number;
  /** krill "new": jobs first seen (or seen again) that day. */
  new: number;
  closed: number;
}

export interface SeriesDay extends DayRow {
  /**
   * Not real hiring: krill's bootstrap days, days before the company's board
   * was first fetched, and the first fetch itself (every job is "new").
   */
  excluded: boolean;
}

export interface CompanySeries {
  days: SeriesDay[];
  /** First day of the company's current fetch segment; its earlier days hold no comparable data. */
  segmentStart: IsoDay | null;
}

/** A day this large against the day before is a board event (a board added, fetched in bulk, or dropped), not hiring. */
export const BOARD_EVENT = { minRoles: 50, newShare: 0.1, closedShare: 0.25 } as const;

export function isBoardEvent(r: DayRow, prevOpen: number): boolean {
  if (prevOpen <= 0) return false;
  return (
    (r.new >= BOARD_EVENT.minRoles && r.new >= BOARD_EVENT.newShare * prevOpen) ||
    (r.closed >= BOARD_EVENT.minRoles && r.closed >= BOARD_EVENT.closedShare * prevOpen)
  );
}

/**
 * One company's daily rows as a gap-free series from the first observed day to
 * `to`. krill sends no row for a quiet company-day, so a missing day means 0.
 * A segment restarts whenever open roles go from 0 to something, or a day is a
 * board event (see isBoardEvent): a board fetched for the first time, or one that
 * came back or was dropped, moves hundreds of roles at once, and that day is not
 * hiring.
 */
export function companySeries(rows: readonly DayRow[], to: IsoDay, from: IsoDay = FIRST_OBSERVED_DAY): CompanySeries {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const days: SeriesDay[] = [];
  let segmentStart: IsoDay | null = null;
  let prevOpen = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = byDate.get(d) ?? { date: d, open: 0, new: 0, closed: 0 };
    const starts = (r.open > 0 && prevOpen === 0) || isBoardEvent(r, prevOpen);
    if (starts) segmentStart = d;
    const excluded = isBootstrapDay(d) || segmentStart === null || starts;
    days.push({ ...r, excluded });
    prevOpen = r.open;
  }
  // A segment that ended (open fell to 0) stays the current one only while it still has open roles.
  const last = days.at(-1);
  if (!last || last.open === 0) segmentStart = null;
  return { days, segmentStart };
}

