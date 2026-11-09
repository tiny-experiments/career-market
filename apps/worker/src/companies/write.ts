import { companySeries, type DayRow } from '@cm/core/company';
import { slugify } from '@cm/core/screener';
import { addDays, RANGES, type IsoDay } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import type { Change } from '@cm/core/types';
import { medianAge } from '../compute/ageDistribution.ts';
import { computeChange } from '../compute/changes.ts';
import {
  changePoints,
  companySignal,
  explainer,
  type LevelDelta,
} from './compute.ts';
import type { CompanyPull } from './pull.ts';

async function insertRows(tx: Sql, table: string, rows: Record<string, unknown>[], columns: string[]): Promise<void> {
  const chunk = Math.max(1, Math.floor(60_000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + chunk) as never, ...(columns as never[]))}`;
  }
}

/** The slug the change sweep gives a company it creates before the build has named it. */
export const placeholderSlug = (companyId: string): string => `company-${companyId}`;

/** Raw company facts from krill, stored as krill served them (rebuildable). */
export async function writeCompanyInputs(tx: Sql, p: CompanyPull): Promise<void> {
  const T = p.asOf;

  // Directory: keep a company's slug once given, so URLs stay stable.
  const existing = await tx<{ company_id: string; slug: string }[]>`select company_id, slug from company`;
  const slugOf = new Map(existing.map((r) => [r.company_id, r.slug]));
  const taken = new Set(existing.map((r) => r.slug));
  const rows: Record<string, unknown>[] = [];
  for (const [i, c] of p.directory.entries()) {
    let slug = slugOf.get(c.id);
    if (slug === placeholderSlug(c.id)) {
      taken.delete(slug);
      slug = undefined;
    }
    if (!slug) {
      // The same rule as the Screener's company slugs: the name, then the name and the id tail on a clash.
      const base = slugify(c.name) || 'company';
      slug = [base, `${base}-${c.id.slice(-4)}`, `${base}-${c.id.slice(3)}`].find((s) => !taken.has(s)) as string;
      taken.add(slug);
      slugOf.set(c.id, slug);
    }
    const profile = p.profiles.get(c.id);
    rows.push({
      company_id: c.id,
      slug,
      name: c.name,
      domain: c.domain,
      careers_url: profile?.detail ? careersUrl(profile.detail.boards) : null,
      ats: c.ats,
      open: c.openJobs,
      rank: i + 1,
      profiled: profile !== undefined,
      updated_on: T,
    });
  }
  // Companies that fell out of the directory keep their row (and slug) but lose their rank.
  await tx`update company set rank = 1000000, profiled = false where updated_on < ${T}`;
  for (let i = 0; i < rows.length; i += 500) {
    await tx`
      insert into company ${tx(rows.slice(i, i + 500) as never)}
      on conflict (company_id) do update set
        slug = excluded.slug, name = excluded.name, domain = coalesce(excluded.domain, company.domain), careers_url = coalesce(excluded.careers_url, company.careers_url), ats = excluded.ats,
        open = excluded.open, rank = excluded.rank, profiled = excluded.profiled, updated_on = excluded.updated_on`;
  }

  // Daily statistics of every company.
  for (const day of p.days) await tx`delete from company_daily where date = ${day} and family = '*'`;
  await insertRows(
    tx,
    'company_daily',
    p.stats.map((r) => ({ date: r.date, company_id: r.companyId, name: null, family: '*', open: r.open, new: r.new, closed: r.closed })),
    ['date', 'company_id', 'name', 'family', 'open', 'new', 'closed'],
  );

  for (const day of p.days) await tx`delete from company_slice_daily where date = ${day}`;
  await insertRows(
    tx,
    'company_slice_daily',
    p.slices
      .filter((r) => r.family)
      .map((r) => ({ date: r.date, company_id: r.companyId, family: r.family, level: r.level ?? '', open: r.open, new: r.new, closed: r.closed })),
    ['date', 'company_id', 'family', 'level', 'open', 'new', 'closed'],
  );

  await tx`delete from company_profile where as_of = ${T}`;
  const profileRows: Record<string, unknown>[] = [];
  for (const [id, prof] of p.profiles) {
    const median = medianAge(
      prof.cuts.map((c) => ({ age: c.age, countLE: c.countLE })),
      prof.facets.total,
    );
    profileRows.push({
      as_of: T,
      company_id: id,
      total: prof.facets.total,
      levels: tx.json(prof.facets.facets.level as never),
      skills: tx.json(prof.facets.facets.skill as never),
      countries: tx.json(prof.facets.facets.country as never),
      work_modes: tx.json(prof.facets.facets.workMode as never),
      median_days_open: median,
    });
  }
  await insertRows(tx, 'company_profile', profileRows, ['as_of', 'company_id', 'total', 'levels', 'skills', 'countries', 'work_modes', 'median_days_open']);
}

/** The board a visitor should land on: the live board with the most open roles. */
export function careersUrl(boards: { url: string; status: string; openJobs: number }[]): string | null {
  const live = boards.filter((b) => b.status === 'live' && /^https?:\/\//.test(b.url));
  const best = [...(live.length ? live : boards.filter((b) => /^https?:\/\//.test(b.url)))].sort((a, b) => b.openJobs - a.openJobs)[0];
  return best?.url ?? null;
}

function changesOf(rows: readonly DayRow[], T: IsoDay): { subject: Map<string, Change>; series: ReturnType<typeof companySeries> } {
  const series = companySeries(rows, T);
  const points = changePoints(series);
  const out = new Map<string, Change>();
  for (const range of RANGES) {
    const c = computeChange(points, T, range);
    if (c) out.set(range, c);
  }
  return { subject: out, series };
}

/** Changes and signals, recomputed from the stored company tables. */
export async function computeCompanyTables(tx: Sql, T: IsoDay, log: Logger): Promise<Record<string, unknown>> {
  const listed = await tx<{ company_id: string; profiled: boolean }[]>`
    select company_id, profiled from company where updated_on = ${T}`;
  const ids = listed.map((c) => c.company_id);
  const daily = await tx<{ company_id: string; date: IsoDay; open: number; new: number; closed: number }[]>`
    select company_id, date, open, new, closed from company_daily
    where family = '*' and new is not null and date <= ${T} and company_id in ${tx(ids.length ? ids : [''])}
    order by date`;
  const byCompany = new Map<string, DayRow[]>();
  for (const r of daily) {
    const list = byCompany.get(r.company_id);
    const row = { date: r.date, open: r.open, new: r.new, closed: r.closed };
    if (list) list.push(row);
    else byCompany.set(r.company_id, [row]);
  }

  // Open roles by level, for the level clause of the explainer sentence.
  const levelRows = await tx<{ company_id: string; date: IsoDay; level: string; open: number }[]>`
    select company_id, date, level, sum(open)::int as open from company_slice_daily
    where date <= ${T} group by company_id, date, level`;
  const levelOpen = new Map<string, Map<IsoDay, Map<string, number>>>();
  for (const r of levelRows) {
    const days = levelOpen.get(r.company_id) ?? new Map<IsoDay, Map<string, number>>();
    const levels = days.get(r.date) ?? new Map<string, number>();
    levels.set(r.level, r.open);
    days.set(r.date, levels);
    levelOpen.set(r.company_id, days);
  }
  const levelDeltas = (id: string, from: IsoDay): LevelDelta[] => {
    const days = levelOpen.get(id);
    const now = days?.get(T);
    const base = days?.get(addDays(from, -1));
    if (!now || !base) return [];
    return [...new Set([...now.keys(), ...base.keys()])].map((level) => ({ level, delta: (now.get(level) ?? 0) - (base.get(level) ?? 0) }));
  };

  const changeRows: Record<string, unknown>[] = [];
  const signalRows: Record<string, unknown>[] = [];
  const pushChanges = (subject: string, changes: Map<string, Change>) => {
    for (const c of changes.values()) {
      changeRows.push({ as_of: T, subject, range: c.range, base_date: c.baseDate, change: c.value, partial: c.partial, estimated: c.estimated });
    }
  };
  for (const id of ids) {
    const rows = byCompany.get(id) ?? [];
    const { subject, series } = changesOf(rows, T);
    pushChanges(`cpage:${id}`, subject);
    const signal = companySignal(series, T);
    if (signal) {
      signalRows.push({
        as_of: T,
        company_id: id,
        state: signal.state,
        window_from: signal.windowFrom,
        window_days: signal.windowDays,
        opened: signal.opened,
        closed: signal.closed,
        open_base: signal.openBase,
        partial: signal.partial,
        explainer: explainer(signal, levelDeltas(id, signal.windowFrom)),
      });
    }
  }

  // Family changes of profiled companies (Growing teams).
  const slices = await tx<{ company_id: string; date: IsoDay; family: string; open: number; new: number; closed: number }[]>`
    select company_id, date, family, sum(open)::int as open, sum(new)::int as new, sum(closed)::int as closed
    from company_slice_daily where date <= ${T} group by company_id, date, family order by date`;
  const familyRows = new Map<string, DayRow[]>();
  for (const r of slices) {
    const key = `${r.company_id}\u0000${r.family}`;
    const list = familyRows.get(key);
    const row = { date: r.date, open: r.open, new: r.new, closed: r.closed };
    if (list) list.push(row);
    else familyRows.set(key, [row]);
  }
  for (const [key, rows] of familyRows) {
    const [id, family] = key.split('\u0000') as [string, string];
    // A team's change follows the company's own segment: days before its board was fetched do not count.
    const companySeg = companySeries(byCompany.get(id) ?? [], T);
    const start = companySeg.segmentStart;
    const usable = start ? rows.filter((r) => r.date >= start) : [];
    const { subject } = changesOf(
      fillSegment(usable, start, T),
      T,
    );
    pushChanges(`cfam:${id}:${family}`, subject);
  }

  await tx`delete from market_change where as_of = ${T} and (subject like 'cpage:%' or subject like 'cfam:%')`;
  await insertRows(tx, 'market_change', changeRows, ['as_of', 'subject', 'range', 'base_date', 'change', 'partial', 'estimated']);
  await tx`delete from company_signal where as_of = ${T}`;
  await insertRows(tx, 'company_signal', signalRows, ['as_of', 'company_id', 'state', 'window_from', 'window_days', 'opened', 'closed', 'open_base', 'partial', 'explainer']);

  const [{ n: profileCount }] = (await tx`select count(*)::int as n from company_profile where as_of = ${T}`) as unknown as [{ n: number }];
  const stats = {
    companies: ids.length,
    companyProfiles: profileCount,
    companySignals: signalRows.length,
  };
  log.info(stats, 'company tables written');
  return stats;
}

/** Family rows have no row on quiet days; fill the gaps from the segment start so changes see every day. */
function fillSegment(rows: DayRow[], start: IsoDay | null, T: IsoDay): DayRow[] {
  if (!start || rows.length === 0) return [];
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: DayRow[] = [];
  for (let d = start; d <= T; d = nextDay(d)) out.push(byDate.get(d) ?? { date: d, open: 0, new: 0, closed: 0 });
  return out;
}

function nextDay(d: IsoDay): IsoDay {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
