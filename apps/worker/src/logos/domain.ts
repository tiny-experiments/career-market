import { parse } from 'tldts';

/**
 * The rules that decide which website belongs to a company. All pure: the
 * resolver feeds them directory data, careers links and brand-search results.
 */

/** Hiring platforms and page hosts: a link here says nothing about the employer's own site. */
const PLATFORM_DOMAINS = new Set([
  // Applicant tracking systems.
  'adp.com', 'applytojob.com', 'ashbyhq.com', 'avature.net', 'bamboohr.com', 'beamery.com', 'breezy.hr',
  'bullhornstaffing.com', 'careerpuck.com', 'ceridian.com', 'cloud.sap', 'comeet.co', 'comeet.com',
  'dayforcehcm.com', 'dover.com', 'eightfold.ai', 'freshteam.com', 'gem.com', 'greenhouse.io', 'hibob.com',
  'hirebridge.com', 'homerun.co', 'hrmdirect.com', 'icims.com', 'jazz.co', 'jazzhr.com', 'join.com',
  'jobs2web.com', 'jobscore.com', 'jobvite.com', 'kula.ai', 'lever.co', 'myworkday.com', 'myworkdayjobs.com',
  'myworkdaysite.com', 'onlyfy.jobs', 'oracle.com', 'oraclecloud.com', 'paycomonline.net', 'paylocity.com',
  'personio.com', 'personio.de', 'phenom.com', 'phenompeople.com', 'pinpointhq.com', 'prescreenapp.io',
  'recruitee.com', 'recruiterbox.com', 'rippling.com', 'sapsf.com', 'sapsf.eu', 'smartrecruiters.com',
  'softgarden.io', 'successfactors.com', 'successfactors.eu', 'tal.net', 'talentlyft.com', 'taleo.net',
  'teamtailor.com', 'trakstar.com', 'ukg.com', 'ultipro.com', 'workable.com', 'workday.com', 'zohorecruit.com',
  // Job boards.
  'glassdoor.com', 'indeed.com', 'linkedin.com', 'wellfound.com',
  // General page hosts.
  'airtable.com', 'carrd.co', 'framer.website', 'github.io', 'netlify.app', 'notion.site', 'pages.dev',
  'typeform.com', 'vercel.app', 'webflow.io', 'wixsite.com',
]);

/** Registrable domain of a host or URL, on the public suffix list; null for IPs and junk. */
export function registrableDomain(hostOrUrl: string): string | null {
  const value = hostOrUrl.trim().toLowerCase();
  if (!value) return null;
  const parsed = parse(value.includes('://') ? value : `https://${value}`, { allowPrivateDomains: false });
  return parsed.isIp ? null : (parsed.domain ?? null);
}

/** The employer's own domain behind a link; null when the link sits on a hiring platform. */
export function firstPartyDomain(hostOrUrl: string | null | undefined): string | null {
  if (!hostOrUrl) return null;
  const domain = registrableDomain(hostOrUrl);
  return domain && !PLATFORM_DOMAINS.has(domain) ? domain : null;
}

export type DomainSource = 'manual' | 'directory' | 'careers' | 'brand' | 'none';

export interface FreeDomainInput {
  /** The domain the company directory holds. */
  directoryDomain: string | null;
  careersUrl: string | null;
  /** Hosts of the company's job links, most used first. */
  jobHosts: readonly string[];
}

/** A domain that costs nothing to find: the directory's, then the careers site's, then the job links'. */
export function freeDomain(input: FreeDomainInput): { domain: string; source: 'directory' | 'careers' } | null {
  const directory = firstPartyDomain(input.directoryDomain);
  if (directory) return { domain: directory, source: 'directory' };
  for (const link of [input.careersUrl, ...input.jobHosts]) {
    const domain = firstPartyDomain(link);
    if (domain) return { domain, source: 'careers' };
  }
  return null;
}

const LEGAL_WORDS = new Set([
  'inc', 'incorporated', 'llc', 'llp', 'lp', 'ltd', 'limited', 'gmbh', 'mbh', 'ag', 'sa', 'sas', 'srl', 'spa', 'plc',
  'corp', 'corporation', 'co', 'company', 'bv', 'nv', 'ab', 'oy', 'as', 'aps', 'kg', 'pty', 'pvt', 'sarl',
  'careers', 'career', 'jobs', 'job', 'recruiting', 'recruitment', 'hiring',
]);
/** Words that can be part of a brand ("Jade Global"): dropped only when what remains is distinctive. */
const DESCRIPTOR_WORDS = new Set([
  'group', 'holding', 'holdings', 'industries', 'international', 'global', 'technologies', 'technology', 'tech',
  'solutions', 'services', 'systems', 'labs', 'lab',
]);
const MIN_DESCRIPTOR_REMAINDER = 6;
const GLUED_LEGAL = /(inc|llc|ltd|gmbh|corp)$/;

function tokensOf(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^\s*(careers|jobs|work|working)\s+(at|with)\s+/, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The words that name the brand: a company's name without its legal form and hiring words. */
export function brandName(name: string): string {
  const tokens = tokensOf(name);
  const kept = [...tokens];
  while (kept.length > 0) {
    const last = kept[kept.length - 1] as string;
    const rest = kept.slice(0, -1).join('').length;
    if (LEGAL_WORDS.has(last) || (DESCRIPTOR_WORDS.has(last) && rest >= MIN_DESCRIPTOR_REMAINDER)) kept.pop();
    else break;
  }
  if (kept.length === 0) return tokens.join(' ');
  if (kept.length === 1) {
    const unglued = (kept[0] as string).replace(GLUED_LEGAL, '');
    if (unglued.length >= 4) return unglued;
  }
  return kept.join(' ');
}

const compact = (value: string): string => value.replace(/\s+/g, '');

/** One-word names that are too common for a name search to mean this company. */
const GENERIC_NAMES = new Set([
  'agency', 'bank', 'capital', 'cloud', 'consulting', 'data', 'digital', 'energy', 'experience', 'global', 'group', 'health',
  'international', 'partners', 'people', 'sandbox', 'services', 'software', 'solutions', 'staffing', 'systems', 'talent', 'team',
  'technologies', 'technology', 'test', 'ventures', 'work',
]);
const MIN_BRAND_LENGTH = 4;
const SHORT_NAME = 5;

/** What a hiring-platform link says about the tenant: the first host label and the last path segment. */
function tenantLabels(link: string): string[] {
  try {
    const url = new URL(link.includes('://') ? link : `https://${link}`);
    const segments = url.pathname.split('/').filter(Boolean);
    return [url.hostname.split('.')[0] ?? '', segments[segments.length - 1] ?? ''].map((s) => s.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Whether a paid search can identify this company at all. Directory entries named
 * after a hiring-platform tenant ("Eeho", "Fa Ewjt Saasfaprod1") say nothing about
 * the brand, and a short name or a common word matches strangers.
 */
export function canSearchBrand(name: string, links: readonly (string | null)[]): boolean {
  const brand = brandName(name);
  const key = compact(brand);
  if (key.length < MIN_BRAND_LENGTH) return false;
  if (GENERIC_NAMES.has(key)) return false;
  if (/saasfaprod|sandbox|\d{4,}/.test(key) || /^fa\s/.test(brand)) return false;
  if (key.length <= SHORT_NAME && !brand.includes(' ')) {
    if (links.some((link) => link !== null && tenantLabels(link).includes(key))) return false;
  }
  return true;
}

export interface BrandHit {
  domain: string;
  name: string;
}

const GLOBAL_SUFFIXES = new Set(['ai', 'io', 'co', 'org', 'net', 'dev', 'app']);
const DISTINCTIVE_NAME = 10;

function domainParts(domain: string): { label: string; suffix: string } {
  const parsed = parse(`https://${domain}`, { allowPrivateDomains: false });
  return { label: (parsed.domainWithoutSuffix ?? '').replace(/[^\p{L}\p{N}]/gu, ''), suffix: parsed.publicSuffix ?? '' };
}

/** How far a suffix can be trusted: .com, then global ones; anything else needs a distinctive name. */
function suffixTier(suffix: string, want: string): number | null {
  if (suffix === 'com') return 0;
  if (GLOBAL_SUFFIXES.has(suffix)) return 1;
  return want.length >= DISTINCTIVE_NAME ? 2 : null;
}

/**
 * The strict match. A hit counts only when its name is the company's name and its
 * domain carries that name too; the search also returns unrelated sites filed under
 * a famous name and country-domain lookalikes of it. The best-trusted exact domain
 * wins; a domain carrying only part of the name is taken only when a single brand fits.
 */
export function matchBrand(name: string, hits: readonly BrandHit[]): string | null {
  const want = compact(brandName(name));
  if (want.length < MIN_BRAND_LENGTH) return null;
  const candidates = hits.flatMap((hit) => {
    const domain = registrableDomain(hit.domain);
    if (domain === null || firstPartyDomain(domain) === null || compact(brandName(hit.name)) !== want) return [];
    const { label, suffix } = domainParts(domain);
    const tier = suffixTier(suffix, want);
    return tier === null ? [] : [{ domain, label, tier }];
  });

  const exact = candidates.filter((c) => c.label === want).sort((a, b) => a.tier - b.tier)[0];
  if (exact) return exact.domain;
  const partial = candidates.filter((c) => c.label.length >= SHORT_NAME && want.includes(c.label));
  return new Set(partial.map((c) => c.label)).size === 1 ? (partial[0] as { domain: string }).domain : null;
}
