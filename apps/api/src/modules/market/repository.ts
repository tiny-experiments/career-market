import {
  countryName,
  familyInfo,
  isTileSkill,
  rankFamilies,
  skillLabel,
} from '@cm/core/codes';
import {
  addDays,
  FIRST_OBSERVED_DAY,
  isBootstrapDay,
  type IsoDay,
} from '@cm/core/dates';
import type { Queries as Sql } from '../../database/client.ts';
import type {
  MarketOverview,
  ProfessionMover,
  SkillTile,
} from '@cm/core/types';
import type { CompanyReaders } from '../companies/domain.ts';
import {
  changes,
  latestBuild,
  NotReadyError,
} from '../../database/readModel.ts';

/** Read-only queries over the read model. Nothing here calls krill. */

const SPARK_DAYS = 30;
/** How many companies the home card pages through. */
const RAMPING_ROWS = 10;

export async function marketOverview(
  sql: Sql,
  companyReaders: CompanyReaders,
): Promise<MarketOverview> {
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

  const marketChange =
    (await changes(sql, asOf, ['market'], '1W')).get('market') ?? null;
  const hasEstimate = daily.some((d) => d.estimated);

  // Professions gaining: share-adjusted change on matched boards.
  const famToday = await sql<
    { family: string; open: number; index_value: number }[]
  >`
    select family, open, index_value from family_daily where date = ${asOf}`;
  const famChanges = await changes(
    sql,
    asOf,
    famToday.map((f) => `family:${f.family}`),
    '1W',
  );
  const sparkFrom = addDays(asOf, -(SPARK_DAYS - 1));
  const famSpark = await sql<
    { family: string; date: IsoDay; index_value: number }[]
  >`
    select family, date, index_value from family_daily where date >= ${sparkFrom} and date <= ${asOf} order by date`;
  const professionsGaining: ProfessionMover[] = rankFamilies(
    famToday.map((f) => {
      const info = familyInfo(f.family);
      return {
        family: f.family,
        code: info.code,
        name: info.name,
        open: f.open,
        change: famChanges.get(`family:${f.family}`) ?? null,
        spark: famSpark
          .filter((s) => s.family === f.family)
          .map((s) => Math.round((f.open * s.index_value) / f.index_value)),
      };
    }),
  ).slice(0, 3);

  // Hottest skills: the largest tool-like skills today, with change once history exists.
  const skillToday = await sql<{ skill: string; open: number }[]>`
    select skill, sum(open)::int as open from skill_daily
    where date = ${asOf} and country = '*' group by skill order by open desc limit 60`;
  const tiles = skillToday.filter((s) => isTileSkill(s.skill)).slice(0, 8);
  const skillChanges = await changes(
    sql,
    asOf,
    tiles.map((s) => `skill:${s.skill}`),
    '1W',
  );
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
    .map((r) => ({
      code: r.country,
      name: countryName(r.country),
      open: r.open,
      share: r.open / totalOpen,
    }));

  const [modes] = await sql<
    { remote: number | null; stated: number | null }[]
  >`select sum(remote)::int as remote, sum(remote + hybrid + onsite)::int as stated
    from profession_snapshot where date = ${asOf}`;
  const signalRows = await sql<{ state: string; companies: number }[]>`
    select state, count(*)::int as companies from company_signal
    where as_of = ${asOf} group by state`;
  const signalCount = (state: string) =>
    signalRows.find((r) => r.state === state)?.companies ?? 0;

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
      note: 'Open roles over time.',
    },
    stats: {
      companies: today.companies,
      newToday: today.opened,
      closedToday: today.closed,
      medianDaysOpen: today.median_days_open,
      remoteShare:
        modes && modes.stated ? (modes.remote ?? 0) / modes.stated : null,
    },
    signalCounts: {
      ramping: signalCount('RAMPING'),
      steady: signalCount('STEADY'),
      cooling: signalCount('COOLING'),
      freezing: signalCount('FREEZING'),
    },
    professionsGaining,
    companiesRamping: await rampingColumn(companyReaders, asOf),
    biggestFreezes: {
      available: false,
      reason: 'Hiring slowdowns are not available yet.',
    },
    hottestSkills,
    countries,
    totalOpen,
    notes,
  };
}

/** Companies ramping: real one-week changes from the company statistics, or an honest empty state. */
async function rampingColumn(
  companyReaders: CompanyReaders,
  asOf: IsoDay,
): Promise<MarketOverview['companiesRamping']> {
  const rows = await companyReaders.ramping(asOf, RAMPING_ROWS);
  if (rows.length > 0) return { available: true, rows };
  return {
    available: false,
    reason: 'No company meets the growth threshold yet.',
  };
}
