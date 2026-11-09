import pino from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { skillDomain } from '@cm/core/skills';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import { writeCompanyInputs } from '../src/companies/write.ts';
import type { CompanyPull } from '../src/companies/pull.ts';
import { ContextDevError, createLogoProbe } from '../src/logos/contextDev.ts';
import { brandName, canSearchBrand, firstPartyDomain, freeDomain, matchBrand, registrableDomain } from '../src/logos/domain.ts';
import { resolveCompanyDomains, type LogoDeps } from '../src/logos/resolve.ts';

describe('first-party domains', () => {
  it('reduces a link to its registrable domain, on the public suffix list', () => {
    expect(registrableDomain('careers.wipro.com')).toBe('wipro.com');
    expect(registrableDomain('https://jobs.bluecross.org.uk/roles/1')).toBe('bluecross.org.uk');
    expect(registrableDomain('127.0.0.1')).toBeNull();
  });

  it('never takes a hiring platform for the employer', () => {
    for (const link of [
      'https://accenture.wd103.myworkdayjobs.com/accenturecareers',
      'https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
      'https://job-boards.eu.greenhouse.io/acme',
      'https://jobs.lever.co/jobgether',
      'https://jobs.smartrecruiters.com/sonsoftinc',
      'https://jobs.ashbyhq.com/bjakcareer',
      'https://1komma5grad.jobs.personio.com',
      'bertrandt.jobs.hr.cloud.sap',
    ]) {
      expect(firstPartyDomain(link)).toBeNull();
    }
    expect(firstPartyDomain('https://careers.airbnb.com/jobs')).toBe('airbnb.com');
  });

  it('prefers the directory, then the careers site, then the job links', () => {
    const none = { directoryDomain: null, careersUrl: null, jobHosts: [] };
    expect(freeDomain({ ...none, directoryDomain: 'amazon.com', careersUrl: 'https://www.amazon.jobs' })).toEqual({ domain: 'amazon.com', source: 'directory' });
    expect(freeDomain({ ...none, careersUrl: 'https://careers.wipro.com', jobHosts: ['jobs.other.com'] })).toEqual({ domain: 'wipro.com', source: 'careers' });
    expect(freeDomain({ ...none, careersUrl: 'https://x.wd1.myworkdayjobs.com/a', jobHosts: ['jobs.lever.co', 'careers.acme.io'] })).toEqual({ domain: 'acme.io', source: 'careers' });
    expect(freeDomain(none)).toBeNull();
  });
});

describe('brand matching', () => {
  it('cleans a directory name down to the brand', () => {
    expect(brandName('Anduril Industries')).toBe('anduril');
    expect(brandName('Careers at Leonardo DRS')).toBe('leonardo drs');
    expect(brandName('sonsoftinc')).toBe('sonsoft');
    expect(brandName('Landesbank Baden-Württemberg')).toBe('landesbank baden wurttemberg');
    expect(brandName('Global Services')).toBe('global');
    expect(canSearchBrand('Global Services', [])).toBe(false);
  });

  it('accepts only a hit whose name and domain both carry the company name', () => {
    const accenture = [
      { domain: 'camelot-mc.com', name: 'Accenture' },
      { domain: 'accenture.com', name: 'Accenture' },
      { domain: 'accenturefederal.com', name: 'Accenture Federal Services' },
    ];
    expect(matchBrand('Accenture', accenture)).toBe('accenture.com');
    expect(matchBrand('JPMorgan Chase', [{ domain: 'jpmorganchase.com', name: 'JPMorgan Chase' }])).toBe('jpmorganchase.com');
  });

  it('rejects the weak matches a name search returns', () => {
    expect(matchBrand('Eeho', [{ domain: 'eehour.com', name: 'Eehour' }])).toBeNull();
    expect(matchBrand('Accenture', [{ domain: 'unlimitedgroup.com', name: 'Accenture' }])).toBeNull();
    expect(matchBrand('Anduril Industries', [{ domain: 'ppg.com', name: 'PPG Industries' }])).toBeNull();
    expect(matchBrand('Acme', [{ domain: 'jobs.lever.co', name: 'Acme' }])).toBeNull();
  });

  it('prefers the best-trusted domain over country lookalikes of the name', () => {
    expect(matchBrand('Anduril Industries', [{ domain: 'anduril.fr', name: 'Anduril' }, { domain: 'anduril.com', name: 'Anduril' }])).toBe('anduril.com');
    expect(matchBrand('Thales', [{ domain: 'thales.ma', name: 'Thales' }])).toBeNull();
    expect(matchBrand('Homedepot', [{ domain: 'homedepot.lk', name: 'Homedepot' }])).toBeNull();
    expect(matchBrand('Rippling', [{ domain: 'rippling.world', name: 'Rippling' }])).toBeNull();
    expect(matchBrand('True Anomaly', [{ domain: 'trueanomaly.space', name: 'True Anomaly' }])).toBe('trueanomaly.space');
  });

  it('keeps a descriptor that is part of a short brand, and rejects a domain that only starts with the name', () => {
    expect(brandName('Jade Global')).toBe('jade global');
    expect(matchBrand('Jade Global', [{ domain: 'jade.io', name: 'Jade' }])).toBeNull();
    expect(matchBrand('Assaabloy', [{ domain: 'assaabloydss.com', name: 'Assaabloy' }])).toBeNull();
  });

  it('takes a partial domain only when one brand fits', () => {
    expect(matchBrand('Northwind Robotics', [{ domain: 'northwind.ai', name: 'Northwind Robotics' }])).toBe('northwind.ai');
    expect(matchBrand('Northwind Robotics', [
      { domain: 'northwind.ai', name: 'Northwind Robotics' },
      { domain: 'robotics.dev', name: 'Northwind Robotics' },
    ])).toBeNull();
  });

  it('does not pay to search names that cannot identify a brand', () => {
    const oracle = 'https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX';
    expect(canSearchBrand('Eeho', [oracle])).toBe(false);
    expect(canSearchBrand('Ngc', [])).toBe(false);
    expect(canSearchBrand('Fa Ewjt Saasfaprod1', [])).toBe(false);
    expect(canSearchBrand('experience', [])).toBe(false);
    expect(canSearchBrand('libertymutual-sandbox', [])).toBe(false);
    expect(canSearchBrand('Accenture', ['https://accenture.wd103.myworkdayjobs.com/x'])).toBe(true);
  });
});

describe('logo probe', () => {
  const fakeFetch = (status: number, cache: string) =>
    vi.fn(async () => new Response(null, { status, headers: { 'x-logolink-cache': cache } })) as unknown as typeof fetch;

  it('tells a real mark from a generated placeholder, asking for headers only', async () => {
    const real = fakeFetch(200, 'brand');
    expect(await createLogoProbe('id', 'https://careermarket.app/', real)('stripe.com')).toBe('real');
    expect(vi.mocked(real).mock.calls[0]?.[1]?.method).toBe('HEAD');
    expect(await createLogoProbe('id', 'https://careermarket.app/', fakeFetch(200, 'monogram'))('nope.com')).toBe('monogram');
  });

  it('recognises a placeholder the service has already cached', async () => {
    const cached = vi.fn(async () => new Response(null, { status: 200, headers: { 'x-logolink-cache': 'hit', 'x-logolink-failure-etag': 'abc' } })) as unknown as typeof fetch;
    expect(await createLogoProbe('id', 'https://careermarket.app/', cached)('qualcomm.com')).toBe('monogram');
    expect(await createLogoProbe('id', 'https://careermarket.app/', fakeFetch(200, 'hit'))('stripe.com')).toBe('real');
  });

  it('reports a refused check', async () => {
    await expect(createLogoProbe('id', 'https://careermarket.app/', fakeFetch(403, ''))('x.com')).rejects.toBeInstanceOf(ContextDevError);
  });
});

it('curates a domain for the skills people look for', () => {
  expect(skillDomain('lang:python')).toBe('python.org');
  expect(skillDomain('store:postgres')).toBe('postgresql.org');
  expect(skillDomain('infra:kubernetes')).toBe('kubernetes.io');
  expect(skillDomain('lang:sql')).toBeNull();
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('resolveCompanyDomains (dedicated test database)', () => {
  let sql: Sql;
  const settings = { dailyCredits: 100, dailyChecks: 100, lookupsPerRun: 100, checksPerRun: 100, recheckDays: 90, monogramRecheckDays: 7, lookupIntervalMs: 0 };
  const deps = (over: Partial<LogoDeps> = {}): LogoDeps => ({ sql, log: pino({ level: 'silent' }), settings, ...over });

  const company = (id: string, name: string, rank: number, directory: string | null = null, careers: string | null = null) =>
    sql`insert into company (company_id, slug, name, directory_domain, careers_url, open, rank, updated_on)
        values (${id}, ${id}, ${name}, ${directory}, ${careers}, 5, ${rank}, '2026-11-09')`;
  const row = async (id: string) => (await sql`select domain, source, logo, name_checked from company_domain where company_id = ${id}`)[0];
  const published = async (id: string) => (await sql`select domain from company where company_id = ${id}`)[0]?.domain;

  beforeAll(async () => { sql = createSql(process.env.TEST_DATABASE_URL!); await migrate(sql); });
  afterAll(async () => { await sql.end(); });
  beforeEach(async () => { await sql`truncate company, company_domain, company_domain_override, job_mirror, search_entry`; });

  it('uses free sources without spending credits, and publishes them', async () => {
    await company('a', 'Airbnb', 1, null, 'https://careers.airbnb.com');
    await company('b', 'Stripe', 2, 'stripe.com');
    await sql`insert into search_entry (as_of, kind, id, slug, label, open, domain) values ('2026-11-09', 'company', 'a', 'a', 'Airbnb', 5, null)`;
    const brandSearch = vi.fn(async () => []);
    const stats = await resolveCompanyDomains(deps({ brandSearch }));
    expect(brandSearch).not.toHaveBeenCalled();
    expect(stats.lookups).toBe(0);
    expect(await row('a')).toMatchObject({ domain: 'airbnb.com', source: 'careers' });
    expect(await row('b')).toMatchObject({ domain: 'stripe.com', source: 'directory' });
    expect(await published('a')).toBe('airbnb.com');
    expect((await sql`select domain from search_entry where id = 'a'`)[0]?.domain).toBe('airbnb.com');
  });

  it('looks up the largest companies first, within the daily budget, and only once', async () => {
    await company('small', 'Smallco Widgets', 3, null, 'https://jobs.lever.co/smallco');
    await company('big', 'Bigcorp', 1, null, 'https://bigcorp.wd1.myworkdayjobs.com/x');
    await company('mid', 'Midsize', 2, null, 'https://jobs.lever.co/midsize');
    const brandSearch = vi.fn(async (q: string) => [{ domain: `${q.replace(/\s/g, '')}.com`, name: q }]);
    const first = await resolveCompanyDomains(deps({ brandSearch, settings: { ...settings, dailyCredits: 2 } }));
    expect(first.lookups).toBe(2);
    expect(brandSearch.mock.calls.map((c) => c[0])).toEqual(['bigcorp', 'midsize']);
    expect(await row('big')).toMatchObject({ domain: 'bigcorp.com', source: 'brand', name_checked: 'Bigcorp' });
    expect(await row('small')).toMatchObject({ domain: null, source: 'none' });

    // The day's budget is spent.
    await resolveCompanyDomains(deps({ brandSearch, settings: { ...settings, dailyCredits: 2 } }));
    expect(brandSearch).toHaveBeenCalledTimes(2);
    // With budget left, only the company never looked up costs a credit.
    await resolveCompanyDomains(deps({ brandSearch }));
    expect(brandSearch).toHaveBeenCalledTimes(3);
    await resolveCompanyDomains(deps({ brandSearch }));
    expect(brandSearch).toHaveBeenCalledTimes(3);
  });

  it('lets a manual override win, and a null override mean a deliberate monogram', async () => {
    await company('a', 'Ngc', 1, 'wrong.com');
    await company('b', 'Mystery Corp', 2);
    await sql`insert into company_domain_override (company_id, domain, note) values ('a', 'northropgrumman.com', 'board name'), ('b', null, 'no brand')`;
    const brandSearch = vi.fn(async () => []);
    await resolveCompanyDomains(deps({ brandSearch }));
    expect(brandSearch).not.toHaveBeenCalled();
    expect(await row('a')).toMatchObject({ domain: 'northropgrumman.com', source: 'manual' });
    expect(await row('b')).toMatchObject({ domain: null, source: 'manual' });
    expect(await published('a')).toBe('northropgrumman.com');
  });

  it('withholds a domain with no real mark and tries a paid lookup for it', async () => {
    await company('a', 'Werkenco', 1, null, 'https://werkenbijwerkenco.nl');
    const logoProbe = vi.fn(async (d: string) => (d === 'werkenbijwerkenco.nl' ? 'monogram' as const : 'real' as const));
    const brandSearch = vi.fn(async () => [{ domain: 'werkenco.com', name: 'Werkenco' }]);
    await resolveCompanyDomains(deps({ brandSearch, logoProbe }));
    expect(await row('a')).toMatchObject({ domain: 'werkenco.com', source: 'brand', logo: 'real' });
    expect(await published('a')).toBe('werkenco.com');
    expect(logoProbe.mock.calls.map((c) => c[0])).toEqual(['werkenbijwerkenco.nl', 'werkenco.com']);

    await sql`truncate company_domain`;
    await resolveCompanyDomains(deps({ brandSearch: vi.fn(async () => []), logoProbe }));
    expect(await row('a')).toMatchObject({ domain: 'werkenbijwerkenco.nl', logo: 'monogram' });
    expect(await published('a')).toBeNull();
  });

  it('still checks a brand result from this run when a later brand search is refused', async () => {
    await company('a', 'Bigcorp', 1);
    await company('b', 'Nextco', 2);
    const brandSearch = vi.fn(async (q: string) => {
      if (q === 'nextco') throw new ContextDevError('brand search answered 429', 429);
      return [{ domain: 'bigcorp.com', name: 'Bigcorp' }];
    });
    const logoProbe = vi.fn(async () => 'real' as const);
    const stats = await resolveCompanyDomains(deps({ brandSearch, logoProbe }));
    expect(stats.stoppedEarly).toBe(true);
    expect(logoProbe).toHaveBeenCalledWith('bigcorp.com');
    expect(await row('a')).toMatchObject({ domain: 'bigcorp.com', logo: 'real' });
  });

  it('stops for the run on a rate limit, without marking the company as checked', async () => {
    await company('a', 'Bigcorp', 1);
    const brandSearch = vi.fn(async () => { throw new ContextDevError('brand search answered 429', 429); });
    const stats = await resolveCompanyDomains(deps({ brandSearch }));
    expect(stats.stoppedEarly).toBe(true);
    expect(stats.lookups).toBe(0);
    expect((await sql`select brand_checked_at from company_domain where company_id = 'a'`)[0]?.brand_checked_at).toBeNull();
  });

  it('skips a company the service rejects by itself, without stamping it, and carries on', async () => {
    await company('a', 'Oddco', 1);
    await company('b', 'Fineco', 2);
    const brandSearch = vi.fn(async (q: string) => {
      if (q === 'oddco') throw new ContextDevError('brand search answered 400', 400);
      return [{ domain: `${q}.com`, name: q }];
    });
    const stats = await resolveCompanyDomains(deps({ brandSearch }));
    expect(stats).toMatchObject({ skipped: 1, lookups: 1, stoppedEarly: false });
    expect(await row('b')).toMatchObject({ domain: 'fineco.com' });
    expect((await sql`select brand_checked_at from company_domain where company_id = 'a'`)[0]?.brand_checked_at).toBeNull();
  });

  it('skips a domain whose logo check is rejected, but stops when the service refuses everything', async () => {
    await company('a', 'Oddco', 1, 'odd.com');
    await company('b', 'Fineco', 2, 'fine.com');
    const logoProbe = vi.fn(async (d: string) => {
      if (d === 'odd.com') throw new ContextDevError('logo check answered 404', 404);
      return 'real' as const;
    });
    const stats = await resolveCompanyDomains(deps({ logoProbe }));
    expect(stats).toMatchObject({ skipped: 1, logoChecks: 1, stoppedEarly: false });
    expect(logoProbe.mock.calls.filter((c) => c[0] === 'odd.com')).toHaveLength(1);
    const fine = await row('b');
    const odd = await row('a');
    expect(fine).toBeDefined();
    expect(odd).toBeDefined();
    expect(fine!.logo).toBe('real');
    expect(odd!.logo).toBeNull();

    await sql`update company_domain set logo = null, logo_checked_at = null`;
    const refusing = vi.fn(async () => { throw new ContextDevError('logo check answered 403', 403); });
    const refused = await resolveCompanyDomains(deps({ logoProbe: refusing }));
    expect(refused.stoppedEarly).toBe(true);
    expect(refused.logoChecks).toBe(0);
    expect(refusing.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('skips a company that times out and carries on with the next', async () => {
    await company('a', 'Slowco', 1);
    await company('b', 'Fastco', 2);
    const brandSearch = vi.fn(async (q: string) => {
      if (q === 'slowco') throw new DOMException('timed out', 'TimeoutError');
      return [{ domain: `${q}.com`, name: q }];
    });
    const stats = await resolveCompanyDomains(deps({ brandSearch }));
    expect(stats).toMatchObject({ skipped: 1, lookups: 1, stoppedEarly: false });
    expect(await row('b')).toMatchObject({ domain: 'fastco.com' });
    expect((await sql`select brand_checked_at from company_domain where company_id = 'a'`)[0]?.brand_checked_at).toBeNull();
  });

  it('checks a placeholder again sooner than a real logo', async () => {
    await company('a', 'Placeholder Co', 1, 'placeholder.com');
    await company('b', 'Realco', 2, 'realco.com');
    const logoProbe = vi.fn(async (d: string) => (d === 'placeholder.com' ? 'monogram' as const : 'real' as const));
    await resolveCompanyDomains(deps({ logoProbe }));
    await sql`update company_domain set logo_checked_at = now() - interval '8 days'`;
    logoProbe.mockClear();
    await resolveCompanyDomains(deps({ logoProbe }));
    expect(logoProbe.mock.calls.map((c) => c[0])).toEqual(['placeholder.com']);
  });

  it('keeps the resolved domain through a build, recording what the directory holds', async () => {
    await company('a', 'Stripe', 1, 'stripe.com');
    await sql`insert into company_domain_override (company_id, domain) values ('a', 'stripe.dev')`;
    await resolveCompanyDomains(deps());
    await sql.begin((tx) => writeCompanyInputs(tx as unknown as Sql, {
      asOf: '2026-11-10', days: [], stats: [], slices: [], profiles: new Map(),
      directory: [{ id: 'a', name: 'Stripe', domain: 'stripe.io', ats: [], openJobs: 6 }],
    } as unknown as CompanyPull));
    expect(await published('a')).toBe('stripe.dev');
    expect((await sql`select directory_domain from company where company_id = 'a'`)[0]?.directory_domain).toBe('stripe.io');
  });
});
