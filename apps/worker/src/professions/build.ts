import { daysBetween, FIRST_OBSERVED_DAY, RANGES, type IsoDay } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import type { Change } from '@cm/core/types';
import type { AgeCut } from '../compute/ageDistribution.ts';
import { medianAge } from '../compute/ageDistribution.ts';
import { backcast, type SurvivalFit } from '../compute/backcast.ts';
import { computeChange, type ValuePoint } from '../compute/changes.ts';
import { companyChange, companySignal, isCoverageChange, type CompanyDay } from '../compute/companySignal.ts';
import { salaryBand } from '../compute/salaryBand.ts';
import type { KrillJobItem } from '../krill/schemas.ts';
import { POSTED_EVER, type ProfessionInputs } from './pull.ts';

/** How far the family back-cast reaches before today (same as the market back-cast). */
const BACKCAST_DAYS = 183;

async function insertRows(tx: Sql, table: string, rows: Record<string, unknown>[], columns: string[]): Promise<void> {
  const chunk = Math.max(1, Math.floor(60_000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + chunk) as never, ...(columns as never[]))}`;
  }
}

/** Raw per-family age cuts, as krill served them (rebuildable). */
export async function writeProfessionInputs(tx: Sql, T: IsoDay, inputs: ProfessionInputs): Promise<void> {
  await tx`delete from family_age_cut where snapshot_date = ${T}`;
  await insertRows(
    tx,
    'family_age_cut',
    inputs.cuts.map((c) => ({ snapshot_date: T, family: c.family, kind: c.kind, cut_date: c.cutDate, count: c.count })),
    ['snapshot_date', 'family', 'kind', 'cut_date', 'count'],
  );
}

export interface ProfessionContext {
  T: IsoDay;
  /** The fitted survival curve, or null before enough closings are sampled. */
  fit: SurvivalFit | null;
  log: Logger;
}

/**
 * Derived tables of the Profession page, from the stored inputs and the
 * family series the market build wrote: family back-cast and changes, work
 * mode, pay band, top companies with their signal, latest roles.
 */
export async function computeProfessions(
  tx: Sql,
  inputs: ProfessionInputs,
  ctx: ProfessionContext,
): Promise<Record<string, unknown>> {
  const { T, fit, log } = ctx;

  // 1. Family series on today's boards, then the back-cast before the first observed day.
  type FamilyRow = { date: IsoDay; family: string; open: number; index_value: number };
  const famRows = await tx<FamilyRow[]>`
    select date, family, open, index_value from family_daily where date <= ${T} order by date`;
  const byFamily = new Map<string, FamilyRow[]>();
  for (const r of famRows) {
    const list = byFamily.get(r.family);
    if (list) list.push(r);
    else byFamily.set(r.family, [r]);
  }

  await tx`delete from family_estimate_daily`;
  const estimateRows: Record<string, unknown>[] = [];
  const changeRows: Record<string, unknown>[] = [];
  let backcastFamilies = 0;

  for (const [family, rows] of byFamily) {
    const today = rows.find((r) => r.date === T);
    if (!today || today.index_value <= 0) continue;
    // Observed open roles on today's boards: today's count scaled by the chain-linked index.
    const observed: ValuePoint[] = rows.map((r) => ({
      date: r.date,
      value: (today.open * r.index_value) / today.index_value,
      estimated: false,
    }));

    const estimate = estimateFamily(inputs, family, T, today.open, fit, observed.find((o) => o.date === FIRST_OBSERVED_DAY)?.value);
    if (estimate) {
      backcastFamilies += 1;
      for (const d of estimate) {
        estimateRows.push({
          date: d.date,
          family,
          open: Math.round(d.open),
          opened: Math.round(d.new),
          closed: Math.round(d.closed),
        });
      }
    }
    const series: ValuePoint[] = [
      ...(estimate ?? []).map((d) => ({ date: d.date, value: d.open, estimated: true })),
      ...observed,
    ];
    for (const range of RANGES) {
      const c = computeChange(series, T, range);
      if (c) changeRows.push(changeRow(T, `family:${family}`, c));
    }
  }
  await insertRows(tx, 'family_estimate_daily', estimateRows, ['date', 'family', 'open', 'opened', 'closed']);
  // The market build wrote observed-only family changes; these add the estimated base for 1M and longer.
  await tx`delete from market_change where as_of = ${T} and subject like 'family:%'`;
  await insertRows(tx, 'market_change', changeRows, ['as_of', 'subject', 'range', 'base_date', 'change', 'partial', 'estimated']);

  // 2. One snapshot row per family.
  await tx`delete from profession_snapshot where date = ${T}`;
  const snapshotRows: Record<string, unknown>[] = [];
  for (const family of byFamily.keys()) {
    const familyOpen = byFamily.get(family)?.find((r) => r.date === T)?.open ?? 0;
    const modes = inputs.workModes.get(family);
    const opened = cutsFor(inputs, family, 'opened', T);
    const band = salaryBand((inputs.salaryJobs.get(family) ?? []).map((j) => j.salary ?? {}), 'USD');
    snapshotRows.push({
      date: T,
      family,
      companies: inputs.companyCount.get(family) ?? null,
      median_days_open: medianAge(opened, familyOpen),
      remote: modes?.remote ?? null,
      hybrid: modes?.hybrid ?? null,
      onsite: modes?.onsite ?? null,
      work_mode_total: modes?.total ?? null,
      salary_n: band?.n ?? null,
      salary_p25: band?.p25 ?? null,
      salary_p50: band?.p50 ?? null,
      salary_p75: band?.p75 ?? null,
      salary_currency: band ? 'USD' : null,
      salary_scope: band ? `US, senior, newest ${band.n} roles with listed pay` : null,
    });
  }
  await insertRows(tx, 'profession_snapshot', snapshotRows, [
    'date', 'family', 'companies', 'median_days_open', 'remote', 'hybrid', 'onsite', 'work_mode_total',
    'salary_n', 'salary_p25', 'salary_p50', 'salary_p75', 'salary_currency', 'salary_scope',
  ]);

  // 3. Top hiring companies with change and signal.
  await tx`delete from profession_company where date = ${T}`;
  const companyRows: Record<string, unknown>[] = [];
  for (const [family, top] of inputs.topCompanies) {
    top.forEach((c, i) => {
      const info = inputs.companyInfo.get(c.companyId);
      const days: CompanyDay[] = (inputs.companyHistory.get(c.companyId) ?? [])
        .filter((r) => r.family === family)
        .map((r) => ({ date: r.date, open: r.open, new: r.new, closed: r.closed }));
      const ch = companyChange(days, T);
      const jump = isCoverageChange(ch);
      companyRows.push({
        date: T,
        family,
        rank: i + 1,
        company_id: c.companyId,
        name: info?.name ?? c.companyId,
        domain: info?.domain ?? null,
        open: c.open,
        base_date: ch?.change.baseDate ?? null,
        base_open: ch?.baseOpen ?? null,
        change: jump ? null : (ch?.change.value ?? null),
        coverage_jump: jump,
        partial: ch?.change.partial ?? false,
        new_sum: ch?.newSum ?? null,
        closed_sum: ch?.closedSum ?? null,
        signal: jump ? null : companySignal(ch?.change ?? null),
      });
    });
  }
  await insertRows(tx, 'profession_company', companyRows, [
    'date', 'family', 'rank', 'company_id', 'name', 'domain', 'open', 'base_date', 'base_open', 'change', 'coverage_jump', 'partial',
    'new_sum', 'closed_sum', 'signal',
  ]);

  // 4. Newest roles.
  await tx`delete from profession_latest_role where date = ${T}`;
  const roleRows: Record<string, unknown>[] = [];
  for (const [family, jobs] of inputs.latestRoles) {
    jobs.forEach((j, i) => {
      roleRows.push({
        date: T,
        family,
        rank: i + 1,
        job_id: j.id,
        title: j.title,
        company_id: j.company.id,
        company_name: j.company.name,
        company_domain: inputs.companyInfo.get(j.company.id)?.domain ?? null,
        location: locationOf(j),
        work_mode: workModeOf(j.workMode),
        salary_text: salaryText(j),
        opened_on: j.openedAt,
      });
    });
  }
  await insertRows(tx, 'profession_latest_role', roleRows, [
    'date', 'family', 'rank', 'job_id', 'title', 'company_id', 'company_name', 'company_domain', 'location',
    'work_mode', 'salary_text', 'opened_on',
  ]);

  const stats = {
    professionBackcastFamilies: backcastFamilies,
    professionCompanies: companyRows.length,
    professionLatestRoles: roleRows.length,
    professionSalaryBands: snapshotRows.filter((r) => r.salary_n !== null).length,
    professionPullFailures: inputs.failed,
  };
  log.info(stats, 'profession tables written');
  return stats;
}

function cutsFor(inputs: ProfessionInputs, family: string, kind: 'opened' | 'posted', T: IsoDay): AgeCut[] {
  return inputs.cuts
    .filter((c) => c.family === family && c.kind === kind && c.cutDate !== POSTED_EVER)
    .map((c) => ({ age: daysBetween(c.cutDate, T), countLE: c.count }));
}

/**
 * Survival-corrected back-cast of one family with the market's fitted survival
 * curve (one curve for every family: per-family curves need more closings than
 * krill has sampled). Scaled so the estimate meets the first observed point.
 */
function estimateFamily(
  inputs: ProfessionInputs,
  family: string,
  T: IsoDay,
  openToday: number,
  fit: SurvivalFit | null,
  firstObserved: number | undefined,
): { date: IsoDay; open: number; new: number; closed: number }[] | null {
  if (!fit || firstObserved === undefined || openToday <= 0) return null;
  const datedCuts = cutsFor(inputs, family, 'posted', T);
  const datedTotal = inputs.cuts.find((c) => c.family === family && c.kind === 'posted' && c.cutDate === POSTED_EVER)?.count;
  if (datedCuts.length < 4 || !datedTotal) return null;
  const all = backcast({
    asOf: T,
    datedCuts,
    datedTotal,
    totalOpen: openToday,
    survival: fit.survival,
    days: Math.min(BACKCAST_DAYS, fit.survival.length - 1),
  });
  const atFirst = all.find((d) => d.date === FIRST_OBSERVED_DAY);
  const calibration = atFirst && atFirst.open > 0 ? firstObserved / atFirst.open : 1;
  return all
    .filter((d) => d.date < FIRST_OBSERVED_DAY)
    .map((d) => ({ date: d.date, open: d.open * calibration, new: d.new * calibration, closed: d.closed * calibration }));
}

function changeRow(T: IsoDay, subject: string, c: Change): Record<string, unknown> {
  return {
    as_of: T,
    subject,
    range: c.range,
    base_date: c.baseDate,
    change: c.value,
    partial: c.partial,
    estimated: c.estimated,
  };
}

const WORK_MODES: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

function workModeOf(mode: string | null | undefined): string | null {
  return mode ? (WORK_MODES[mode] ?? null) : null;
}

/** "San Jose, CA" or "Cupertino, CA, US"-style label from the job's first place. */
export function locationOf(job: Pick<KrillJobItem, 'places' | 'locations'>): string | null {
  const place = job.places[0];
  if (place) {
    const parts = [place.city, place.admin1Code, place.countryCode].filter((p): p is string => !!p);
    if (place.city && place.countryCode === 'US' && place.admin1Code) return `${place.city}, ${place.admin1Code}`;
    if (place.city && place.countryCode) return `${place.city}, ${place.countryCode}`;
    if (parts.length) return parts.join(', ');
    if (place.label) return place.label;
  }
  return job.locations[0] ?? null;
}

const compactMoney = (n: number, currency: string): string => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  return n >= 1000 ? `${sym}${Math.round(n / 1000)}K` : `${sym}${Math.round(n)}`;
};

/** "$220K – $320K" from the annual pay range; null when the posting lists none. */
export function salaryText(job: Pick<KrillJobItem, 'salary'>): string | null {
  const s = job.salary;
  if (!s) return null;
  const currency = s.currency ?? 'USD';
  const lo = s.annualMin && s.annualMin > 0 ? s.annualMin : null;
  const hi = s.annualMax && s.annualMax > 0 ? s.annualMax : null;
  if (lo !== null && hi !== null && Math.round(lo / 1000) !== Math.round(hi / 1000)) {
    return `${compactMoney(lo, currency)} – ${compactMoney(hi, currency)}`;
  }
  const one = hi ?? lo;
  return one === null ? null : compactMoney(one, currency);
}

