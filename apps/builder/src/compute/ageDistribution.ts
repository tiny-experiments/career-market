/**
 * Open jobs by age, from krill facet totals at cut dates: countLE(a) is the
 * number of open jobs with age <= a days (opened or posted on or after
 * asOf - a). The distribution is piecewise uniform between cuts.
 */
export interface AgeCut {
  age: number;
  countLE: number;
}

export function sortCuts(cuts: readonly AgeCut[]): AgeCut[] {
  return [...cuts].sort((a, b) => a.age - b.age);
}

/** Median age in days (linear inside the cut that holds the middle job). */
export function medianAge(cuts: readonly AgeCut[], total: number): number | null {
  if (total <= 0) return null;
  const sorted = sortCuts(cuts);
  const half = total / 2;
  let prevAge = -1;
  let prevCount = 0;
  for (const cut of sorted) {
    if (cut.countLE >= half) {
      const span = cut.countLE - prevCount;
      const frac = span > 0 ? (half - prevCount) / span : 1;
      // Ages are whole days; a bucket (prevAge, age] holds age - prevAge days.
      return Math.max(0, prevAge + frac * (cut.age - prevAge));
    }
    prevAge = cut.age;
    prevCount = cut.countLE;
  }
  return null;
}

/**
 * Jobs per single age 0..maxAge. Inside each cut bucket the count is spread
 * evenly, or in proportion to `weight(age)` when given (the back-cast passes
 * the survival curve, which assumes steady postings inside a bucket).
 */
export function ageDensity(cuts: readonly AgeCut[], maxAge: number, weight?: (age: number) => number): number[] {
  const sorted = sortCuts(cuts).filter((c) => c.age <= maxAge);
  const density = new Array<number>(maxAge + 1).fill(0);
  let prevAge = -1;
  let prevCount = 0;
  for (const cut of sorted) {
    const count = Math.max(0, cut.countLE - prevCount);
    let total = 0;
    for (let a = prevAge + 1; a <= cut.age; a++) total += weight ? weight(a) : 1;
    for (let a = prevAge + 1; a <= cut.age; a++) density[a] = total > 0 ? (count * (weight ? weight(a) : 1)) / total : 0;
    prevAge = cut.age;
    prevCount = cut.countLE;
  }
  return density;
}

/** Count of jobs in ages (from-1, to], from the cuts (interpolated). */
export function countInAges(cuts: readonly AgeCut[], from: number, to: number, maxAge: number): number {
  const d = ageDensity(cuts, maxAge);
  let n = 0;
  for (let a = Math.max(0, from); a <= Math.min(to, maxAge); a++) n += d[a] ?? 0;
  return n;
}
