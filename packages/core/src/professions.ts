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

export interface ProfessionSpecialty {
  id: string;
  label: string;
  open: number;
}

export interface ProfessionCompanyRow {
  rank: number;
  id: string;
  name: string;
  /** Registrable domain for the Context.dev logo; null when krill has none. */
  domain: string | null;
  open: number;
  /** Change in the profession's open roles at this company since the base day. */
  change: Change | null;
  /** Open roles moved by more than half in under a week: krill's board coverage changed, not hiring. */
  coverageJump: boolean;
  signal: CompanySignal | null;
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
  skills: { id: string; label: string; open: number }[];
  latestRoles: ProfessionLatestRole[];
}

export interface ProfessionIndexRow {
  family: string;
  code: string;
  name: string;
  longName: string;
  open: number;
  change: Change | null;
  spark: number[];
}

export interface ProfessionIndex {
  asOf: IsoDay;
  builtAt: string;
  rows: ProfessionIndexRow[];
}
