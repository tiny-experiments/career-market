import { daysBetween, type IsoDay } from '@cm/core/dates';
import type { AgeCut } from './ageDistribution.ts';
import { backcast } from './backcast.ts';

/** Posted-day cuts the skill back-cast asks krill for (days before the snapshot day). */
export const SKILL_AGE_EDGES = [7, 14, 30, 60, 90, 120, 183, 270, 365] as const;

/** krill answers "posted on or after 1970-01-01" with every dated role. */
export const POSTED_EVER = '1970-01-01';

/** How far the skill back-cast reaches before today (the survival curve is reliable to about 6 months). */
export const SKILL_BACKCAST_DAYS = 183;

/** A stored survival bucket (survival_curve row). */
export interface StoredBucket {
  age_from: number;
  age_to: number;
  hazard: number;
}

/**
 * Rebuild S(a) from the buckets the market build stored: each bucket applies
 * its daily hazard to every age inside it, exactly as fitSurvival does.
 */
export function survivalFromBuckets(buckets: readonly StoredBucket[]): number[] {
  const sorted = [...buckets].sort((a, b) => a.age_from - b.age_from);
  const maxAge = sorted.at(-1)?.age_to ?? 0;
  const survival = new Array<number>(maxAge + 1).fill(1);
  let cum = 0;
  for (const b of sorted) {
    for (let a = Math.max(1, b.age_from); a <= b.age_to; a++) {
      cum += b.hazard;
      survival[a] = Math.exp(-cum);
    }
  }
  return survival;
}

export interface SkillCutRow {
  family: string;
  cut_date: IsoDay;
  count: number;
}

/** Cuts of one scope ('*' or a family) as age cuts, oldest cut last. */
export function cutsForScope(rows: readonly SkillCutRow[], scope: string, T: IsoDay): { cuts: AgeCut[]; datedTotal: number } {
  const dated = new Map<IsoDay, number>();
  for (const r of rows) if (r.family === scope) dated.set(r.cut_date, r.count);
  const datedTotal = dated.get(POSTED_EVER) ?? 0;
  const cuts: AgeCut[] = [];
  for (const [cutDate, count] of dated) {
    if (cutDate === POSTED_EVER) continue;
    cuts.push({ age: daysBetween(cutDate, T), countLE: count });
  }
  cuts.sort((a, b) => a.age - b.age);
  return { cuts, datedTotal };
}

export interface EstimateInput {
  asOf: IsoDay;
  cuts: readonly AgeCut[];
  datedTotal: number;
  /** Roles in the scope today (dated and undated). */
  totalOpen: number;
  survival: readonly number[];
  /** First day with an observed count; estimated rows stop the day before. */
  firstObserved: IsoDay;
  /** The observed count on the snapshot day; the estimate is scaled to meet it. */
  observedToday: number;
}

/**
 * Survival-corrected back-cast of one skill (report section "Back-cast", step 6):
 * the same method as the market line, run over the posted days of the open
 * roles that name the skill. Null when the inputs are too thin to trust.
 */
export function estimateSkillHistory(input: EstimateInput): { date: IsoDay; open: number }[] | null {
  if (input.cuts.length < 4 || input.datedTotal <= 0 || input.totalOpen <= 0 || input.survival.length < 8) return null;
  const all = backcast({
    asOf: input.asOf,
    datedCuts: input.cuts,
    datedTotal: input.datedTotal,
    totalOpen: input.totalOpen,
    survival: input.survival,
    days: Math.min(SKILL_BACKCAST_DAYS, input.survival.length - 1),
  });
  const today = all.find((d) => d.date === input.asOf);
  if (!today || today.open <= 0) return null;
  const calibration = input.observedToday / today.open;
  return all
    .filter((d) => d.date < input.firstObserved)
    .map((d) => ({ date: d.date, open: Math.max(0, Math.round(d.open * calibration)) }));
}

export interface SeriesRow {
  date: IsoDay;
  open: number;
  estimated: boolean;
}

/** Estimated days first, then observed days; an estimate never overlaps an observed day. */
export function mergeSeries(estimated: readonly { date: IsoDay; open: number }[], observed: ReadonlyMap<IsoDay, number>): SeriesRow[] {
  const days = [...observed.keys()].sort();
  const firstObserved = days[0];
  const out: SeriesRow[] = estimated
    .filter((e) => firstObserved === undefined || e.date < firstObserved)
    .map((e) => ({ date: e.date, open: e.open, estimated: true }));
  for (const d of days) out.push({ date: d, open: observed.get(d) as number, estimated: false });
  return out;
}
