import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import { concurrentMap } from '../concurrent.ts';
import { ContextDevError, type BrandSearch, type LogoProbe } from './contextDev.ts';
import { brandName, canSearchBrand, freeDomain, matchBrand, type DomainSource } from './domain.ts';

export interface LogoSettings {
  /** Paid lookups a day, across runs. */
  dailyCredits: number;
  /** Logo checks a day, across runs. */
  dailyChecks: number;
  /** Paid lookups in one run. */
  lookupsPerRun: number;
  /** Logo checks in one run. */
  checksPerRun: number;
  /** A company with no result, or an old one, is looked at again after this many days. */
  recheckDays: number;
  /** A domain with only a placeholder logo is checked again after this many days. */
  monogramRecheckDays: number;
  /** Pause between paid lookups, milliseconds. */
  lookupIntervalMs: number;
}

export interface LogoDeps {
  sql: Sql;
  log: Logger;
  settings: LogoSettings;
  /** Absent without a server key: only the free sources run. */
  brandSearch?: BrandSearch;
  /** Absent without a public client id: domains are kept unverified. */
  logoProbe?: LogoProbe;
}

export interface LogoStats {
  companies: number;
  freeChanged: number;
  lookups: number;
  brandFound: number;
  logoChecks: number;
  monograms: number;
  /** Requests that timed out or failed on the network; those companies are retried next run. */
  skipped: number;
  stoppedEarly: boolean;
}

interface CompanyState {
  company_id: string;
  name: string;
  directory_domain: string | null;
  careers_url: string | null;
  has_override: boolean;
  override_domain: string | null;
  domain: string | null;
  source: DomainSource | null;
  name_checked: string | null;
  brand_checked_at: Date | null;
  logo: 'real' | 'monogram' | null;
}

/** Timeouts and network errors tolerated in one step before it gives up. */
const MAX_SKIPS = 5;

/** A refusal from the service ends the run; one slow request only skips that company. */
function failureAction(err: unknown, step: { skips: number }, stats: LogoStats, log: Logger, what: string): 'skip' | 'stop' {
  stats.skipped += 1;
  step.skips += 1;
  if (!(err instanceof ContextDevError) && step.skips < MAX_SKIPS) return 'skip';
  log.warn({ err: String(err), skipped: step.skips }, `${what} paused until the next run`);
  stats.stoppedEarly = true;
  return 'stop';
}

/** What the company's domain should be before anything is paid for. */
export function decideFree(c: CompanyState, jobHosts: readonly string[]): { domain: string | null; source: DomainSource } {
  if (c.has_override) return { domain: c.override_domain, source: 'manual' };
  // A brand result is resolved once: it stays until the company is renamed.
  if (c.source === 'brand' && c.name_checked === c.name) return { domain: c.domain, source: 'brand' };
  const free = freeDomain({ directoryDomain: c.directory_domain, careersUrl: c.careers_url, jobHosts });
  return free ?? { domain: null, source: 'none' };
}

/** Publishes resolved domains to `company` and the tables that copy its domain. */
export async function applyCompanyDomains(tx: Sql): Promise<void> {
  await tx`
    update company c set domain = r.effective
    from (select company_id, case when logo = 'monogram' then null else domain end as effective from company_domain) r
    where c.company_id = r.company_id and c.domain is distinct from r.effective`;
  await tx`update screener_company t set domain = c.domain from company c where t.company_id = c.company_id and t.domain is distinct from c.domain`;
  await tx`update search_entry t set domain = c.domain from company c where t.kind = 'company' and t.id = c.company_id and t.domain is distinct from c.domain`;
  await tx`update profession_company t set domain = c.domain from company c where t.company_id = c.company_id and t.domain is distinct from c.domain`;
  await tx`update profession_latest_role t set company_domain = c.domain from company c where t.company_id = c.company_id and t.company_domain is distinct from c.domain`;
  await tx`update company_ref t set domain = c.domain from company c where t.company_id = c.company_id and t.domain is distinct from c.domain`;
}

const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);

async function loadStates(sql: Sql): Promise<CompanyState[]> {
  return sql<CompanyState[]>`
    select c.company_id, c.name, c.directory_domain, c.careers_url,
      o.company_id is not null as has_override, o.domain as override_domain,
      d.domain, d.source, d.name_checked, d.brand_checked_at, d.logo
    from company c
    left join company_domain d using (company_id)
    left join company_domain_override o using (company_id)
    where c.open > 0
    order by c.rank, c.company_id`;
}

async function loadJobHosts(sql: Sql): Promise<Map<string, string[]>> {
  const rows = await sql<{ company_id: string; host: string }[]>`
    select company_id, host from (
      select company_id, lower(substring(payload->>'url' from '^https?://([^/:]+)')) as host, count(*) as n
      from job_mirror group by 1, 2
    ) h where host is not null order by company_id, n desc, host`;
  const hosts = new Map<string, string[]>();
  for (const { company_id, host } of rows) {
    const list = hosts.get(company_id);
    if (list) list.push(host);
    else hosts.set(company_id, [host]);
  }
  return hosts;
}

async function writeFree(sql: Sql, states: CompanyState[], jobHosts: Map<string, string[]>): Promise<number> {
  const changed: { company_id: string; domain: string | null; source: DomainSource }[] = [];
  for (const c of states) {
    const next = decideFree(c, jobHosts.get(c.company_id) ?? []);
    if (next.domain !== c.domain || next.source !== c.source) {
      changed.push({ company_id: c.company_id, ...next });
      // Later steps in this run see the new state; a new domain has an unknown logo.
      if (next.domain !== c.domain) c.logo = null;
      c.domain = next.domain;
      c.source = next.source;
    }
  }
  for (let i = 0; i < changed.length; i += 1000) {
    const rows = changed.slice(i, i + 1000);
    await sql`
      insert into company_domain (company_id, domain, source)
      select * from unnest(${sql.array(rows.map((r) => r.company_id))}::text[], ${sql.array(rows.map((r) => r.domain) as string[])}::text[], ${sql.array(rows.map((r) => r.source))}::text[])
      on conflict (company_id) do update set
        logo = case when company_domain.domain is distinct from excluded.domain then null else company_domain.logo end,
        logo_checked_at = case when company_domain.domain is distinct from excluded.domain then null else company_domain.logo_checked_at end,
        domain = excluded.domain, source = excluded.source, checked_at = now()`;
  }
  return changed.length;
}

async function spentToday(sql: Sql, column: 'brand_checked_at' | 'logo_checked_at'): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from company_domain where ${sql(column)} >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`;
  return row?.n ?? 0;
}

/** Companies due a paid lookup: no usable domain and no fresh answer, biggest employers first. */
function brandCandidates(states: CompanyState[], jobHosts: Map<string, string[]>, recheckBefore: Date): CompanyState[] {
  return states.filter((c) => {
    if (c.has_override || c.source === 'brand') return false;
    if (c.domain && c.logo !== 'monogram') return false;
    if (c.brand_checked_at && c.brand_checked_at >= recheckBefore && c.name_checked === c.name) return false;
    return canSearchBrand(c.name, [c.careers_url, ...(jobHosts.get(c.company_id) ?? [])]);
  });
}

async function runBrandLookups(deps: LogoDeps, due: CompanyState[], limit: number, stats: LogoStats): Promise<void> {
  const { sql, log, settings, brandSearch } = deps;
  if (!brandSearch || limit <= 0) return;
  const step = { skips: 0 };
  for (const c of due.slice(0, limit)) {
    if (stats.lookups > 0 && settings.lookupIntervalMs > 0) await new Promise((r) => setTimeout(r, settings.lookupIntervalMs));
    let domain: string | null;
    try {
      domain = matchBrand(c.name, await brandSearch(brandName(c.name)));
    } catch (err) {
      if (failureAction(err, step, stats, log, 'brand lookups') === 'stop') return;
      continue;
    }
    stats.lookups += 1;
    if (domain) {
      stats.brandFound += 1;
      c.domain = domain;
      c.source = 'brand';
      c.logo = null;
      await sql`
        update company_domain set domain = ${domain}, source = 'brand', name_checked = ${c.name},
          brand_checked_at = now(), logo = null, logo_checked_at = null, checked_at = now()
        where company_id = ${c.company_id}`;
    } else {
      await sql`update company_domain set name_checked = ${c.name}, brand_checked_at = now(), checked_at = now() where company_id = ${c.company_id}`;
    }
  }
}

async function runLogoChecks(deps: LogoDeps, limit: number, stats: LogoStats): Promise<void> {
  const { sql, log, logoProbe, settings } = deps;
  if (!logoProbe || limit <= 0) return;
  const staleBefore = daysAgo(settings.recheckDays);
  const placeholderBefore = daysAgo(settings.monogramRecheckDays);
  const due = await sql<{ company_id: string; domain: string }[]>`
    select d.company_id, d.domain from company_domain d join company c using (company_id)
    where d.domain is not null and c.open > 0
      and (d.logo is null or d.logo_checked_at < ${staleBefore} or (d.logo = 'monogram' and d.logo_checked_at < ${placeholderBefore}))
    order by c.rank, c.company_id limit ${limit}`;
  const step = { skips: 0 };
  let stopped = false;
  await concurrentMap(
    due,
    async (row) => {
      if (stopped) return;
      let logo: 'real' | 'monogram';
      try {
        logo = await logoProbe(row.domain);
      } catch (err) {
        if (failureAction(err, step, stats, log, 'logo checks') === 'stop') stopped = true;
        return;
      }
      stats.logoChecks += 1;
      if (logo === 'monogram') stats.monograms += 1;
      await sql`update company_domain set logo = ${logo}, logo_checked_at = now() where company_id = ${row.company_id}`;
    },
    6,
  );
}

/**
 * One pass: free sources for every company, then logo checks and paid lookups within
 * today's budgets, biggest employers first. Safe to repeat; a stopped pass resumes next run.
 */
export async function resolveCompanyDomains(deps: LogoDeps): Promise<LogoStats> {
  const { sql, log, settings } = deps;
  const recheckBefore = daysAgo(settings.recheckDays);
  const states = await loadStates(sql);
  const jobHosts = await loadJobHosts(sql);
  const stats: LogoStats = { companies: states.length, freeChanged: 0, lookups: 0, brandFound: 0, logoChecks: 0, monograms: 0, skipped: 0, stoppedEarly: false };

  stats.freeChanged = await writeFree(sql, states, jobHosts);

  const checksSpent = await spentToday(sql, 'logo_checked_at');
  const checksLeft = () => Math.min(settings.checksPerRun, settings.dailyChecks - checksSpent) - stats.logoChecks;

  // Check the free domains first: a domain with no real logo is worth a paid lookup.
  await runLogoChecks(deps, checksLeft(), stats);
  const logos = await sql<{ company_id: string; logo: CompanyState['logo'] }[]>`select company_id, logo from company_domain`;
  const logoOf = new Map(logos.map((r) => [r.company_id, r.logo]));
  for (const c of states) c.logo = logoOf.get(c.company_id) ?? null;

  const creditsSpent = await spentToday(sql, 'brand_checked_at');
  const due = brandCandidates(states, jobHosts, recheckBefore);
  await runBrandLookups(deps, due, Math.min(settings.lookupsPerRun, settings.dailyCredits - creditsSpent), stats);

  // Brand results are new domains; check them in the same pass when the budget allows.
  await runLogoChecks(deps, checksLeft(), stats);
  await sql.begin((tx) => applyCompanyDomains(tx as unknown as Sql));
  log.info(stats, 'company domains resolved');
  return stats;
}
