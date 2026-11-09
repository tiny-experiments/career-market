import { companyTicker, familyInfo, skillLabel, titleCase } from '@cm/core/codes';
import { RANGES, type IsoDay } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import { computeChange, type ValuePoint } from '../compute/changes.ts';
import {
  companySlugs,
  signalFor,
  skillSlugs,
  topSkillIds,
  topValue,
  workModeCounts,
  type DayValue,
} from './compute.ts';
import type { ScreenerPulled } from './pull.ts';

async function insertRows(tx: Sql, table: string, rows: Record<string, unknown>[], columns: string[]): Promise<void> {
  const chunk = Math.max(1, Math.floor(60_000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + chunk) as never, ...(columns as never[]))}`;
  }
}

/** Facet kinds kept for the summary strip and the dropdowns. */
const FACET_KINDS = ['level', 'workMode', 'country', 'family', 'skill'] as const;

/**
 * Writes every Screener and search table for the snapshot day from what krill
 * served. Runs after the foundation's derived tables (it adds to market_change
 * and reads profession_daily).
 */
export async function writeScreener(tx: Sql, p: ScreenerPulled, T: IsoDay, log: Logger): Promise<Record<string, unknown>> {
  // 1. Company daily statistics: replace the window krill returned.
  const firstDay = p.companyDays.reduce<IsoDay | null>((m, d) => (m === null || d.date < m ? d.date : m), null);
  if (firstDay) await tx`delete from screener_company_day where date >= ${firstDay}`;
  await insertRows(
    tx,
    'screener_company_day',
    p.companyDays.map((d) => ({ date: d.date, company_id: d.companyId, family: '*', open: d.open, new: d.new, closed: d.closed })),
    ['date', 'company_id', 'family', 'open', 'new', 'closed'],
  );

  // 2. The company table.
  const history = await tx<{ company_id: string; date: IsoDay; open: number }[]>`
    select company_id, date, open from screener_company_day
    where family = '*' and date <= ${T} order by date`;
  const byCompany = new Map<string, DayValue[]>();
  for (const h of history) {
    const list = byCompany.get(h.company_id);
    if (list) list.push({ date: h.date, open: h.open });
    else byCompany.set(h.company_id, [{ date: h.date, open: h.open }]);
  }
  const slugs = companySlugs(p.companies);
  const companyRows: Record<string, unknown>[] = [];
  const changeRows: Record<string, unknown>[] = [];
  for (const c of p.companies) {
    const f = p.perCompany.get(c.id) ?? null;
    const modes = f ? workModeCounts(f.facets.workMode) : { remote: 0, hybrid: 0, onsite: 0 };
    const top = f ? topValue(f.facets.family) : null;
    const series = byCompany.get(c.id) ?? [];
    const { signal, days } = signalFor(series);
    companyRows.push({
      as_of: T,
      company_id: c.id,
      slug: slugs.get(c.id),
      name: c.name,
      domain: c.domain ?? null,
      open: c.openJobs,
      top_family: top?.value ?? null,
      top_family_open: top?.count ?? null,
      top_skills: f ? topSkillIds(f.facets.skill) : [],
      remote: modes.remote,
      hybrid: modes.hybrid,
      onsite: modes.onsite,
      signal,
      signal_days: days,
    });
    const points: ValuePoint[] = series.map((s) => ({ date: s.date, value: s.open, estimated: false }));
    for (const range of RANGES) {
      const ch = computeChange(points, T, range);
      if (ch) {
        changeRows.push({
          as_of: T,
          subject: `company:${c.id}`,
          range,
          base_date: ch.baseDate,
          change: ch.value,
          partial: ch.partial,
          estimated: ch.estimated,
        });
      }
    }
  }
  await tx`delete from screener_company where as_of = ${T}`;
  await insertRows(tx, 'screener_company', companyRows, [
    'as_of', 'company_id', 'slug', 'name', 'domain', 'open', 'top_family', 'top_family_open', 'top_skills',
    'remote', 'hybrid', 'onsite', 'signal', 'signal_days',
  ]);
  await tx`delete from market_change where as_of = ${T} and subject like 'company:%'`;
  await insertRows(tx, 'market_change', changeRows, ['as_of', 'subject', 'range', 'base_date', 'change', 'partial', 'estimated']);

  // 3. Profession and skill rows: work mode and largest profession.
  const subjectRows: Record<string, unknown>[] = [];
  for (const [family, f] of p.perFamily) {
    if (!f) continue;
    const m = workModeCounts(f.facets.workMode);
    subjectRows.push({ as_of: T, kind: 'family', id: family, open: f.total, top_family: null, remote: m.remote, hybrid: m.hybrid, onsite: m.onsite });
  }
  for (const [skill, f] of p.perSkill) {
    if (!f) continue;
    const m = workModeCounts(f.facets.workMode);
    subjectRows.push({
      as_of: T,
      kind: 'skill',
      id: skill,
      open: f.total,
      top_family: topValue(f.facets.family)?.value ?? null,
      remote: m.remote,
      hybrid: m.hybrid,
      onsite: m.onsite,
    });
  }
  await tx`delete from screener_subject where as_of = ${T}`;
  await insertRows(tx, 'screener_subject', subjectRows, ['as_of', 'kind', 'id', 'open', 'top_family', 'remote', 'hybrid', 'onsite']);

  // 4. Unfiltered facet counts.
  const facetRows: Record<string, unknown>[] = [];
  for (const kind of FACET_KINDS) {
    for (const v of p.overall.facets[kind]) facetRows.push({ as_of: T, kind, value: v.value, count: v.count });
  }
  await tx`delete from screener_facet where as_of = ${T}`;
  await insertRows(tx, 'screener_facet', facetRows, ['as_of', 'kind', 'value', 'count']);
  // The total open roles under no filter, kept with the facets.
  await tx`insert into screener_facet (as_of, kind, value, count) values (${T}, 'total', '*', ${p.overall.total})`;

  // 5. Search index.
  const specialtyRows = await tx<{ family: string; specialty: string; open: number }[]>`
    select family, specialty, sum(open)::int as open from profession_daily
    where date = ${T} and specialty <> '' group by family, specialty`;
  const specialtyOpen = new Map(specialtyRows.map((r) => [`${r.family}/${r.specialty}`, r.open]));
  const familyOpen = new Map(p.overall.facets.family.map((f) => [f.value, f.count]));
  const entries: Record<string, unknown>[] = [];
  for (const fam of p.taxonomy.families) {
    const info = familyInfo(fam.id);
    entries.push({
      as_of: T, kind: 'profession', id: fam.id, slug: info.code.toLowerCase(), label: info.name,
      sublabel: info.code, open: familyOpen.get(fam.id) ?? 0, domain: null,
      keywords: `${info.code} ${fam.id} ${info.name}`.toLowerCase(),
    });
    for (const sp of fam.specialties) {
      const open = specialtyOpen.get(`${fam.id}/${sp}`);
      if (!open) continue;
      entries.push({
        as_of: T, kind: 'profession', id: `${fam.id}/${sp}`, slug: info.code.toLowerCase(),
        label: titleCase(sp), sublabel: info.name, open, domain: null,
        keywords: `${sp} ${info.name} ${info.code}`.toLowerCase(),
      });
    }
  }
  for (const c of p.companies) {
    const ticker = companyTicker(c.name);
    entries.push({
      as_of: T, kind: 'company', id: c.id, slug: slugs.get(c.id), label: c.name, sublabel: ticker ?? null,
      open: c.openJobs, domain: c.domain ?? null, keywords: ticker ? ticker.toLowerCase() : '',
    });
  }
  const skillCount = new Map(p.overall.facets.skill.map((s) => [s.value, s.count]));
  const skillSlugMap = skillSlugs(p.taxonomy.skills.map((s) => s.id));
  for (const s of p.taxonomy.skills) {
    const open = skillCount.get(s.id);
    if (!open) continue;
    entries.push({
      as_of: T, kind: 'skill', id: s.id, slug: skillSlugMap.get(s.id), label: skillLabel(s.id),
      sublabel: null, open, domain: null,
      keywords: s.aliases.join(' ').toLowerCase(),
    });
  }
  await tx`delete from search_entry where as_of = ${T}`;
  await insertRows(tx, 'search_entry', entries, ['as_of', 'kind', 'id', 'slug', 'label', 'sublabel', 'open', 'domain', 'keywords']);

  // Old days of derived tables are dropped; only the latest snapshot is served.
  await tx`delete from screener_company where as_of < ${T}`;
  await tx`delete from screener_subject where as_of < ${T}`;
  await tx`delete from screener_facet where as_of < ${T}`;
  await tx`delete from search_entry where as_of < ${T}`;

  const stats = {
    screenerCompanies: companyRows.length,
    screenerCompanyDays: p.companyDays.length,
    screenerCompanyHistoryDays: new Set(p.companyDays.map((d) => d.date)).size,
    screenerCompaniesWithSignal: companyRows.filter((r) => r.signal !== null).length,
    screenerSkills: p.skillIds.length,
    searchEntries: entries.length,
  };
  log.info(stats, 'screener tables written');
  return stats;
}
