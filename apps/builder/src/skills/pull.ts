import { isTileSkill } from '@cm/core/codes';
import { addDays, type IsoDay } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import { skillSlugs } from '@cm/core/skills';
import { SKILL_AGE_EDGES, POSTED_EVER } from '../compute/skillSeries.ts';
import type { PricedRole } from '../compute/skillSalary.ts';
import type { KrillApi } from '../krill/api.ts';
import { SkillKrill, type KrillJob } from '../krill/skillApi.ts';

/** Companies stored per skill (the page shows the first five). */
const COMPANIES_PER_SKILL = 8;
/** Paired skills stored per skill (the page shows the first six). */
const PAIRS_PER_SKILL = 16;
const LATEST_ROLES = 5;
/** Listed per skill before duplicates (the same title at the same company) are dropped. */
const LATEST_FETCH = 10;
/** A company's name and website are looked up again after this many days. */
const COMPANY_REF_DAYS = 14;
/** Salary sample: 10 pages x 100 priced US roles per profession, at most SALARY_PER_COMPANY from one company. */
const SALARY_PAGES = 10;
export const SALARY_PER_COMPANY = 5;
export const SALARY_COUNTRY = 'US';
export const SALARY_CURRENCY = 'USD';

export interface TrackedSkill {
  id: string;
  slug: string;
  /** Open roles naming the skill, every profession (sum of the per-profession facets). */
  total: number;
  /** krill's skill-in-profession counts, largest first. */
  families: { family: string; count: number }[];
}

export interface SkillCut {
  skill: string;
  /** '*' = every profession. */
  family: string;
  cutDate: IsoDay;
  count: number;
}

export interface SkillPulled {
  tracked: TrackedSkill[];
  /** Skills krill could not answer for today; they are left out of today's rows. */
  failed: string[];
  cuts: SkillCut[];
  companies: Map<string, { skill: string; companyId: string; count: number }[]>;
  pairs: Map<string, { other: string; count: number }[]>;
  latest: Map<string, KrillJob[]>;
  /** New or refreshed company names and websites. */
  companyRefs: { id: string; name: string; domain: string | null }[];
  /** Priced US roles per profession. */
  salary: Map<string, PricedRole[]>;
  salarySampleSize: Map<string, number>;
}

/** The largest tool-like skills across every profession, largest first. */
export function pickTrackedSkills(
  familySkills: ReadonlyMap<string, { total: number; skills: { value: string; count: number }[] }>,
  limit: number,
): TrackedSkill[] {
  const byId = new Map<string, Map<string, number>>();
  for (const [family, f] of familySkills) {
    for (const s of f.skills) {
      if (!isTileSkill(s.value)) continue;
      const m = byId.get(s.value) ?? new Map<string, number>();
      m.set(family, (m.get(family) ?? 0) + s.count);
      byId.set(s.value, m);
    }
  }
  const ranked = [...byId.entries()]
    .map(([id, m]) => ({
      id,
      total: [...m.values()].reduce((n, v) => n + v, 0),
      families: [...m.entries()].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
    .slice(0, limit);
  const slugs = skillSlugs(ranked.map((r) => r.id));
  return ranked.map((r) => ({ ...r, slug: slugs.get(r.id) as string }));
}

export async function pullSkillPages(
  deps: { api: KrillApi; sql: Sql; log: Logger; limit: number },
  T: IsoDay,
  familySkills: ReadonlyMap<string, { total: number; skills: { value: string; count: number }[] }>,
): Promise<SkillPulled> {
  const { sql, log } = deps;
  const krill = new SkillKrill(deps.api);
  const tracked = pickTrackedSkills(familySkills, deps.limit);
  const out: SkillPulled = {
    tracked: [],
    failed: [],
    cuts: [],
    companies: new Map(),
    pairs: new Map(),
    latest: new Map(),
    companyRefs: [],
    salary: new Map(),
    salarySampleSize: new Map(),
  };
  log.info({ skills: tracked.length }, 'pulling skill pages');

  for (const skill of tracked) {
    const now = await krill.facets({ skills: skill.id });
    if (!now) {
      log.warn({ skill: skill.id }, 'krill facets failed for skill; its page keeps yesterday’s numbers');
      out.failed.push(skill.id);
      continue;
    }
    out.tracked.push({ ...skill, total: now.total, families: now.facets.family.map((f) => ({ family: f.value, count: f.count })) });
    out.companies.set(
      skill.id,
      now.facets.company.slice(0, COMPANIES_PER_SKILL).map((c) => ({ skill: skill.id, companyId: c.value, count: c.count })),
    );
    out.pairs.set(
      skill.id,
      now.facets.skill.filter((s) => s.value !== skill.id).slice(0, PAIRS_PER_SKILL).map((s) => ({ other: s.value, count: s.count })),
    );

    // Posted-day cuts for the back-cast; the facet's profession breakdown comes with every answer.
    const cutDates = [...SKILL_AGE_EDGES.map((age) => addDays(T, -age)), POSTED_EVER];
    for (const cutDate of cutDates) {
      const res = await krill.facets({ skills: skill.id, postedSince: cutDate });
      if (!res) {
        log.warn({ skill: skill.id, cutDate }, 'krill could not count this cut; it is skipped');
        continue;
      }
      out.cuts.push({ skill: skill.id, family: '*', cutDate, count: res.total });
      for (const f of res.facets.family) out.cuts.push({ skill: skill.id, family: f.value, cutDate, count: f.count });
    }

    out.latest.set(skill.id, dedupeRoles(await krill.latestRoles(skill.id, LATEST_FETCH)).slice(0, LATEST_ROLES));
  }

  // Company names and websites, once per company (a lookup is a krill call).
  const wanted = new Set<string>();
  for (const rows of out.companies.values()) for (const r of rows) wanted.add(r.companyId);
  for (const jobs of out.latest.values()) for (const j of jobs) wanted.add(j.company.id);
  const known = new Set(
    (
      await sql<{ company_id: string }[]>`
        select company_id from company_ref
        where fetched_on > ${addDays(T, -COMPANY_REF_DAYS)} and company_id in ${sql([...wanted, ''])}`
    ).map((r) => r.company_id),
  );
  for (const id of wanted) {
    if (known.has(id)) continue;
    const company = await krill.company(id);
    if (company) out.companyRefs.push({ id: company.id, name: company.name, domain: company.domain ?? null });
  }

  // One priced-role sample per profession that is some skill's main profession.
  const mainFamilies = new Set(out.tracked.map((s) => s.families[0]?.family).filter((f): f is string => !!f));
  for (const family of mainFamilies) {
    const jobs = await krill.pricedRoles(family, SALARY_COUNTRY, SALARY_CURRENCY, SALARY_PAGES);
    const priced: PricedRole[] = [];
    // One employer posting hundreds of near-identical roles must not set the median.
    const perCompany = new Map<string, number>();
    for (const j of jobs) {
      const seen = perCompany.get(j.company.id) ?? 0;
      if (seen >= SALARY_PER_COMPANY) continue;
      perCompany.set(j.company.id, seen + 1);
      const min = j.salary?.annualMin;
      if (j.salary?.currency !== SALARY_CURRENCY || min === null || min === undefined || min <= 0) continue;
      priced.push({ skills: j.skills, annualMin: min, annualMax: j.salary?.annualMax ?? null });
    }
    out.salary.set(family, priced);
    out.salarySampleSize.set(family, priced.length);
  }
  return out;
}

/** "Seattle, WA" for a role with a city and state, else the place label; "Remote" for a remote role without one. */
export function roleLocation(job: KrillJob): string | null {
  const place = job.places[0];
  if (place) {
    // admin1 codes are state letters (CA, WA) for some countries and numbers (11) for others: only show letters.
    if (place.city && place.admin1Code && /^[A-Z]{2,3}$/.test(place.admin1Code)) return `${place.city}, ${place.admin1Code}`;
    if (place.city && place.countryCode && place.label.length > 40) return place.city;
    if (place.label) return place.label;
  }
  return job.workMode === 'remote' ? 'Remote' : null;
}

/** The same title at the same company counts once (employers post one role per location). */
export function dedupeRoles(jobs: readonly KrillJob[]): KrillJob[] {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const key = `${j.company.id}\u0000${j.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
