import { addDays, type IsoDay } from '@cm/core/dates';
import { ageDensity, countInAges, type AgeCut } from './ageDistribution.ts';

/**
 * Survival-corrected back-cast (captain's choice, report section "Back-cast").
 *
 * krill knows the posted day of ~90% of open jobs. Jobs that opened in the
 * past and already closed are missing from today's open set; a survival curve
 * S(a) (share of postings still open a days after posting), measured from the
 * closings krill detects now, puts them back:
 *   N(x)     = open jobs posted on x / S(today - x)       (postings per day)
 *   open(d)  = sum over x <= d of N(x) * S(d - x)
 *   new(d)   = N(d)
 *   closed(d)= sum over x < d of N(x) * (S(d-1-x) - S(d-x))
 * Undated jobs (opened = first seen) are scaled in (1 / dated share) instead of
 * being placed on their first-seen day.
 */

export interface ClosingDay {
  day: IsoDay;
  /** Closings krill detected that day. */
  closed: number;
  /** Ages at close (closedAt - openedAt) of the sampled closings with a posted date. */
  datedAges: number[];
  /** Sampled closings without a posted date. */
  undated: number;
}

export interface SurvivalBucket {
  from: number;
  to: number;
  /** Daily closing rate of open jobs in this age bucket. */
  hazard: number;
  /** Sampled closings in the bucket. */
  closings: number;
  survivalEnd: number;
}

export interface SurvivalFit {
  buckets: SurvivalBucket[];
  /** S(a) for a = 0..maxAge. */
  survival: number[];
  sampled: number;
}

export const DEFAULT_AGE_EDGES = [7, 14, 21, 30, 45, 60, 90, 120, 150, 183, 270, 365];

export function fitSurvival(input: {
  datedCuts: readonly AgeCut[];
  closingDays: readonly ClosingDay[];
  edges?: readonly number[];
  maxAge?: number;
  minSamplesPerBucket?: number;
  minSamples?: number;
}): SurvivalFit | null {
  const edges = input.edges ?? DEFAULT_AGE_EDGES;
  const maxAge = input.maxAge ?? (edges.at(-1) as number);
  const minPerBucket = input.minSamplesPerBucket ?? 5;
  const days = input.closingDays.filter((d) => d.datedAges.length + d.undated > 0);
  const sampled = days.reduce((n, d) => n + d.datedAges.length, 0);
  if (days.length === 0 || sampled < (input.minSamples ?? 30)) return null;

  // Base buckets [0, e0], [e0+1, e1], ...
  type Acc = { from: number; to: number; sampled: number; closings: number; exposure: number };
  let buckets: Acc[] = [];
  let from = 0;
  for (const to of edges) {
    if (to > maxAge) break;
    buckets.push({ from, to, sampled: 0, closings: 0, exposure: 0 });
    from = to + 1;
  }
  for (const d of days) {
    const n = d.datedAges.length + d.undated;
    for (const age of d.datedAges) {
      const b = buckets.find((x) => age >= x.from && age <= x.to);
      if (!b) continue;
      b.sampled += 1;
      b.closings += d.closed / n;
    }
  }
  for (const b of buckets) b.exposure = countInAges(input.datedCuts, b.from, b.to, maxAge) * days.length;

  // Pool thin buckets with their neighbour so every hazard rests on enough closings.
  const pooled: Acc[] = [];
  for (const b of buckets) {
    const last = pooled.at(-1);
    if (last && last.sampled < minPerBucket) {
      last.to = b.to;
      last.sampled += b.sampled;
      last.closings += b.closings;
      last.exposure += b.exposure;
    } else pooled.push({ ...b });
  }
  const tail = pooled.at(-1);
  if (pooled.length > 1 && tail && tail.sampled < minPerBucket) {
    const prev = pooled[pooled.length - 2] as Acc;
    prev.to = tail.to;
    prev.sampled += tail.sampled;
    prev.closings += tail.closings;
    prev.exposure += tail.exposure;
    pooled.pop();
  }
  buckets = pooled;

  const survival = new Array<number>(maxAge + 1).fill(1);
  let cum = 0;
  const out: SurvivalBucket[] = [];
  for (const b of buckets) {
    const hazard = b.exposure > 0 ? Math.min(1, b.closings / b.exposure) : 0;
    for (let a = Math.max(1, b.from); a <= b.to; a++) {
      cum += hazard;
      survival[a] = Math.exp(-cum);
    }
    out.push({ from: b.from, to: b.to, hazard, closings: b.sampled, survivalEnd: survival[b.to] as number });
  }
  return { buckets: out, survival, sampled };
}

export interface BackcastDay {
  date: IsoDay;
  open: number;
  new: number;
  closed: number;
}

export function backcast(input: {
  asOf: IsoDay;
  datedCuts: readonly AgeCut[];
  /** Open jobs with a posted date. */
  datedTotal: number;
  /** All open jobs (dated and undated). */
  totalOpen: number;
  survival: readonly number[];
  /** How many days before asOf to estimate. */
  days: number;
  /** S is floored here so very old postings cannot explode N(x). */
  survivalFloor?: number;
}): BackcastDay[] {
  const maxAge = input.survival.length - 1;
  if (input.datedTotal <= 0) return [];
  const scale = input.totalOpen / input.datedTotal;
  const floor = input.survivalFloor ?? 0.05;
  const S = (a: number) => (a < 0 ? 0 : Math.max(floor, input.survival[Math.min(a, maxAge)] as number));
  // Steady postings inside each cut bucket: spread its jobs in proportion to S(age).
  const density = ageDensity(input.datedCuts, maxAge, (a) => input.survival[a] as number);
  const datedYoung = density.reduce((n, v) => n + v, 0);
  // Jobs older than maxAge are long-lived postings: assume they were open throughout.
  const old = Math.max(0, input.datedTotal - datedYoung) * scale;

  // postings[k] = N(asOf - k) for k = 0..maxAge
  const postings = density.map((count, age) => (count * scale) / S(age));

  const out: BackcastDay[] = [];
  for (let back = input.days; back >= 0; back--) {
    const date = addDays(input.asOf, -back);
    let open = old;
    let closed = 0;
    // Postings x with age at asOf = k, i.e. x = asOf - k; they exist on date d when k >= back.
    for (let k = back; k <= maxAge; k++) {
      const n = postings[k] as number;
      const ageOnD = k - back;
      open += n * S(ageOnD);
      if (ageOnD >= 1) closed += n * (S(ageOnD - 1) - S(ageOnD));
    }
    out.push({ date, open, new: postings[back] ?? 0, closed });
  }
  return out;
}
