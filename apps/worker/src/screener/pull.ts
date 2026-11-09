import { concurrentMap } from '../concurrent.ts';
import { isTileSkill } from '@cm/core/codes';
import type { IsoDay } from '@cm/core/dates';
import type { Logger } from '@cm/core/logger';
import type { KrillApi } from '../krill/api.ts';
import type { KrillTaxonomy } from '../krill/schemas.ts';
import { COMPANY_HISTORY_DAYS, SCREENER_COMPANIES, SCREENER_SKILLS } from './compute.ts';
import { ScreenerKrill, type CompanyDayItem, type KrillCompany, type WideFacets } from './krill.ts';

/** Everything the Screener and the search index read from krill for one snapshot day. */
export interface ScreenerPulled {
  taxonomy: KrillTaxonomy;
  companies: KrillCompany[];
  companyDays: CompanyDayItem[];
  /** Facets of each listed company: skills, family, work mode (null: krill answered 500). */
  perCompany: Map<string, WideFacets | null>;
  /** Unfiltered facets: summary strip, dropdown values, skill counts for search. */
  overall: WideFacets;
  perFamily: Map<string, WideFacets | null>;
  perSkill: Map<string, WideFacets | null>;
  skillIds: string[];
}

export async function pullScreener(api: KrillApi, T: IsoDay, families: readonly string[], log: Logger): Promise<ScreenerPulled> {
  const krill = new ScreenerKrill(api.client);
  const taxonomy = await api.taxonomy();

  log.info({ limit: SCREENER_COMPANIES }, 'screener: pulling the largest companies');
  const companies = await krill.topCompanies(SCREENER_COMPANIES);
  const ids = companies.map((c) => c.id);

  log.info({ companies: ids.length, days: COMPANY_HISTORY_DAYS }, 'screener: pulling company daily statistics');
  const companyDays = await krill.companyDays(ids, T, COMPANY_HISTORY_DAYS);

  log.info('screener: pulling unfiltered facets');
  const overall = await krill.facets({ limit: 500 });
  if (!overall) throw new Error('krill /v1/facets answered 500 without filters');

  const perFamily = new Map<string, WideFacets | null>();
  await concurrentMap(families, async (family) => { perFamily.set(family, await krill.facets({ family, limit: 300 })); });

  const skillIds = overall.facets.skill
    .filter((s) => isTileSkill(s.value))
    .slice(0, SCREENER_SKILLS)
    .map((s) => s.value);
  log.info({ skills: skillIds.length }, 'screener: pulling facets per skill');
  const perSkill = new Map<string, WideFacets | null>();
  await concurrentMap(skillIds, async (id) => { perSkill.set(id, await krill.facets({ skills: id, limit: 5 })); });

  log.info({ companies: ids.length }, 'screener: pulling facets per company');
  const perCompany = new Map<string, WideFacets | null>();
  await concurrentMap(ids, async (id) => { perCompany.set(id, await krill.facets({ company: id, limit: 25 })); });

  return { taxonomy, companies, companyDays, perCompany, overall, perFamily, perSkill, skillIds };
}
