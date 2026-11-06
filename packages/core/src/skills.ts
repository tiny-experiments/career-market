import type { IsoDay } from './dates.ts';
import type { Change, Unavailable } from './types.ts';

/**
 * Everything the Skill page shares between the builder, the read API and the
 * web app: display data Career Market owns (category tag, brand domain for the
 * logo, URL slug) and the payloads the read API serves.
 */

/** Ranges the skill demand chart offers. */
export const SKILL_CHART_RANGES = ['1W', '1M', '3M'] as const;

/** "ml:pytorch" -> "pytorch". The bare name is the URL slug unless two tracked skills share it. */
export function bareSkillName(id: string): string {
  return id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
}

export function skillNamespace(id: string): string {
  return id.includes(':') ? id.slice(0, id.indexOf(':')) : '';
}

/**
 * URL slugs for a set of skill ids: the bare name, or `<namespace>-<name>` for
 * every id after the first when two ids share a bare name ("domain:etl", "data:etl").
 */
export function skillSlugs(ids: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const id of [...ids].sort()) {
    let slug = bareSkillName(id);
    if (taken.has(slug)) slug = `${skillNamespace(id)}-${slug}`;
    taken.add(slug);
    out.set(id, slug);
  }
  return out;
}

/** Namespace -> the category tag next to the skill name. */
const NAMESPACE_CATEGORY: Record<string, string> = {
  lang: 'Language',
  framework: 'Framework',
  ml: 'AI & ML',
  cloud: 'Cloud platform',
  store: 'Database',
  os: 'Operating system',
  tool: 'Developer tool',
  infra: 'Infrastructure',
  data: 'Data tool',
  domain: 'Domain',
  web: 'Web',
  sec: 'Security',
  api: 'API',
  practice: 'Practice',
  concept: 'Concept',
  lead: 'Leadership',
  test: 'Testing',
  embedded: 'Embedded',
  platform: 'Platform',
  obs: 'Observability',
  game: 'Game tech',
  mobile: 'Mobile',
  messaging: 'Messaging',
  cert: 'Certification',
  runtime: 'Runtime',
};

/** Skills whose category is more specific than their namespace. */
const SKILL_CATEGORY: Record<string, string> = {
  'ml:pytorch': 'ML framework',
  'ml:tensorflow': 'ML framework',
  'ml:jax': 'ML framework',
  'ml:keras': 'ML framework',
  'ml:scikit-learn': 'ML library',
  'ml:huggingface-transformers': 'ML library',
  'ml:cuda': 'GPU platform',
  'ml:llm': 'AI technique',
  'ml:rag': 'AI technique',
  'ml:generative-ai': 'AI technique',
  'ml:deep-learning': 'AI technique',
  'ml:nlp': 'AI technique',
  'ml:mlops': 'AI practice',
  'infra:kubernetes': 'Container platform',
  'infra:docker': 'Container platform',
  'infra:terraform': 'Infrastructure as code',
};

export function skillCategory(id: string): string {
  return SKILL_CATEGORY[id] ?? NAMESPACE_CATEGORY[skillNamespace(id)] ?? 'Skill';
}

/**
 * The website each skill's logo comes from (through Context.dev, as in Kurso).
 * Only skills with a clear owner of the brand; the others get a neutral mark.
 */
const SKILL_DOMAINS: Record<string, string> = {
  'lang:python': 'python.org',
  'lang:java': 'java.com',
  'lang:typescript': 'typescriptlang.org',
  'lang:go': 'go.dev',
  'lang:rust': 'rust-lang.org',
  'lang:kotlin': 'kotlinlang.org',
  'lang:swift': 'swift.org',
  'lang:csharp': 'dotnet.microsoft.com',
  'lang:php': 'php.net',
  'lang:ruby': 'ruby-lang.org',
  'lang:scala': 'scala-lang.org',
  'ml:pytorch': 'pytorch.org',
  'ml:tensorflow': 'tensorflow.org',
  'ml:cuda': 'nvidia.com',
  'ml:huggingface-transformers': 'huggingface.co',
  'cloud:aws': 'aws.amazon.com',
  'cloud:azure': 'azure.microsoft.com',
  'cloud:gcp': 'cloud.google.com',
  'infra:kubernetes': 'kubernetes.io',
  'infra:docker': 'docker.com',
  'infra:terraform': 'hashicorp.com',
  'framework:react': 'react.dev',
  'framework:angular': 'angular.dev',
  'framework:nextjs': 'nextjs.org',
  'framework:dotnet': 'dotnet.microsoft.com',
  'store:postgresql': 'postgresql.org',
  'store:mysql': 'mysql.com',
  'store:mongodb': 'mongodb.com',
  'store:redis': 'redis.io',
  'store:snowflake': 'snowflake.com',
  'data:spark': 'spark.apache.org',
  'tool:git': 'git-scm.com',
  'tool:github': 'github.com',
  'api:graphql': 'graphql.org',
};

export function skillDomain(id: string): string | null {
  return SKILL_DOMAINS[id] ?? null;
}

// ---------------------------------------------------------------- payloads

export interface SkillSeriesPoint {
  date: IsoDay;
  /** Roles naming the skill in the page's profession, on today's boards. */
  open: number;
  estimated: boolean;
}

/** One bar of "Named in 32% of AI & ML roles": the skill or a peer in its field. */
export interface SkillPeer {
  id: string;
  /** null when the peer has no page of its own. */
  slug: string | null;
  label: string;
  domain: string | null;
  open: number;
  self: boolean;
}

export interface SkillProfessionRow {
  family: string;
  code: string;
  name: string;
  open: number;
  /** open / all roles naming the skill. */
  share: number;
}

export interface SkillCompanyRow {
  id: string;
  name: string;
  domain: string | null;
  open: number;
  /** 1M change; null until the read model holds enough days of company counts. */
  change: Change | null;
}

export interface SkillPairRow {
  id: string;
  slug: string | null;
  label: string;
  domain: string | null;
  open: number;
  /** open / roles naming the skill. */
  share: number;
  change: Change | null;
}

export interface SkillRoleRow {
  id: string;
  title: string;
  company: { id: string; name: string; domain: string | null };
  location: string | null;
  salary: { min: number; max: number; currency: string } | null;
  openedOn: IsoDay;
  /** Whole days from the opened day to the snapshot day. */
  ageDays: number;
}

export interface SkillSalaryEffect {
  available: true;
  family: string;
  familyName: string;
  currency: string;
  /** Median of the range midpoints, roles naming the skill minus roles without it. */
  delta: number;
  medianWith: number;
  medianWithout: number;
  nWith: number;
  nWithout: number;
  /** Where the roles come from, e.g. "US roles with listed USD pay". */
  scope: string;
}

export interface SkillPagePayload {
  /** The day of the numbers; earlier than the latest build when krill failed this skill since. */
  asOf: IsoDay;
  /** True when krill could not be read for this skill on the latest build, so the numbers are from `asOf`. */
  stale: boolean;
  builtAt: string;
  id: string;
  slug: string;
  label: string;
  category: string;
  domain: string | null;
  /** The profession with the most roles naming the skill; the header and chart count inside it. */
  primary: {
    family: string;
    code: string;
    name: string;
    /** Roles in that profession naming the skill. */
    open: number;
    /** All open roles in that profession. */
    familyOpen: number;
    /** open / familyOpen. */
    share: number;
  };
  /** Roles naming the skill in every profession. */
  totalOpen: number;
  /** 1M change of the chart series; null until a base day exists. */
  change: Change | null;
  /** Oldest first: estimated days (back-cast), then observed days. */
  series: SkillSeriesPoint[];
  /** First day with an observed skill count; the days before it are estimated. */
  firstObservedDay: IsoDay;
  seriesNote: string;
  peers: SkillPeer[];
  professions: SkillProfessionRow[];
  companies: SkillCompanyRow[];
  pairs: SkillPairRow[];
  salaryEffect: SkillSalaryEffect | Unavailable;
  latestRoles: SkillRoleRow[];
}

export interface SkillIndexRow {
  id: string;
  slug: string;
  label: string;
  category: string;
  domain: string | null;
  open: number;
  /** The day of this row's numbers; earlier than the index's `asOf` when krill failed this skill since. */
  asOf: IsoDay;
  primaryName: string;
  primaryOpen: number;
  change: Change | null;
}

export interface SkillIndexPayload {
  asOf: IsoDay;
  skills: SkillIndexRow[];
}
