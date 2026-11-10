/**
 * The name a visitor reads for a company. The directory often holds a careers
 * page's title or a hiring-platform tenant code instead of a name; this turns
 * what we have into the best name we can show. Pure: the worker stores the
 * answer and every reader uses it.
 */

/** Hand-checked names for sites whose address does not spell the brand. */
const KNOWN_BRANDS: Readonly<Record<string, string>> = {
  'abb.com': 'ABB',
  'accenturefederal.com': 'Accenture Federal Services',
  'assaabloy.com': 'ASSA ABLOY',
  'asteralabs.com': 'Astera Labs',
  'avinc.com': 'AeroVironment',
  'bd.com': 'BD',
  'blueorigin.com': 'Blue Origin',
  'bny.com': 'BNY',
  'boozallen.com': 'Booz Allen Hamilton',
  'caterpillar.com': 'Caterpillar',
  'cmu.edu': 'Carnegie Mellon University',
  'commbank.com.au': 'CommBank',
  'db.com': 'Deutsche Bank',
  'dentsu.com': 'Dentsu',
  'dtcc.com': 'DTCC',
  'dxc.com': 'DXC Technology',
  'ey.com': 'EY',
  'f5.com': 'F5',
  'fiserv.com': 'Fiserv',
  'fisglobal.com': 'FIS',
  'flex.com': 'Flex',
  'gdit.com': 'GDIT',
  'gehealthcare.com': 'GE HealthCare',
  'genpt.com': 'Genuine Parts Company',
  'gevernova.com': 'GE Vernova',
  'gf.com': 'GlobalFoundries',
  'gm.com': 'General Motors',
  'gsk.com': 'GSK',
  'homedepot.com': 'The Home Depot',
  'hp.com': 'HP',
  'hpe.com': 'HPE',
  'ing.com': 'ING',
  'jll.com': 'JLL',
  'jnj.com': 'Johnson & Johnson',
  'johnsoncontrols.com': 'Johnson Controls',
  'jpmorganchase.com': 'JPMorgan Chase',
  'kiongroup.com': 'KION Group',
  'kla.com': 'KLA',
  'leonardo.com': 'Leonardo',
  'lseg.com': 'LSEG',
  'marshmclennan.com': 'Marsh McLennan',
  'mbda-systems.com': 'MBDA',
  'morganstanley.com': 'Morgan Stanley',
  'motorolasolutions.com': 'Motorola Solutions',
  'mtb.com': 'M&T Bank',
  'mufg.jp': 'MUFG',
  'ncr.com': 'NCR',
  'northerntrust.com': 'Northern Trust',
  'northropgrumman.com': 'Northrop Grumman',
  'nttdata.com': 'NTT DATA',
  'nxp.com': 'NXP',
  'ocbc.com': 'OCBC',
  'paloaltonetworks.com': 'Palo Alto Networks',
  'pg.com': 'Procter & Gamble',
  'pwc.com': 'PwC',
  'relx.com': 'RELX',
  'shi.com': 'SHI',
  'siemens-healthineers.com': 'Siemens Healthineers',
  'spglobal.com': 'S&P Global',
  'thermofisher.com': 'Thermo Fisher Scientific',
  'wolterskluwer.com': 'Wolters Kluwer',
  'wsp.com': 'WSP',
  'x.ai': 'xAI',
};

const PREFIX = /^(?:(?:careers?|jobs?|work(?:ing)?|search\s+jobs|join\s+(?:us|the\s+team))\s+(?:at|with)\s+|(?:careers?|jobs?)\s*[:|]\s*)+/i;
const AFTER_SEPARATOR = /\s*[:|]\s*.*(?:search\s+jobs|jobs?|careers?)[^:|]*$/i;
const PARENTHETICAL = /\s*\([^)]*\)\s*$/;
const HIRING_SUFFIX =
  /[\s,-]+(?:(?:external|global|experienced)\s+)*(?:career\s+site|careers?\s+site|candidate\s+experience\s+site|job\s+site|careers?|jobs?|ats(?:\s*\d+)?)$/i;
const TENANT = /saasfaprod|sandbox|\d{4,}|^fa[\s-]/i;
/** Names made only of these say nothing about who is hiring. */
const GENERIC = /^(?:careers?|jobs?|hiring|recruiting|talent|company|inc|llc|ltd|\s)+$/i;

/** Strips what a careers page adds around the name; what is left is at least as good. */
export function cleanCareerTitle(raw: string): string {
  let name = raw.trim().replace(/\s+/g, ' ');
  for (const pattern of [AFTER_SEPARATOR, PREFIX]) {
    const next = name.replace(pattern, '').trim();
    if (next) name = next;
  }
  for (;;) {
    const next = name.replace(PARENTHETICAL, '').replace(HIRING_SUFFIX, '').trim();
    if (!next || next === name) return name;
    name = next;
  }
}

// What an Oracle Recruiting site adds around the employer in its site name: "Candidate Experience
// Site Polyglass", "Chubb External", "EXL Talent Acquisition Team", "Linamar Career Site - New".
const SITE_PREFIX = /^(?:candidate\s+experience\s+site\b\s*[-:]?\s*|careers?\s*[-|:]\s*|careers?\s+at\s+|sitio\s+de\s+oportunidades(?:\s+de)?\s+empleo\s+)/i;
const SITE_SUFFIX = new RegExp(
  String.raw`(?:_(?:en|fr)|\s*\((?:us|uk)\)|(?<=[A-Za-z]{2})\.|,?\s+(?:inc|llc|ltd|limited)\.?|(?:\s*[-|:]\s*|\s+)(?:` +
    [
      String.raw`new|careers?|jobs?|global|international|united\s+states`,
      String.raw`(?:external|global|us|uk|early)?\s*(?:careers?|jobs?)\s+(?:site|portal|center|centre|page)(?:\s+(?:us|uk))?`,
      String.raw`(?:external|global|early)?\s*careers?(?:\s+(?:french|global))?`,
      String.raw`candidate\s+experience|talent\s+acquisition(?:\s+team)?|(?:e-)?recruitment(?:\s+(?:team|system))?|human\s+resources`,
      String.raw`job\s+listings|staff\s+positions|support\s+staff\s+openings|external`,
    ].join('|') +
    '))$',
  'i',
);
/** Site names that name no one: Oracle's default, and one-word labels. */
const SITE_GENERIC = /^(?:candidate\s+experience(?:\s+site)?|site\s+kandidaatervaring|global|join|careers?|jobs?|new|external|)$/i;

/**
 * The employer an Oracle Recruiting careers site names, cleaned of what the site adds
 * around it, or null when the site names no one ("Candidate Experience site").
 */
export function cleanSiteName(raw: string): string | null {
  let name = raw.replace(/\\'/g, "'").replace(/\s+/g, ' ').trim();
  for (;;) {
    const next = name.replace(SITE_PREFIX, '').replace(SITE_SUFFIX, '').trim();
    if (next === name || !next) break;
    name = next;
  }
  // "Verisk Careers | Verisk": the brand repeated after a separator.
  const halves = name.split(/\s*\|\s*/);
  if (halves.length === 2 && halves[1] && halves[0]!.toLowerCase().startsWith(halves[1].toLowerCase())) name = halves[1];
  return SITE_GENERIC.test(name) || TENANT.test(name) ? null : name;
}

/** True when all we hold for a company is a hiring-platform code, not a name. */
export function isCodeName(raw: string): boolean {
  return !companyDisplay(raw, null).named;
}

function fromDomain(domain: string, lowercaseSource: boolean): string {
  const label = domain.split('.')[0] ?? domain;
  if (label.length <= 3 && lowercaseSource) return label.toUpperCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface CompanyDisplay {
  name: string;
  /** False while all we hold is a code: the company stays listed, but out of the headline cards. */
  named: boolean;
}

/**
 * The best name we can show for a company, and whether it is really a name. A
 * hand-checked name (read off the company's own careers page) wins over the rest; a
 * company known only by a hiring-platform code takes the name its careers site states.
 */
export function companyDisplay(raw: string, domain: string | null, checked?: string | null, site?: string | null): CompanyDisplay {
  const manual = checked?.trim();
  if (manual) return { name: manual, named: true };
  const known = domain ? KNOWN_BRANDS[domain] : undefined;
  if (known) return { name: known, named: true };
  const stated = site?.trim();
  if (stated && isCodeName(raw)) return { name: stated, named: true };

  const cleaned = cleanCareerTitle(raw);
  const tenant = TENANT.test(cleaned);
  const generic = GENERIC.test(cleaned);
  const oneWord = !cleaned.includes(' ');
  if (domain && !tenant && !generic) {
    const label = (domain.split('.')[0] ?? '').replace(/[^a-z0-9]/g, '');
    // Capitals are a real name only when the site agrees: "RTX" at rtx.com, not "AG" at airbus.com.
    const capitals = /^[A-Z0-9&.-]+$/.test(cleaned);
    if (!oneWord || /[a-z][A-Z]/.test(cleaned) || (capitals && label.includes(cleaned.toLowerCase()))) return { name: cleaned, named: true };
    const lowercase = cleaned === cleaned.toLowerCase();
    // A word that is the site's own name only needs its capital; a short or lowercase code is not a name.
    if (cleaned.toLowerCase() === label) return { name: fromDomain(domain, lowercase), named: true };
    if (lowercase || cleaned.length <= 5) return { name: fromDomain(domain, lowercase), named: true };
    return { name: cleaned, named: true };
  }
  if (domain) return { name: fromDomain(domain, true), named: true };
  // Without a site one word is trusted only in camel case ("MultiCare"): platform codes never are.
  return { name: cleaned, named: !tenant && !generic && (!oneWord || /[a-z][A-Z]/.test(cleaned)) };
}
