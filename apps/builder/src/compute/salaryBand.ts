export interface PaidJob {
  annualMin?: number | null | undefined;
  annualMax?: number | null | undefined;
  currency?: string | null | undefined;
}

export interface SalaryBand {
  n: number;
  p25: number;
  p50: number;
  p75: number;
}

/** Midpoint of the listed annual range (either end alone when only one is given). */
export function payMidpoint(job: PaidJob): number | null {
  const { annualMin: lo, annualMax: hi } = job;
  const a = typeof lo === 'number' && lo > 0 ? lo : null;
  const b = typeof hi === 'number' && hi > 0 ? hi : null;
  if (a !== null && b !== null) return (a + b) / 2;
  return a ?? b;
}

/** Linear-interpolated percentile (p in 0..1) of a sorted list. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

/**
 * p25 to p75 of the listed pay midpoint, in one currency. Null when fewer than
 * `minN` roles list pay: a band from a handful of postings says nothing (report: n >= 30).
 */
export function salaryBand(jobs: readonly PaidJob[], currency: string, minN = 30): SalaryBand | null {
  const mids = jobs
    .filter((j) => (j.currency ?? currency) === currency)
    .map(payMidpoint)
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  if (mids.length < minN) return null;
  return {
    n: mids.length,
    p25: Math.round(percentile(mids, 0.25)),
    p50: Math.round(percentile(mids, 0.5)),
    p75: Math.round(percentile(mids, 0.75)),
  };
}
