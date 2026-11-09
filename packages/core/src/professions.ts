/**
 * The Profession page: payloads the read API serves and display data Career
 * Market owns for it (long names, specialty and level labels, ticker routes).
 */
import { familyInfo, FAMILIES, titleCase } from './codes.ts';
import type { IsoDay } from './dates.ts';
import { professionHref as hrefOfCode } from './screener.ts';
import type { Change, CountryRow, SeriesPoint, Unavailable } from './types.ts';

/** Page title of each profession; the short name (codes.ts) stays for tables and tickers. */
const LONG_NAMES: Record<string, string> = {
  'ai-ml': 'AI & Machine Learning',
  software: 'Software Engineering',
  data: 'Data & Analytics',
  'platform-infra': 'Platform & Infrastructure',
  security: 'Security',
  qa: 'QA & Testing',
  'web-mobile': 'Web & Mobile Engineering',
  'game-graphics': 'Games & Graphics',
  'it-ops': 'IT Operations',
  'hardware-silicon': 'Hardware & Silicon',
  'domain-specialist': 'Domain Specialists',
  'enterprise-apps': 'Enterprise Applications',
  product: 'Product',
  design: 'Design',
  'program-delivery': 'Program Delivery',
  'technical-gtm': 'Technical Go-to-Market',
  'devrel-docs': 'Developer Relations & Docs',
  leadership: 'Engineering Leadership',
};

export function professionLongName(family: string): string {
  return LONG_NAMES[family] ?? familyInfo(family).name;
}

/** "/professions/aiml" -> family "ai-ml". */
export function familyByCode(code: string): string | null {
  const wanted = code.toLowerCase();
  return FAMILIES.find((f) => f.code.toLowerCase() === wanted)?.id ?? null;
}

export function professionHref(family: string): string {
  return hrefOfCode(familyInfo(family).code);
}

const SPECIALTY_LABELS: Record<string, string> = {
  'ml-engineering': 'ML Engineering',
  'applied-ai': 'Applied AI',
  'ai-research': 'AI Research',
  sre: 'SRE',
  devops: 'DevOps',
  appsec: 'AppSec',
  cloudsec: 'Cloud Security',
  secops: 'Security Operations',
  grc: 'GRC',
  ui: 'UI',
  ux: 'UX',
  'technical-pm': 'Technical PM',
  'product-manager': 'Product Manager',
  'qa-manual': 'Manual QA',
  'test-automation': 'Test Automation',
};

export function specialtyLabel(id: string): string {
  return SPECIALTY_LABELS[id] ?? titleCase(id);
}

export function levelLabel(id: string): string {
  return titleCase(id);
}

export type CompanySignal = 'HOT' | 'STRONG' | 'RISING' | 'STEADY' | 'COOLING';

/** The regions the Professions table can be scoped to; ids match the Jobs region filter. */
export const PROFESSION_REGIONS = [
  { id: 'north-america', countries: ['US', 'CA', 'MX'] },
  {
    id: 'europe',
    countries: [
      'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB',
      'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LT', 'LU', 'LV', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL',
      'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'UA',
    ],
  },
  {
    id: 'apac',
    countries: [
      'AU', 'BD', 'CN', 'HK', 'ID', 'IN', 'JP', 'KH', 'KR', 'LK', 'MM', 'MY', 'NP', 'NZ', 'PH', 'PK',
      'SG', 'TH', 'TW', 'VN',
    ],
  },
  {
    id: 'latam',
    countries: [
      'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'DO', 'EC', 'GT', 'HN', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV',
      'UY', 'VE',
    ],
  },
  {
    id: 'mena',
    countries: [
      'AE', 'BH', 'DZ', 'EG', 'IL', 'IQ', 'JO', 'KW', 'LB', 'MA', 'OM', 'QA', 'SA', 'TN', 'TR',
    ],
  },
] as const;

export type ProfessionRegionId = (typeof PROFESSION_REGIONS)[number]['id'];

export interface ProfessionSpecialty {
  id: string;
  label: string;
  open: number;
}

export interface ProfessionCompanyRow {
  rank: number;
  id: string;
  /** The company's page; null when the company has none of its own yet. */
  slug: string | null;
  name: string;
  /** Registrable domain for the Context.dev logo; null when krill has none. */
  domain: string | null;
  open: number;
  /** Change in the profession's open roles at this company since the base day. */
  change: Change | null;
  /** Open roles moved by more than half in under a week: krill's board coverage changed, not hiring. */
  coverageJump: boolean;
  signal: CompanySignal | null;
  /** The company's hiring signal, the same one its own page and the Companies list show. */
  state: 'RAMPING' | 'STEADY' | 'COOLING' | 'FREEZING' | null;
}

export interface ProfessionLatestRole {
  id: string;
  title: string;
  companyId: string | null;
  company: string;
  companyDomain: string | null;
  location: string | null;
  /** 'Remote' | 'Hybrid' | 'On-site' | null */
  workMode: string | null;
  /** "$220K – $320K" or null when the posting lists no pay. */
  salary: string | null;
  openedOn: IsoDay;
  /** Whole days from the opened day to the snapshot day. */
  ageDays: number;
}

export interface ProfessionPage {
  asOf: IsoDay;
  builtAt: string;
  family: string;
  code: string;
  name: string;
  longName: string;
  open: number;
  /** 1W, 1M and 3M change of open roles; null when no comparable day exists yet. */
  changes: { '1W': Change | null; '1M': Change | null; '3M': Change | null };
  /** Like-for-like change against the previous day; null when there is no comparable day. */
  change1d: number | null;
  specialties: ProfessionSpecialty[];
  /** Daily series, oldest first: estimated days first, then observed days. */
  series: SeriesPoint[];
  firstObservedDay: IsoDay;
  backcast: { available: boolean; note: string };
  salary:
    | { available: true; p25: number; p50: number; p75: number; n: number; currency: string; scope: string }
    | (Unavailable & { n: number | null });
  workMode: { remote: number; hybrid: number; onsite: number; notStated: number } | null;
  medianDaysOpen: number | null;
  companiesHiring: number | null;
  seniority: { id: string; label: string; open: number; share: number }[];
  seniorityNotStated: number;
  /** First located country of each role (krill daily_stat rule), largest first. */
  countries: CountryRow[];
  countriesNotLocated: number;
  topCompanies: ProfessionCompanyRow[] | Unavailable;
  skills: {
    id: string;
    slug: string;
    label: string;
    open: number;
    /** Share of this profession's open roles that name the skill. */
    share: number;
    /** Change in that share over the last week; null when there is no comparable day. */
    change: number | null;
  }[];
  latestRoles: ProfessionLatestRole[];
}

export interface ProfessionIndexRow {
  family: string;
  code: string;
  name: string;
  longName: string;
  open: number;
  change: Change | null;
  /** Like-for-like change against the previous day. */
  change1d: number | null;
  /** Like-for-like change over 30 days. */
  change1m: number | null;
  /** Roles first opened in the last seven days. */
  newThisWeek: number;
  /** Companies hiring; null when scoped to a region. */
  companies: number | null;
  /** The middle half of listed pay for senior US roles; null when too few list it. */
  pay: { low: number; median: number; high: number } | null;
  /** Remote share among roles stating a work mode; null when scoped to a region. */
  remoteShare: number | null;
  spark: number[];
}

export interface ProfessionIndex {
  asOf: IsoDay;
  builtAt: string;
  /** The region the rows are scoped to; null for the whole world. */
  region: ProfessionRegionId | null;
  rows: ProfessionIndexRow[];
}
