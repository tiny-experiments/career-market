import { companyTicker, familyInfo, TICKER_FAMILIES } from '@cm/core/codes';
import type { Queries as Sql } from '../../database/client.ts';
import { professionHref } from '@cm/core/professions';
import type { ChromePayload, TickerItem } from '@cm/core/types';
import { changes, latestBuild } from '../../database/readModel.ts';

export async function chrome(sql: Sql): Promise<ChromePayload> {
  const build = await latestBuild(sql);
  if (!build) return { asOf: null, builtAt: null, boards: null, ticker: [] };
  const { asOf } = build;
  const [day] = await sql<
    { boards: number | null }[]
  >`select boards from market_daily where date = ${asOf}`;

  const famRows = await sql<{ family: string; open: number }[]>`
    select family, open from family_daily where date = ${asOf} and family in ${sql([...TICKER_FAMILIES])}`;
  const famOpen = new Map(famRows.map((r) => [r.family, r.open]));
  const famChanges = await changes(
    sql,
    asOf,
    TICKER_FAMILIES.map((f) => `family:${f}`),
    '1W',
  );
  const ticker: TickerItem[] = TICKER_FAMILIES.filter((f) =>
    famOpen.has(f),
  ).map((f) => {
    const info = familyInfo(f);
    return {
      code: info.code,
      name: info.name,
      href: professionHref(f),
      open: famOpen.get(f) as number,
      change: famChanges.get(`family:${f}`) ?? null,
    };
  });

  const companies = await sql<
    { company_id: string; slug: string; name: string; open: number }[]
  >`
    select company_id, slug, name, open from company where updated_on = ${asOf} order by rank limit 50`;
  const picked = companies
    .filter((x) => companyTicker(x.name))
    .slice(0, 2)
    .reverse();
  const companyChanges = await changes(
    sql,
    asOf,
    picked.map((c) => `cpage:${c.company_id}`),
    '1W',
  );
  for (const c of picked) {
    const change = companyChanges.get(`cpage:${c.company_id}`) ?? null;
    ticker.push({
      code: companyTicker(c.name) as string,
      name: c.name,
      href: `/companies/${c.slug}`,
      open: c.open,
      change,
      ...(change
        ? {}
        : {
            note: 'Company change appears once a company has comparable days',
          }),
    });
  }
  return { asOf, builtAt: build.builtAt, boards: day?.boards ?? null, ticker };
}
