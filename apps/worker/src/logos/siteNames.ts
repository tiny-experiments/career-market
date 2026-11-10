import { cleanSiteName, isCodeName } from '@cm/core/companyName';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import { concurrentMap } from '../concurrent.ts';

/**
 * Names for companies the directory knows only by an Oracle Recruiting tenant code
 * ("fa-eqzh-saasfaprod1", "Eeho"). Each tenant's careers site states the employer in its
 * site name (`og:site_name`, else the page title: "Avient" at fa-eqzh-saasfaprod1). The
 * sites come from the company's own job links; each is read once and again after
 * `recheckDays`, and the name that covers the most open roles names the company.
 */

/** Fetches a careers page as text; throws on a network error or a non-2xx answer. */
export type SitePage = (url: string) => Promise<string>;

const TIMEOUT_MS = 15_000;
/** Answers past this size are cut: the site name sits in the head. */
const MAX_PAGE_BYTES = 256 * 1024;
/**
 * Site pages read in one run; the rest wait for the next run. High enough that one run reads
 * every tenant site the directory links to (about 1,400 in November 2026, three minutes).
 */
export const SITE_READS_PER_RUN = 5000;
const READ_CONCURRENCY = 8;

export function createSitePage(fetchImpl: typeof fetch = fetch): SitePage {
  return async (url) => {
    const res = await fetchImpl(url, {
      headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (compatible; career-market)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`careers site answered ${res.status}`);
    return (await res.text()).slice(0, MAX_PAGE_BYTES);
  };
}

// Every Oracle Recruiting pod: <code>.fa.ocs, .fa.us2, .fa.em1.ukg (UK government) and the bare
// <code>.fa.oraclecloud.com.
const ORACLE_SITE = /^https:\/\/([a-z0-9-]+\.fa(?:\.[a-z0-9-]+)*\.oraclecloud\.com)(?::443)?\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/?#]+)/i;
/** The same match for Postgres, which reads the host and site out of job_mirror. */
const ORACLE_SITE_SQL = String.raw`^https://([a-z0-9-]+\.fa(?:\.[a-z0-9-]+)*\.oraclecloud\.com)(?::443)?/hcmUI/CandidateExperience/[^/]+/sites/([^/?#]+)`;

/** The English careers site an Oracle Recruiting job link belongs to, or null for any other link. */
export function oracleSiteUrl(link: string): string | null {
  const m = ORACLE_SITE.exec(link);
  return m ? `https://${m[1]!.toLowerCase()}/hcmUI/CandidateExperience/en/sites/${m[2]}` : null;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', reg: '®', copy: '©', trade: '™',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', szlig: 'ß',
};
// Latin letters with a mark: &eacute; &Eacute; &ouml; &ccedil; &atilde; &oslash; &aring;.
const MARKS: Record<string, string> = { acute: '\u0301', grave: '\u0300', circ: '\u0302', uml: '\u0308', tilde: '\u0303', cedil: '\u0327', ring: '\u030a' };
function entity(code: string): string | undefined {
  if (ENTITIES[code]) return ENTITIES[code];
  if (/^[oO]slash$/.test(code)) return code[0] === 'o' ? 'ø' : 'Ø';
  const m = /^([a-zA-Z])(acute|grave|circ|uml|tilde|cedil|ring)$/.exec(code);
  return m ? (m[1]! + MARKS[m[2]!]!).normalize('NFC') : undefined;
}
function decode(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (all, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
      return entity(code) ?? entity(code.toLowerCase()) ?? all;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** The name a careers page gives its site: `og:site_name`, else its title. */
export function siteNameFromPage(html: string): string | null {
  const meta = /<meta\s[^>]*property=["']og:site_name["'][^>]*>/i.exec(html)?.[0];
  const content = meta ? /\scontent=(["'])(.*?)\1/i.exec(meta)?.[2] : undefined;
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  for (const raw of [content, title]) {
    const text = raw === undefined ? '' : decode(raw);
    if (text) return text;
  }
  return null;
}

/**
 * Where a site sits among its tenant's sites: Oracle's default site `CX` first, then `CX_<n>`
 * by number, then the rest. A tenant lists its main brand on its default site.
 */
function siteOrder(url: string | undefined): number {
  const m = /\/sites\/CX(?:_(\d+))?$/i.exec(url ?? '');
  if (!m) return Number.MAX_SAFE_INTEGER;
  return m[1] === undefined ? 0 : Number(m[1]) + 1;
}

/**
 * The name for a company from its sites' names, each weighted by the open roles on that
 * site: the cleaned name covering the most roles, the one on the tenant's default site when
 * names tie. Null when no site names anyone, or when sites that name no one ("Candidate
 * Experience site", "Global") hold more roles than every named site together: then a sub-brand
 * on a side site would name the whole tenant.
 */
export function pickSiteName(sites: readonly { name: string | null; jobs: number; url?: string }[]): string | null {
  const totals = new Map<string, { name: string; jobs: number; order: number }>();
  let unnamedJobs = 0;
  let namedJobs = 0;
  for (const site of sites) {
    if (site.name === null) continue;
    const name = cleanSiteName(site.name);
    if (!name) {
      unnamedJobs += site.jobs;
      continue;
    }
    namedJobs += site.jobs;
    const key = name.toLowerCase();
    const order = siteOrder(site.url);
    const seen = totals.get(key);
    if (seen) {
      seen.jobs += site.jobs;
      seen.order = Math.min(seen.order, order);
    } else totals.set(key, { name, jobs: site.jobs, order });
  }
  if (unnamedJobs > namedJobs) return null;
  let best: { name: string; jobs: number; order: number } | null = null;
  for (const entry of totals.values()) {
    const better =
      !best ||
      entry.jobs > best.jobs ||
      (entry.jobs === best.jobs && (entry.order < best.order || (entry.order === best.order && entry.name < best.name)));
    if (better) best = entry;
  }
  return best?.name ?? null;
}

export interface SiteNameStats {
  sites: number;
  read: number;
  failed: number;
}

/**
 * Brings `company_site_name` up to date: one row per (company, Oracle site) among
 * companies known only by a code and without a hand-checked name, with that site's open
 * roles, then reads the sites that are new or older than `recheckDays`.
 */
export async function refreshSiteNames(deps: { sql: Sql; log: Logger; sitePage: SitePage; recheckDays: number }): Promise<SiteNameStats> {
  const { sql, log, sitePage, recheckDays } = deps;
  const found = await sql<{ company_id: string; name: string; host: string; site: string; jobs: number }[]>`
    select j.company_id, c.name, lower(m[1]) as host, m[2] as site, count(*)::int as jobs
    from job_mirror j
    join company c using (company_id)
    cross join lateral regexp_match(j.payload->>'url', ${ORACLE_SITE_SQL}, 'i') m
    where m is not null
      and not exists (select 1 from company_name_override o where o.company_id = j.company_id)
    group by 1, 2, 3, 4`;
  const rows = found
    .filter((r) => isCodeName(r.name))
    .map((r) => ({ company_id: r.company_id, site_url: `https://${r.host}/hcmUI/CandidateExperience/en/sites/${r.site}`, jobs: r.jobs }));

  // Not one transaction: a run cut short leaves rows the next run corrects.
  await sql`delete from company_site_name
    where (company_id, site_url) not in (
      select * from unnest(${sql.array(rows.map((r) => r.company_id))}::text[], ${sql.array(rows.map((r) => r.site_url))}::text[]))`;
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    await sql`
      insert into company_site_name (company_id, site_url, jobs)
      select * from unnest(${sql.array(batch.map((r) => r.company_id))}::text[], ${sql.array(batch.map((r) => r.site_url))}::text[], ${sql.array(batch.map((r) => r.jobs))}::int[])
      on conflict (company_id, site_url) do update set jobs = excluded.jobs`;
  }

  const staleBefore = new Date(Date.now() - recheckDays * 86_400_000);
  // Sites never read go first, then the oldest; within each, the most open roles.
  const due = await sql<{ site_url: string }[]>`
    select site_url from company_site_name
    where checked_at is null or checked_at < ${staleBefore}
    group by site_url order by bool_or(checked_at is null) desc, max(jobs) desc, site_url limit ${SITE_READS_PER_RUN}`;
  const stats: SiteNameStats = { sites: rows.length, read: 0, failed: 0 };
  await concurrentMap(
    due,
    async ({ site_url }) => {
      let name: string | null;
      try {
        name = siteNameFromPage(await sitePage(site_url));
      } catch (err) {
        // A tenant that is down is read again next run; the name already held stays.
        stats.failed += 1;
        log.debug({ err: String(err), site: site_url }, 'careers site not read');
        return;
      }
      stats.read += 1;
      await sql`update company_site_name set site_name = ${name}, checked_at = now() where site_url = ${site_url}`;
    },
    READ_CONCURRENCY,
  );
  log.info(stats, 'careers site names read');
  return stats;
}
