import { isTileSkill } from '@cm/core/codes';
import { FIRST_COMPARABLE_BASE } from '@cm/core/dates';
import { companySignal, skillSlug, slugify, type GrowthState } from '@cm/core/screener';

/** How many companies the Screener lists, and how many skills get their own work-mode and profession counts. */
export const SCREENER_COMPANIES = 150;
export const SCREENER_SKILLS = 60;
/** Company history the sparklines and signals cover. */
export const COMPANY_HISTORY_DAYS = 30;

export interface WorkModeCounts {
  remote: number;
  hybrid: number;
  onsite: number;
}

/** Work-mode counts from a facet list; roles that state no mode are not counted anywhere. */
export function workModeCounts(list: readonly { value: string; count: number }[]): WorkModeCounts {
  const get = (v: string) => list.find((x) => x.value === v)?.count ?? 0;
  return { remote: get('remote'), hybrid: get('hybrid'), onsite: get('onsite') };
}

/** The three largest tool-like skills of a facet list (no "concept:" or "practice:" tags). */
export function topSkillIds(list: readonly { value: string; count: number }[], n = 3): string[] {
  return list.filter((s) => isTileSkill(s.value)).slice(0, n).map((s) => s.value);
}

/** The largest value of a facet list (a profession family). */
export function topValue(list: readonly { value: string; count: number }[]): { value: string; count: number } | null {
  return list[0] ?? null;
}

/** Unique page slugs for companies: the name, then the name and the id tail on a clash. */
export function companySlugs(rows: readonly { id: string; name: string }[]): Map<string, string> {
  const taken = new Set<string>();
  const out = new Map<string, string>();
  for (const r of rows) {
    const base = slugify(r.name) || 'company';
    let slug = base;
    if (taken.has(slug)) slug = `${base}-${r.id.slice(-4)}`;
    taken.add(slug);
    out.set(r.id, slug);
  }
  return out;
}

/** Unique page slugs for skills (see skillSlug). */
export function skillSlugs(ids: readonly string[]): Map<string, string> {
  const taken = new Set<string>();
  const out = new Map<string, string>();
  for (const id of ids) {
    const slug = skillSlug(id, taken);
    taken.add(slug);
    out.set(id, slug);
  }
  return out;
}

export interface DayValue {
  date: string;
  open: number;
}

/**
 * Signal of a company from its daily open roles. krill's bootstrap days (2-3
 * Nov) never count: the window starts at the first comparable base day, and
 * `days` is the number of comparable days after it. Needs MIN_SIGNAL_DAYS of
 * them; the window is all history held (at most COMPANY_HISTORY_DAYS).
 */
export function signalFor(series: readonly DayValue[]): { signal: GrowthState | null; days: number } {
  const window = series.filter((s) => s.date >= FIRST_COMPARABLE_BASE);
  const days = Math.max(0, window.length - 1);
  const first = window[0];
  const last = window[window.length - 1];
  if (!first || !last || first.open <= 0 || days === 0) return { signal: null, days };
  return { signal: companySignal(last.open / first.open - 1, days), days };
}
