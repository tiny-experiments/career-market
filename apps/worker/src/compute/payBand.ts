import { MIN_BAND_N, payMidpoint, percentile } from '@cm/core/job';
import type { KrillJob } from '@cm/core/krillJob';

/**
 * Pay bands for "Salary vs. band" on the Job page. krill has no percentile
 * endpoint yet (K5), so the band is the 25th/50th/75th percentile of the
 * annualised pay midpoint of a sample of open roles that list pay, per
 * profession and seniority. Only US roles priced in USD are sampled: that is
 * where pay is listed often enough (about 46% of US roles) to say anything.
 */

/** Listed pay outside this range is a data error (a wrong period or currency), not a salary. */
export const MIN_ANNUAL_PAY = 20_000;
export const MAX_ANNUAL_PAY = 1_500_000;

export interface PaySample {
  companyId: string;
  family: string;
  specialty: string | null;
  level: string | null;
  midpoint: number;
}

export interface PayBandRow {
  family: string;
  specialty: string;
  level: string;
  n: number;
  p25: number;
  p50: number;
  p75: number;
}

/** A sampled role as a pay point, or null when the role lists no usable annual pay. */
export function toPaySample(job: KrillJob): PaySample | null {
  if (!job.family || !job.salary || job.salary.currency !== 'USD') return null;
  const midpoint = payMidpoint(job.salary.annualMin, job.salary.annualMax);
  if (midpoint === null || midpoint < MIN_ANNUAL_PAY || midpoint > MAX_ANNUAL_PAY) return null;
  return { companyId: job.company.id, family: job.family, specialty: job.specialty, level: job.level, midpoint };
}

/**
 * One company posting the same role many times (the same pay range in every city) would
 * decide the band alone. Each company counts once per profession, specialty, seniority and
 * pay midpoint.
 */
export function dedupeSamples(samples: readonly PaySample[]): PaySample[] {
  const seen = new Set<string>();
  return samples.filter((s) => {
    const key = `${s.companyId}|${s.family}|${s.specialty ?? ''}|${s.level ?? ''}|${s.midpoint}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Bands at three grains: profession, profession + seniority and
 * profession + specialty + seniority. A grain with fewer than `minN` roles
 * gets no band.
 */
export function computePayBands(samples: readonly PaySample[], minN = MIN_BAND_N): PayBandRow[] {
  const groups = new Map<string, { row: Pick<PayBandRow, 'family' | 'specialty' | 'level'>; values: number[] }>();
  const add = (family: string, specialty: string, level: string, value: number) => {
    const key = `${family}|${specialty}|${level}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { row: { family, specialty, level }, values: [] }));
    g.values.push(value);
  };
  for (const s of dedupeSamples(samples)) {
    add(s.family, '', '', s.midpoint);
    if (s.level) add(s.family, '', s.level, s.midpoint);
    if (s.level && s.specialty) add(s.family, s.specialty, s.level, s.midpoint);
  }
  const rows: PayBandRow[] = [];
  for (const { row, values } of groups.values()) {
    if (values.length < minN) continue;
    values.sort((a, b) => a - b);
    rows.push({ ...row, n: values.length, p25: percentile(values, 0.25), p50: percentile(values, 0.5), p75: percentile(values, 0.75) });
  }
  return rows.sort((a, b) => a.family.localeCompare(b.family) || a.specialty.localeCompare(b.specialty) || a.level.localeCompare(b.level));
}
