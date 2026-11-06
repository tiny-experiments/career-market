import { companyTicker, countryName, familyInfo, isTileSkill, rankFamilies, skillLabel, TICKER_FAMILIES } from '@cm/core/codes';
import { addDays, FIRST_OBSERVED_DAY, isBootstrapDay, type IsoDay, type Range } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Change, ChromePayload, MarketOverview, ProfessionMover, SkillTile, TickerItem } from '@cm/core/types';
import { companiesRamping } from './companyModel.ts';

/** Read-only queries over the read model. Nothing here calls krill. */

const SPARK_DAYS = 30;

interface ChangeRow {
  subject: string;
  range: Range;
  base_date: IsoDay;
  change: number;
  partial: boolean;
  estimated: boolean;
}

export class NotReadyError extends Error {
  constructor() {
    super('the read model has no finished build yet');
  }
}

export async function latestBuild(sql: Sql): Promise<{ asOf: IsoDay; builtAt: string } | null> {
  const [row] = await sql<{ snapshot_date: IsoDay; finished_at: Date }[]>`
    select snapshot_date, finished_at from build_run
    where status = 'ok' order by snapshot_date desc, finished_at desc limit 1`;
  return row ? { asOf: row.snapshot_date, builtAt: row.finished_at.toISOString() } : null;
}

async function changes(sql: Sql, asOf: IsoDay, subjects: string[], range: Range): Promise<Map<string, Change>> {
  if (subjects.length === 0) return new Map();
  const rows = await sql<ChangeRow[]>`
    select subject, range, base_date, change, partial, estimated from market_change
    where as_of = ${asOf} and range = ${range} and subject in ${sql(subjects)}`;
  return new Map(
    rows.map((r) => [
      r.subject,
      { range: r.range, value: r.change, baseDate: r.base_date, partial: r.partial, estimated: r.estimated },
    ]),
  );
}

export async function chrome(sql: Sql): Promise<ChromePayload> {
  const build = await latestBuild(sql);
  if (!build) return { asOf: null, builtAt: null, boards: null, ticker: [] };
  const { asOf } = build;
  const [day] = await sql<{ boards: number | null }[]>`select boards from market_daily where date = ${asOf}`;

  const famRows = await sql<{ family: string; open: number }[]>`
    select family, open from family_daily where date = ${asOf} and family in ${sql([...TICKER_FAMILIES])}`;
  const famOpen = new Map(famRows.map((r) => [r.family, r.open]));
  const famChanges = await changes(sql, asOf, TICKER_FAMILIES.map((f) => `family:${f}`), '1W');
  const ticker: TickerItem[] = TICKER_FAMILIES.filter((f) => famOpen.has(f)).map((f) => {
    const info = familyInfo(f);
    return {
      code: info.code,
      name: info.name,
      href: null,
      open: famOpen.get(f) as number,
      change: famChanges.get(`family:${f}`) ?? null,
    };
  });

  const companies = await sql<{ company_id: string; slug: string; name: string; open: number }[]>`
    select company_id, slug, name, open from company where updated_on = ${asOf} order by rank limit 50`;
  const picked = companies.filter((x) => companyTicker(x.name)).slice(0, 2).reverse();
  const companyChanges = await changes(sql, asOf, picked.map((c) => `company:${c.company_id}`), '1W');
  for (const c of picked) {
    const change = companyChanges.get(`company:${c.company_id}`) ?? null;
    ticker.push({
      code: companyTicker(c.name) as string,
      name: c.name,
      href: `/companies/${c.slug}`,
      open: c.open,
      change,
      ...(change ? {} : { note: 'Company change appears once a company has comparable days' }),
    });
  }
  return { asOf, builtAt: build.builtAt, boards: day?.boards ?? null, ticker };
}

export async function marketOverview(sql: Sql): Promise<MarketOverview> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const { asOf } = build;

  const daily = await sql<
    {
      date: IsoDay;
      estimated: boolean;
      open: number;
      open_on_today_boards: number;
      opened: number;
      closed: number;
      companies: number | null;
      median_days_open: number | null;
    }[]
  >`select date, estimated, open, open_on_today_boards, opened, closed, companies, median_days_open
    from market_daily where date <= ${asOf} order by date`;
  const today = daily.find((d) => d.date === asOf);
  if (!today) throw new NotReadyError();

  const marketChange = (await changes(sql, asOf, ['market'], '1W')).get('market') ?? null;
  const hasEstimate = daily.some((d) => d.estimated);

  // Professions gaining: share-adjusted change on matched boards.
  const famToday = await sql<{ family: string; open: number; index_value: number }[]>`
    select family, open, index_value from family_daily where date = ${asOf}`;
  const famChanges = await changes(sql, asOf, famToday.map((f) => `family:${f.family}`), '1W');
  const sparkFrom = addDays(asOf, -(SPARK_DAYS - 1));
  const famSpark = await sql<{ family: string; date: IsoDay; index_value: number }[]>`
    select family, date, index_value from family_daily where date >= ${sparkFrom} and date <= ${asOf} order by date`;
  const professionsGaining: ProfessionMover[] = rankFamilies(famToday
    .map((f) => {
      const info = familyInfo(f.family);
      return {
        family: f.family,
        code: info.code,
        name: info.name,
        open: f.open,
        change: famChanges.get(`family:${f.family}`) ?? null,
        spark: famSpark.filter((s) => s.family === f.family).map((s) => Math.round((f.open * s.index_value) / f.index_value)),
      };
    }))
    .slice(0, 3);

  // Hottest skills: the largest tool-like skills today, with change once history exists.
  const skillToday = await sql<{ skill: string; open: number }[]>`
    select skill, sum(open)::int as open from skill_daily
    where date = ${asOf} and country = '*' group by skill order by open desc limit 60`;
  const tiles = skillToday.filter((s) => isTileSkill(s.skill)).slice(0, 8);
  const skillChanges = await changes(sql, asOf, tiles.map((s) => `skill:${s.skill}`), '1W');
  const skillSpark = await sql<{ skill: string; date: IsoDay; open: number }[]>`
    select skill, date, sum(open)::int as open from skill_daily
    where country = '*' and date >= ${sparkFrom} and date <= ${asOf} and skill in ${sql(tiles.map((t) => t.skill).concat(['']))}
    group by skill, date order by date`;
  const hottestSkills: SkillTile[] = tiles.map((s) => ({
    id: s.skill,
    label: skillLabel(s.skill),
    open: s.open,
    change: skillChanges.get(`skill:${s.skill}`) ?? null,
    spark: skillSpark.filter((x) => x.skill === s.skill).map((x) => x.open),
  }));

  // Where the jobs are: first located country of each job (krill daily_stat rule).
  const countryRows = await sql<{ country: string; open: number }[]>`
    select country, sum(open)::int as open from profession_daily
    where date = ${asOf} group by country order by open desc`;
  const totalOpen = countryRows.reduce((n, r) => n + r.open, 0) || today.open;
  const countries = countryRows
    .filter((r) => r.country !== '')
    .map((r) => ({ code: r.country, name: countryName(r.country), open: r.open, share: r.open / totalOpen }));

  const notes = await sql<{ rule: string; text: string }[]>`
    select rule, text from market_note where date = ${asOf} order by rank limit 3`;

  return {
    asOf,
    builtAt: build.builtAt,
    headline: { open: today.open, change: marketChange },
    series: daily.map((d) => ({
      date: d.date,
      open: d.open_on_today_boards,
      new: d.opened,
      closed: d.closed,
      estimated: d.estimated,
      bootstrap: isBootstrapDay(d.date),
    })),
    firstObservedDay: FIRST_OBSERVED_DAY,
    backcast: {
      available: hasEstimate,
      note: hasEstimate
        ? 'Before 2 Nov 2026 the line is estimated: a survival-corrected back-cast from the posted dates of open jobs and the closings krill detects.'
        : 'Estimated history before 2 Nov 2026 appears once enough closings are sampled to fit the survival curve.',
    },
    stats: {
      companies: today.companies,
      newToday: today.opened,
      closedToday: today.closed,
      medianDaysOpen: today.median_days_open,
    },
    professionsGaining,
    companiesRamping: await rampingColumn(sql, asOf),
    biggestFreezes: {
      available: false,
      reason: 'Needs 90 days of company openings and closings (krill K2); expected from Feb 2027.',
    },
    hottestSkills,
    countries,
    totalOpen,
    notes,
  };
}

/** Companies ramping: real one-week changes from the company statistics, or an honest empty state. */
async function rampingColumn(sql: Sql, asOf: IsoDay): Promise<MarketOverview['companiesRamping']> {
  const rows = await companiesRamping(sql, asOf, 3);
  if (rows.length > 0) return { available: true, rows };
  return {
    available: false,
    reason: 'No company with at least 300 open roles has grown yet over the comparable days krill has company statistics for.',
  };
}
