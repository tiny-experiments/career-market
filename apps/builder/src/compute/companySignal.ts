import { addDays, FIRST_COMPARABLE_BASE, isBootstrapDay, RANGE_DAYS, type IsoDay } from '@cm/core/dates';
import type { CompanySignal } from '@cm/core/professions';
import type { Change } from '@cm/core/types';

/** One company's open roles in one family on one snapshot day (krill K2). */
export interface CompanyDay {
  date: IsoDay;
  open: number;
  new: number;
  closed: number;
}

export interface CompanyChange {
  change: Change;
  baseOpen: number;
  newSum: number;
  closedSum: number;
}

/**
 * 1W change of a company's open roles in a profession, from krill's company
 * statistics. Like every change it never uses a bootstrap day as the end of
 * the comparison: with less than a week of comparable days it is a partial
 * change since the first comparable day. Null when the company had no open
 * role on the base day (a new board adds roles that were already open).
 */
export function companyChange(days: readonly CompanyDay[], asOf: IsoDay): CompanyChange | null {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const end = sorted.find((d) => d.date === asOf);
  if (!end) return null;
  const target = addDays(asOf, -RANGE_DAYS['1W']);
  let base: CompanyDay | undefined;
  let partial = false;
  if (target >= FIRST_COMPARABLE_BASE) {
    base = [...sorted].reverse().find((d) => d.date <= target);
    if (base && base.date < FIRST_COMPARABLE_BASE) base = undefined;
  }
  if (!base) {
    base = sorted.find((d) => d.date === FIRST_COMPARABLE_BASE);
    partial = true;
  }
  if (!base || base.date >= asOf || base.open <= 0) return null;
  const flow = sorted.filter((d) => d.date > base.date && !isBootstrapDay(d.date));
  return {
    change: { range: '1W', value: end.open / base.open - 1, baseDate: base.date, partial, estimated: false },
    baseOpen: base.open,
    newSum: flow.reduce((n, d) => n + d.new, 0),
    closedSum: flow.reduce((n, d) => n + d.closed, 0),
  };
}

/**
 * Signal badge from the change in open roles: HOT from +10%, STRONG from +5%,
 * RISING from +1%, COOLING from -1% down, otherwise STEADY. No change, no badge.
 */
export function companySignal(change: Change | null): CompanySignal | null {
  if (!change) return null;
  const v = change.value;
  if (v >= 0.1) return 'HOT';
  if (v >= 0.05) return 'STRONG';
  if (v >= 0.01) return 'RISING';
  if (v <= -0.01) return 'COOLING';
  return 'STEADY';
}

/**
 * A company whose open roles move by more than half in under a week mostly
 * shows krill adding or losing one of its boards, not hiring: a new board adds
 * roles that were open long before. Such a change gets no signal and no number
 * (architecture report, risk "Coverage growth looks like hiring growth").
 */
export const COVERAGE_JUMP = 0.5;

export function isCoverageJump(change: Change | null): boolean {
  return change !== null && Math.abs(change.value) > COVERAGE_JUMP;
}
