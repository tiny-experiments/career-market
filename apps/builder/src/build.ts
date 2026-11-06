import { familyInfo, rankFamilies } from '@cm/core/codes';
import type { Config } from '@cm/core/config';
import {
  addDays,
  daysBetween,
  FIRST_COMPARABLE_BASE,
  FIRST_OBSERVED_DAY,
  isBootstrapDay,
  RANGES,
  type IsoDay,
} from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import type { Change } from '@cm/core/types';
import type { AgeCut } from './compute/ageDistribution.ts';
import { medianAge } from './compute/ageDistribution.ts';
import { backcast, fitSurvival, type ClosingDay, type SurvivalFit } from './compute/backcast.ts';
import { chainIndex, rebase, shareAdjustedIndex, type IndexPoint } from './compute/chainIndex.ts';
import { computeChange, type ValuePoint } from './compute/changes.ts';
import { writeNotes } from './compute/notes.ts';
import { planCompanyDays, pullCompanies, type CompanyPlan, type CompanyPull } from './companies/pull.ts';
import { computeCompanyTables, writeCompanyInputs } from './companies/write.ts';
import type { KrillApi } from './krill/api.ts';
import { KrillCompanyApi } from './krill/companyApi.ts';
import { payBandRows, pullPayBands } from './payBands.ts';
import { computeProfessions, writeProfessionInputs } from './professions/build.ts';
import { pullProfessions } from './professions/pull.ts';
import { observedDays, pull, type Pulled } from './pull.ts';
import { pullScreener } from './screener/pull.ts';
import { writeScreener } from './screener/write.ts';
import { pullSkillPages, type SkillPulled } from './skills/pull.ts';
import { computeSkillPages, writeSkillInputs } from './skills/write.ts';

/** How far the back-cast reaches before today (report: reliable to about 6 months). */
export const BACKCAST_DAYS = 183;
/** Closing samples older than this do not feed the survival fit. */
const CLOSING_WINDOW_DAYS = 28;
/** Skills whose daily change is kept (largest by open roles). */
const TRACKED_SKILLS = 120;

export interface BuildDeps {
  sql: Sql;
  api: KrillApi;
  config: Config;
  log: Logger;
}

export interface BuildOptions {
  /** Rebuild even when the snapshot day was already built. */
  force?: boolean;
  /** Refetch every grouped day since the first observed day. */
  full?: boolean;
}

export type BuildResult =
  | { status: 'skipped'; reason: string; snapshotDate: IsoDay | null }
  | { status: 'built'; snapshotDate: IsoDay; stats: Record<string, unknown> };

export async function runBuild(deps: BuildDeps, options: BuildOptions = {}): Promise<BuildResult> {
  const { sql, api, config, log } = deps;
  const meta = await api.meta();
  const T = meta.lastSnapshotDate;
  if (!T) return { status: 'skipped', reason: 'krill has no snapshot yet', snapshotDate: null };

  if (!options.force) {
    const [done] = await sql`select 1 from build_run where snapshot_date = ${T} and status = 'ok' limit 1`;
    if (done) return { status: 'skipped', reason: 'snapshot already built', snapshotDate: T };
  }

  api.client.setCacheNamespace(T);
  const [run] = await sql<{ id: string }[]>`
    insert into build_run (snapshot_date, status, taxonomy_version)
    values (${T}, 'running', ${meta.taxonomy.version}) returning id`;
  const runId = (run as { id: string }).id;
  log.info({ snapshotDate: T, runId }, 'build started');

  try {
    const plan = await planPull(sql, T, config, options);
    const pulled = await pull(api, { ...meta, lastSnapshotDate: T }, plan, log);
    const atsList = meta.ats.filter((a) => a.openJobs > 0).map((a) => a.ats);
    const professions = await pullProfessions(api, T, pulled.families, atsList, log);
    const screener = await pullScreener(api, T, pulled.families, log);
    const pay = await pullPayBands(api, pulled.families, log);
    // The Skill pages must not take the market build down with them: when krill
    // fails them, today's skill rows are skipped and the pages keep their last good day.
    let skillsPulled: SkillPulled | null = null;
    if (config.builder.skillPages > 0) {
      try {
        skillsPulled = await pullSkillPages({ api, sql, log, limit: config.builder.skillPages }, T, pulled.familySkills);
      } catch (err) {
        log.error({ err: String(err) }, 'skill page pull failed; skill pages keep the previous day');
      }
    }
    const companyPlan = await planCompanies(sql, T, config, options);
    const companies = await pullCompanies(new KrillCompanyApi(api.client), T, companyPlan, log);
    const stats = await sql.begin(async (tx) => {
      await writeInputs(tx as unknown as Sql, pulled);
      await writeProfessionInputs(tx as unknown as Sql, T, professions);
      await writePayBands(tx as unknown as Sql, T, pay.bands);
      if (skillsPulled) await writeSkillInputs(tx as unknown as Sql, T, skillsPulled);
      const market = await computeAndWrite(tx as unknown as Sql, pulled, log);
      const fit = await fitFromSamples(tx as unknown as Sql, pulled, T, new Map(pulled.market.map((m) => [m.date, m])));
      const profession = await computeProfessions(tx as unknown as Sql, professions, { T, fit: fit?.fit ?? null, log });
      const skills = skillsPulled ? { ...(await computeSkillPages(tx as unknown as Sql, T, log)), skillsFailed: skillsPulled.failed } : {};
      const company = await writeAndComputeCompanies(tx as unknown as Sql, companies, T, log);
      return { ...market, ...profession, ...company, ...skills, paySamples: pay.samples, payBands: pay.bands.length, ...(await writeScreener(tx as unknown as Sql, screener, T, log)) };
    });
    const finalStats = { ...stats, krillCalls: api.client.calls, krillCacheHits: api.client.cacheHits };
    await sql`
      update build_run set status = 'ok', finished_at = now(), stats = ${sql.json(finalStats as never)}
      where id = ${runId}`;
    log.info({ snapshotDate: T, ...finalStats }, 'build finished');
    await pingRevalidate(config, log);
    return { status: 'built', snapshotDate: T, stats: finalStats };
  } catch (err) {
    await sql`
      update build_run set status = 'failed', finished_at = now(), error = ${String(err)}
      where id = ${runId}`;
    throw err;
  }
}

async function planPull(sql: Sql, T: IsoDay, config: Config, options: BuildOptions) {
  const days = observedDays(T);
  const have = new Set(
    (await sql<{ date: IsoDay }[]>`select distinct date from profession_daily`).map((r) => r.date),
  );
  const recentFrom = addDays(T, -(config.builder.groupedRefreshDays - 1));
  const groupedDays = options.full ? days : days.filter((d) => d >= recentFrom || !have.has(d));

  const sampled = new Set(
    (await sql<{ detected_on: IsoDay }[]>`select distinct detected_on from closing_sample`).map((r) => r.detected_on),
  );
  const closingFrom = addDays(T, -(CLOSING_WINDOW_DAYS - 1));
  const closingDays = days.filter((d) => d >= closingFrom && !isBootstrapDay(d) && !sampled.has(d));

  return {
    groupedDays,
    closingDays,
    closingSamplePerDay: config.builder.closingSamplePerDay,
    topCompanies: 50,
    skillsPerFamily: 300,
  };
}

async function planCompanies(sql: Sql, T: IsoDay, config: Config, options: BuildOptions): Promise<CompanyPlan> {
  const have = new Set(
    (await sql<{ date: IsoDay }[]>`select distinct date from company_daily where family = '*' and new is not null`).map((r) => r.date),
  );
  return {
    days: planCompanyDays(observedDays(T), have, T, config.builder.groupedRefreshDays, options.full === true),
    profiles: config.builder.companyProfiles,
  };
}

async function writeAndComputeCompanies(tx: Sql, companies: CompanyPull, T: IsoDay, log: Logger): Promise<Record<string, unknown>> {
  await writeCompanyInputs(tx, companies);
  return computeCompanyTables(tx, T, log);
}

async function insertRows(tx: Sql, table: string, rows: Record<string, unknown>[], columns: string[]): Promise<void> {
  const chunk = Math.max(1, Math.floor(60_000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + chunk) as never, ...(columns as never[]))}`;
  }
}

/** Raw facts from krill, stored as krill served them (rebuildable). */
async function writeInputs(tx: Sql, p: Pulled): Promise<void> {
  const T = p.meta.lastSnapshotDate;
  for (const [day, items] of p.grouped) {
    await tx`delete from profession_daily where date = ${day}`;
    const rows = items
      .filter((i) => i.family)
      .map((i) => ({
        date: day,
        family: i.family as string,
        specialty: i.specialty ?? '',
        level: i.level ?? '',
        country: i.country ?? '',
        open: i.open,
        new: i.new,
        closed: i.closed,
        opened: i.opened,
      }));
    await insertRows(tx, 'profession_daily', rows, ['date', 'family', 'specialty', 'level', 'country', 'open', 'new', 'closed', 'opened']);
  }

  await tx`delete from skill_daily where date = ${T}`;
  const skillRows: Record<string, unknown>[] = [];
  for (const [family, f] of p.familySkills) {
    for (const s of f.skills) skillRows.push({ date: T, skill: s.value, family, country: '*', open: s.count });
  }
  await insertRows(tx, 'skill_daily', skillRows, ['date', 'skill', 'family', 'country', 'open']);

  await tx`delete from company_daily where date = ${T}`;
  await insertRows(
    tx,
    'company_daily',
    p.companies.map((c) => ({ date: T, company_id: c.id, name: c.name, family: '*', open: c.openJobs })),
    ['date', 'company_id', 'name', 'family', 'open'],
  );

  await tx`delete from open_age_cut where snapshot_date = ${T}`;
  await insertRows(
    tx,
    'open_age_cut',
    p.cuts.map((c) => ({ snapshot_date: T, kind: c.kind, cut_date: c.cutDate, count: c.count })),
    ['snapshot_date', 'kind', 'cut_date', 'count'],
  );

  for (const s of p.closingSamples) {
    await tx`
      insert into closing_sample (job_id, detected_on, closed_on, opened_on, opened_source, family)
      values (${s.jobId}, ${s.detectedOn}, ${s.closedOn}, ${s.openedOn}, ${s.openedSource}, ${s.family})
      on conflict (job_id) do nothing`;
  }
}

/** Pay bands for the Job page: one set per snapshot day. */
async function writePayBands(tx: Sql, T: IsoDay, bands: Parameters<typeof payBandRows>[1]): Promise<void> {
  await tx`delete from pay_band where date = ${T}`;
  await insertRows(tx, 'pay_band', payBandRows(T, bands), ['date', 'family', 'specialty', 'level', 'country', 'currency', 'n', 'p25', 'p50', 'p75']);
}

/** Every derived number, recomputed from the stored inputs. */
async function computeAndWrite(tx: Sql, p: Pulled, log: Logger): Promise<Record<string, unknown>> {
  const T = p.meta.lastSnapshotDate;
  const market = p.market.filter((m) => m.date >= FIRST_OBSERVED_DAY && m.date <= T).sort(byDate);
  const marketByDate = new Map(market.map((m) => [m.date, m]));
  const todayRow = marketByDate.get(T);
  if (!todayRow) throw new Error(`krill /v1/stats/daily has no row for the snapshot day ${T}`);
  const openT = todayRow.open;

  // 1. Chain-linked index on matched boards, rebased onto today's boards.
  const panel = new Map(p.panel.map((x) => [x.date, x] as const));
  const index = chainIndex(market.map((m) => m.date), panel);
  const indexByDate = new Map(index.map((i) => [i.date, i]));
  const rebased = rebase(index, openT);

  // 2. Back-cast before the first observed day.
  const fit = await fitFromSamples(tx, p, T, marketByDate);
  const estimated = fit ? estimateHistory(p, T, openT, fit.fit, rebased) : null;

  // 3. market_daily: observed rows (upsert keeps per-day snapshot facts) and estimated rows.
  const openedCuts = cutsOf(p, 'opened', T);
  const facetTotal = p.failedFamilies.length === 0 ? sum([...p.familySkills.values()].map((f) => f.total)) : openT;
  const median = medianAge(openedCuts, facetTotal);
  for (const m of market) {
    const pn = panel.get(m.date);
    const ix = indexByDate.get(m.date) as IndexPoint;
    const newKnown = pn?.newOnKnownBoards ?? null;
    const row = {
      date: m.date,
      estimated: false,
      open: m.open,
      open_on_today_boards: rebased.get(m.date) ?? m.open,
      new: m.new,
      new_known: newKnown,
      new_first_fetch: newKnown === null ? null : Math.max(0, m.new - newKnown),
      opened: m.opened,
      closed: m.closed,
      boards_ok: pn?.boardsOk ?? null,
      matched_boards: pn?.matchedBoards ?? null,
      matched_open: pn?.matchedOpen ?? null,
      matched_previous_open: pn?.matchedPreviousOpen ?? null,
      link: ix.link,
      index_value: ix.value,
      companies: m.date === T ? p.meta.companies : null,
      boards: m.date === T ? p.meta.boards : null,
      median_days_open: m.date === T ? median : null,
    };
    await tx`
      insert into market_daily ${tx(row as never)}
      on conflict (date) do update set
        estimated = excluded.estimated, open = excluded.open,
        open_on_today_boards = excluded.open_on_today_boards, new = excluded.new,
        new_known = excluded.new_known, new_first_fetch = excluded.new_first_fetch,
        opened = excluded.opened, closed = excluded.closed, boards_ok = excluded.boards_ok,
        matched_boards = excluded.matched_boards, matched_open = excluded.matched_open,
        matched_previous_open = excluded.matched_previous_open, link = excluded.link,
        index_value = excluded.index_value,
        companies = coalesce(excluded.companies, market_daily.companies),
        boards = coalesce(excluded.boards, market_daily.boards),
        median_days_open = coalesce(excluded.median_days_open, market_daily.median_days_open)`;
  }
  await tx`delete from market_daily where estimated`;
  const firstRebased = rebased.get(FIRST_OBSERVED_DAY) ?? openT;
  if (estimated) {
    await insertRows(
      tx,
      'market_daily',
      estimated.days.map((d) => ({
        date: d.date,
        estimated: true,
        open: Math.round(d.open),
        open_on_today_boards: Math.round(d.open),
        opened: Math.round(d.new),
        closed: Math.round(d.closed),
        index_value: (100 * d.open) / firstRebased,
      })),
      ['date', 'estimated', 'open', 'open_on_today_boards', 'opened', 'closed', 'index_value'],
    );
  }

  // 4. Market changes over every range.
  const marketSeries: ValuePoint[] = [
    ...(estimated?.days ?? []).map((d) => ({ date: d.date, value: d.open, estimated: true })),
    ...market.map((m) => ({ date: m.date, value: rebased.get(m.date) ?? m.open, estimated: false })),
  ];
  const changeRows: Record<string, unknown>[] = [];
  const marketChanges = changesFor(marketSeries, T);
  pushChanges(changeRows, T, 'market', marketChanges);

  // 5. Families: share-adjusted chain index from profession_daily.
  const famRows = await tx<{ date: IsoDay; family: string; open: number; opened: number; closed: number }[]>`
    select date, family, sum(open)::int as open, sum(opened)::int as opened, sum(closed)::int as closed
    from profession_daily where date <= ${T} group by date, family order by date`;
  const marketOpen = (d: IsoDay) => marketByDate.get(d)?.open ?? 0;
  const byFamily = groupBy(famRows, (r) => r.family);
  const familyDailyRows: Record<string, unknown>[] = [];
  const familyMovers: { family: string; code: string; name: string; open: number; change: Change | null }[] = [];
  for (const [family, rows] of byFamily) {
    const info = familyInfo(family);
    const share = new Map(rows.filter((r) => marketOpen(r.date) > 0).map((r) => [r.date, r.open / marketOpen(r.date)]));
    const famIndex = shareAdjustedIndex(index, share);
    const famIndexByDate = new Map(famIndex.map((x) => [x.date, x.value]));
    for (const r of rows) {
      const iv = famIndexByDate.get(r.date);
      if (iv === undefined) continue;
      familyDailyRows.push({
        date: r.date,
        family,
        code: info.code,
        open: r.open,
        opened: r.opened,
        closed: r.closed,
        share: share.get(r.date) ?? 0,
        index_value: iv,
      });
    }
    const series = famIndex.map((x) => ({ date: x.date, value: x.value, estimated: false }));
    const changes = changesFor(series, T);
    pushChanges(changeRows, T, `family:${family}`, changes);
    const todayOpen = rows.find((r) => r.date === T)?.open ?? 0;
    familyMovers.push({ family, code: info.code, name: info.name, open: todayOpen, change: changes.get('1W') ?? null });
  }
  await tx`delete from family_daily`;
  await insertRows(tx, 'family_daily', familyDailyRows, ['date', 'family', 'code', 'open', 'opened', 'closed', 'share', 'index_value']);

  // 6. Skills: share-adjusted index from skill_daily (history starts with the first build).
  const skillRows = await tx<{ date: IsoDay; skill: string; open: number }[]>`
    select date, skill, sum(open)::int as open from skill_daily
    where country = '*' and date <= ${T} group by date, skill order by date`;
  const todaySkills = skillRows.filter((r) => r.date === T).sort((a, b) => b.open - a.open).slice(0, TRACKED_SKILLS);
  const skillsByDay = groupBy(skillRows, (r) => r.skill);
  for (const s of todaySkills) {
    const rows = skillsByDay.get(s.skill) ?? [];
    const share = new Map(rows.filter((r) => marketOpen(r.date) > 0).map((r) => [r.date, r.open / marketOpen(r.date)]));
    const series = shareAdjustedIndex(index, share).map((x) => ({ date: x.date, value: x.value, estimated: false }));
    pushChanges(changeRows, T, `skill:${s.skill}`, changesFor(series, T));
  }

  await tx`delete from market_change where as_of = ${T}`;
  await insertRows(tx, 'market_change', changeRows, ['as_of', 'subject', 'range', 'base_date', 'change', 'partial', 'estimated']);

  // 7. Survival curve of the day.
  await tx`delete from survival_curve where snapshot_date = ${T}`;
  if (fit) {
    await insertRows(
      tx,
      'survival_curve',
      fit.fit.buckets.map((b) => ({
        snapshot_date: T,
        age_from: b.from,
        age_to: b.to,
        hazard: b.hazard,
        survival_end: b.survivalEnd,
        closings: b.closings,
      })),
      ['snapshot_date', 'age_from', 'age_to', 'hazard', 'survival_end', 'closings'],
    );
  }

  // 8. Market notes.
  const levelRows = await tx<{ level: string; open: number }[]>`
    select level, sum(open)::int as open from profession_daily where date = ${T} group by level`;
  const countryRows = await tx<{ country: string; open: number }[]>`
    select country, sum(open)::int as open from profession_daily where date = ${T} group by country`;
  const flowDays = market.filter((m) => m.date > addDays(T, -7) && m.date > FIRST_COMPARABLE_BASE && !isBootstrapDay(m.date));
  const notes = writeNotes({
    asOf: T,
    open: openT,
    marketChange: marketChanges.get('1W') ?? null,
    families: rankFamilies(familyMovers),
    levels: new Map(levelRows.map((r) => [r.level, r.open])),
    countries: new Map(countryRows.map((r) => [r.country, r.open])),
    flow: flowDays.length
      ? { opened: sum(flowDays.map((d) => d.opened)), closed: sum(flowDays.map((d) => d.closed)), since: (flowDays[0] as { date: IsoDay }).date }
      : null,
  });
  await tx`delete from market_note where date = ${T}`;
  await insertRows(
    tx,
    'market_note',
    notes.map((n, i) => ({ date: T, rank: i + 1, rule: n.rule, text: n.text, numbers: tx.json(n.numbers as never) })),
    ['date', 'rank', 'rule', 'text', 'numbers'],
  );

  const stats = {
    observedDays: market.length,
    groupedDaysRefreshed: p.grouped.size,
    failedFamilies: p.failedFamilies,
    cuts: p.cuts.length,
    postedTotal: p.postedTotal,
    medianDaysOpen: median,
    closingSamplesAdded: p.closingSamples.length,
    survivalSampled: fit?.fit.sampled ?? 0,
    backcastDays: estimated?.days.length ?? 0,
    backcastCalibration: estimated?.calibration ?? null,
    backcastReason: estimated ? null : fit ? 'no posted-day distribution' : 'not enough sampled closings yet',
    notes: notes.length,
  };
  log.info(stats, 'derived tables written');
  return stats;
}

/** Fit the survival curve from the stored closing samples of the recent window. */
export async function fitFromSamples(
  tx: Sql,
  p: Pulled,
  T: IsoDay,
  marketByDate: Map<IsoDay, { closed: number }>,
): Promise<{ fit: SurvivalFit } | null> {
  const datedCuts = cutsOf(p, 'posted', T);
  if (datedCuts.length < 4 || !p.postedTotal) return null;
  const rows = await tx<{ detected_on: IsoDay; closed_on: IsoDay; opened_on: IsoDay; opened_source: string }[]>`
    select detected_on, closed_on, opened_on, opened_source from closing_sample
    where detected_on > ${addDays(T, -CLOSING_WINDOW_DAYS)} and detected_on <= ${T}`;
  const days: ClosingDay[] = [];
  for (const [day, samples] of groupBy(rows, (r) => r.detected_on)) {
    const closed = marketByDate.get(day)?.closed;
    if (closed === undefined || isBootstrapDay(day)) continue;
    days.push({
      day,
      closed,
      datedAges: samples
        .filter((s) => s.opened_source === 'posted')
        .map((s) => Math.max(0, daysBetween(s.opened_on, s.closed_on))),
      undated: samples.filter((s) => s.opened_source !== 'posted').length,
    });
  }
  const fit = fitSurvival({ datedCuts, closingDays: days });
  return fit ? { fit } : null;
}

function estimateHistory(p: Pulled, T: IsoDay, openT: number, fit: SurvivalFit, rebased: Map<IsoDay, number>) {
  const datedCuts = cutsOf(p, 'posted', T);
  const all = backcast({
    asOf: T,
    datedCuts,
    datedTotal: p.postedTotal as number,
    totalOpen: openT,
    survival: fit.survival,
    days: Math.min(BACKCAST_DAYS, fit.survival.length - 1),
  });
  const atFirst = all.find((d) => d.date === FIRST_OBSERVED_DAY);
  const observedFirst = rebased.get(FIRST_OBSERVED_DAY);
  // Calibrate so the dashed estimate meets the first observed point.
  const calibration = atFirst && observedFirst && atFirst.open > 0 ? observedFirst / atFirst.open : 1;
  const days = all
    .filter((d) => d.date < FIRST_OBSERVED_DAY)
    .map((d) => ({ date: d.date, open: d.open * calibration, new: d.new * calibration, closed: d.closed * calibration }));
  return { days, calibration };
}

function cutsOf(p: Pulled, kind: 'opened' | 'posted', T: IsoDay): AgeCut[] {
  return p.cuts.filter((c) => c.kind === kind).map((c) => ({ age: daysBetween(c.cutDate, T), countLE: c.count }));
}

function changesFor(series: ValuePoint[], T: IsoDay): Map<string, Change> {
  const out = new Map<string, Change>();
  for (const range of RANGES) {
    const c = computeChange(series, T, range);
    if (c) out.set(range, c);
  }
  return out;
}

function pushChanges(rows: Record<string, unknown>[], T: IsoDay, subject: string, changes: Map<string, Change>): void {
  for (const c of changes.values()) {
    rows.push({
      as_of: T,
      subject,
      range: c.range,
      base_date: c.baseDate,
      change: c.value,
      partial: c.partial,
      estimated: c.estimated,
    });
  }
}

async function pingRevalidate(config: Config, log: Logger): Promise<void> {
  const { revalidateUrl, revalidateToken } = config.web;
  if (!revalidateUrl || !revalidateToken) return;
  try {
    const res = await fetch(revalidateUrl, {
      method: 'POST',
      headers: { authorization: `Bearer ${revalidateToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    log.info({ status: res.status }, 'asked the web app to revalidate');
  } catch (err) {
    log.warn({ err: String(err) }, 'web revalidation failed; pages refresh on their revalidate window');
  }
}

function byDate<T extends { date: IsoDay }>(a: T, b: T): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function groupBy<T, K>(rows: readonly T[], key: (r: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

function sum(values: number[]): number {
  return values.reduce((n, v) => n + v, 0);
}
