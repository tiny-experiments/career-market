/** A role with listed pay, as the salary sample keeps it. */
export interface PricedRole {
  skills: readonly string[];
  /** Annual pay range in one currency. */
  annualMin: number;
  annualMax: number | null;
}

/** Each side of the comparison needs this many priced roles before a median is shown. */
export const MIN_SALARY_SIDE = 50;

export function midpoint(role: Pick<PricedRole, 'annualMin' | 'annualMax'>): number {
  return role.annualMax === null ? role.annualMin : (role.annualMin + role.annualMax) / 2;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export interface SalaryComparison {
  nWith: number;
  nWithout: number;
  medianWith: number | null;
  medianWithout: number | null;
}

/**
 * Median listed pay of roles naming `skill` against the other roles in the
 * sample (the same profession, country and currency). A median is null when
 * its side has fewer than MIN_SALARY_SIDE roles: a handful of salaries says
 * nothing about a skill.
 */
export function compareSalaries(sample: readonly PricedRole[], skill: string, minSide = MIN_SALARY_SIDE): SalaryComparison {
  const withSkill: number[] = [];
  const without: number[] = [];
  for (const role of sample) (role.skills.includes(skill) ? withSkill : without).push(midpoint(role));
  const enough = withSkill.length >= minSide && without.length >= minSide;
  return {
    nWith: withSkill.length,
    nWithout: without.length,
    medianWith: enough ? median(withSkill) : null,
    medianWithout: enough ? median(without) : null,
  };
}
