import type { Change } from './types.ts';
/**
 * Display data Career Market owns (krill does not): ticker codes and names for
 * krill families, readable skill labels, short country names and company
 * ticker codes.
 */

export interface FamilyInfo {
  id: string;
  code: string;
  name: string;
}

export const FAMILIES: readonly FamilyInfo[] = [
  { id: 'software', code: 'SWE', name: 'Software' },
  { id: 'ai-ml', code: 'AIML', name: 'AI & ML' },
  { id: 'data', code: 'DATA', name: 'Data' },
  { id: 'platform-infra', code: 'INFRA', name: 'Platform & Infra' },
  { id: 'security', code: 'SEC', name: 'Security' },
  { id: 'qa', code: 'QA', name: 'QA & Testing' },
  { id: 'web-mobile', code: 'WEB', name: 'Web & Mobile' },
  { id: 'game-graphics', code: 'GAME', name: 'Games & Graphics' },
  { id: 'it-ops', code: 'ITOPS', name: 'IT Operations' },
  { id: 'hardware-silicon', code: 'HW', name: 'Hardware & Silicon' },
  { id: 'domain-specialist', code: 'DOM', name: 'Domain Specialist' },
  { id: 'enterprise-apps', code: 'ENT', name: 'Enterprise Apps' },
  { id: 'product', code: 'PROD', name: 'Product' },
  { id: 'design', code: 'DSGN', name: 'Design' },
  { id: 'program-delivery', code: 'PGM', name: 'Program Delivery' },
  { id: 'technical-gtm', code: 'GTM', name: 'Technical GTM' },
  { id: 'devrel-docs', code: 'DEVREL', name: 'DevRel & Docs' },
  { id: 'leadership', code: 'LEAD', name: 'Leadership' },
];

const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));

/** Families shown in the ticker tape, in order. */
export const TICKER_FAMILIES = ['software', 'ai-ml', 'data', 'platform-infra', 'security', 'qa'] as const;

export function familyInfo(id: string): FamilyInfo {
  return FAMILY_BY_ID.get(id) ?? { id, code: id.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5), name: titleCase(id) };
}

/**
 * Exchange tickers for listed companies the tape can show. krill company ids are
 * hashes, so match on the name. Private companies get no invented ticker.
 */
const COMPANY_TICKERS: Record<string, string> = {
  amazon: 'AMZN',
  nvidia: 'NVDA',
  apple: 'AAPL',
  microsoft: 'MSFT',
  google: 'GOOGL',
  meta: 'META',
  oracle: 'ORCL',
  ibm: 'IBM',
  accenture: 'ACN',
  wipro: 'WIT',
  salesforce: 'CRM',
  cisco: 'CSCO',
  intel: 'INTC',
  qualcomm: 'QCOM',
  'jpmorgan chase': 'JPM',
  'capital one': 'COF',
  rtx: 'RTX',
};

export function companyTicker(name: string): string | undefined {
  return COMPANY_TICKERS[name.trim().toLowerCase()];
}

/** Skill ids whose readable label is not the title-cased id. */
const SKILL_LABELS: Record<string, string> = {
  'ml:llm': 'LLMs',
  'ml:rag': 'RAG',
  'ml:nlp': 'NLP',
  'ml:mlops': 'MLOps',
  'ml:pytorch': 'PyTorch',
  'ml:tensorflow': 'TensorFlow',
  'ml:jax': 'JAX',
  'ml:cuda': 'CUDA',
  'ml:generative-ai': 'Generative AI',
  'ml:huggingface-transformers': 'Hugging Face Transformers',
  'cloud:aws': 'AWS',
  'cloud:gcp': 'GCP',
  'cloud:azure': 'Azure',
  'cloud:azure-devops': 'Azure DevOps',
  'lang:cpp': 'C++',
  'lang:csharp': 'C#',
  'lang:c': 'C',
  'lang:sql': 'SQL',
  'lang:php': 'PHP',
  'lang:javascript': 'JavaScript',
  'lang:typescript': 'TypeScript',
  'lang:objective-c': 'Objective-C',
  'lang:vba': 'VBA',
  'practice:ci-cd': 'CI/CD',
  'practice:infrastructure-as-code': 'Infrastructure as Code',
  'api:rest': 'REST',
  'api:graphql': 'GraphQL',
  'web:html': 'HTML',
  'web:css': 'CSS',
  'os:ios': 'iOS',
  'os:macos': 'macOS',
  'store:mysql': 'MySQL',
  'store:postgresql': 'PostgreSQL',
  'store:mongodb': 'MongoDB',
  'store:sqlserver': 'SQL Server',
  'store:databricks-sql': 'Databricks SQL',
  'store:dynamodb': 'DynamoDB',
  'framework:dotnet': '.NET',
  'framework:aspnet': 'ASP.NET',
  'framework:nodejs': 'Node.js',
  'framework:react': 'React',
  'framework:nextjs': 'Next.js',
  'framework:vuejs': 'Vue.js',
  'data:power-bi': 'Power BI',
  'data:etl': 'ETL',
  'domain:etl': 'ETL',
  'sec:iam': 'IAM',
  'sec:rbac': 'RBAC',
  'concept:http': 'HTTP',
  'concept:dns': 'DNS',
  'tool:git': 'Git',
  'tool:github': 'GitHub',
  'tool:gitlab': 'GitLab',
  'infra:github-actions': 'GitHub Actions',
};

/** "lang:python" -> "Python"; "domain:machine-learning" -> "Machine Learning". */
export function skillLabel(id: string): string {
  const known = SKILL_LABELS[id];
  if (known) return known;
  const bare = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return titleCase(bare);
}

/** Skill namespaces that describe a field or practice, not a tool someone learns. */
const NON_TOOL_NAMESPACES = new Set(['concept', 'lead', 'practice', 'domain']);

/** Skills the "Hottest skills" tiles can show: languages, frameworks, platforms, ML tools. */
export function isTileSkill(id: string): boolean {
  const ns = id.includes(':') ? id.slice(0, id.indexOf(':')) : '';
  return !NON_TOOL_NAMESPACES.has(ns) || id === 'domain:machine-learning';
}

const SHORT_COUNTRY: Record<string, string> = {
  US: 'US',
  GB: 'UK',
  AE: 'UAE',
  KR: 'South Korea',
  CZ: 'Czechia',
  RU: 'Russia',
  VN: 'Vietnam',
  TW: 'Taiwan',
  HK: 'Hong Kong',
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  if (!code) return 'Not located';
  const short = SHORT_COUNTRY[code];
  if (short) return short;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Families need this many open roles to rank in "Professions gaining". */
export const MIN_FAMILY_OPEN = 1000;

/** Families with enough open roles, best 1W change first. */
export function rankFamilies<F extends { open: number; change: Change | null }>(families: F[]): F[] {
  return families
    .filter((f) => f.open >= MIN_FAMILY_OPEN && f.change !== null)
    .sort((a, b) => (b.change as Change).value - (a.change as Change).value);
}
