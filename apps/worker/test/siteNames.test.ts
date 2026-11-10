import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import { applyCompanyNames } from '../src/logos/names.ts';
import { createSitePage, oracleSiteUrl, pickSiteName, refreshSiteNames, siteNameFromPage, type SitePage } from '../src/logos/siteNames.ts';

const AVIENT_PAGE = `<!DOCTYPE html><html><head>
  <meta property="og:title" content="Avient Careers"/>
  <meta property="og:site_name" content="Avient"/>
  <title>Avient</title>
  <base href="/hcmUI/CandidateExperience/en/sites/CX_1" data-sitenumber="CX_1"/>
</head><body></body></html>`;

describe('Oracle careers sites', () => {
  it('finds the English site from a job link, and nothing in other links', () => {
    expect(oracleSiteUrl('https://fa-eqzh-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/40001477')).toBe(
      'https://fa-eqzh-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
    );
    expect(oracleSiteUrl('https://EEHO.fa.us2.oraclecloud.com:443/hcmUI/CandidateExperience/fr-FR/sites/jobsearch/requisitions?x=1')).toBe(
      'https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch',
    );
    expect(oracleSiteUrl('https://careers.avient.com/job/1')).toBeNull();
    expect(oracleSiteUrl('https://evil.example.com/x.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX')).toBeNull();
  });

  it('reads the site name, else the title, decoding entities', () => {
    expect(siteNameFromPage(AVIENT_PAGE)).toBe('Avient');
    expect(siteNameFromPage('<head><title>Chili&#39;s &amp; Friends</title></head>')).toBe("Chili's & Friends");
    expect(siteNameFromPage(`<meta content='Steen &amp; Strom' property='og:site_name'>`)).toBe('Steen & Strom');
    expect(siteNameFromPage('<head><meta property="og:site_name" content=" "><title> </title></head>')).toBeNull();
  });

  it('names the company by the site that covers the most open roles', () => {
    expect(
      pickSiteName([
        { name: 'Staples Inc.', jobs: 40 },
        { name: 'Staples Business', jobs: 30 },
        { name: 'Staples Inc.', jobs: 5 },
        { name: 'Candidate Experience site', jobs: 500 },
      ]),
    ).toBe('Staples');
    expect(pickSiteName([{ name: 'Penske Careers', jobs: 2 }, { name: 'Penske Careers French', jobs: 1 }])).toBe('Penske');
    expect(pickSiteName([{ name: 'Join', jobs: 3 }, { name: null, jobs: 1 }])).toBeNull();
    expect(pickSiteName([])).toBeNull();
  });

  it('fetches a page and refuses an error answer', async () => {
    const seen: string[] = [];
    const ok = createSitePage(async (url) => {
      seen.push(String(url));
      return new Response(AVIENT_PAGE, { status: 200 });
    });
    expect(siteNameFromPage(await ok('https://x.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX'))).toBe('Avient');
    expect(seen).toEqual(['https://x.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX']);
    const down = createSitePage(async () => new Response('busy', { status: 503 }));
    await expect(down('https://x.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX')).rejects.toThrow('503');
  });
});

class Rollback extends Error {}

describe.skipIf(!process.env.TEST_DATABASE_URL)('refreshSiteNames (dedicated test database)', () => {
  let sql: Sql;
  const log = pino({ level: 'silent' });
  beforeAll(async () => {
    sql = createSql(process.env.TEST_DATABASE_URL!);
    await migrate(sql);
  });
  afterAll(async () => {
    await sql.end();
  });

  const host = (code: string) => `https://${code}.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites`;
  async function addJob(tx: Sql, id: string, companyId: string, url: string): Promise<void> {
    await tx`insert into job_mirror (id, company_id, company_name, title, remote, opened_at, first_seen_at, last_seen_at, opened_source, repost_count, payload)
      values (${id}, ${companyId}, 'code', 'Engineer', false, '2026-11-09', '2026-11-09', '2026-11-09', 'posted', 0, ${tx.json({ url })})`;
  }

  it('reads each tenant site once, names the company by it, and lets a hand-checked name win', async () => {
    const result = { rows: [] as unknown[], company: [] as unknown[], reads: [] as string[], again: [] as string[], afterLoss: [] as unknown[] };
    await sql
      .begin(async (raw) => {
        const tx = raw as unknown as Sql;
        await tx`insert into company (company_id,slug,name,domain,open,rank,updated_on) values
          ('site_avient','site-avient','fa-eqzh-saasfaprod1',null,3,900101,'2026-11-09'),
          ('site_staples','site-staples','Fa Exhh Saasfaprod1',null,3,900102,'2026-11-09'),
          ('site_generic','site-generic','Fa Eocc Saasfaprod1',null,1,900103,'2026-11-09'),
          ('site_checked','site-checked','Fa Ewjt Saasfaprod1',null,1,900104,'2026-11-09'),
          ('site_named','site-named','Bluelight Consulting',null,1,900105,'2026-11-09'),
          ('site_down','site-down','fa-exdu-dev2-saasfaprod1',null,1,900106,'2026-11-09')`;
        await tx`insert into company_name_override (company_id,name,note) values ('site_checked','EXL','test')`;
        await addJob(tx, 'site_j1', 'site_avient', `${host('fa-eqzh-saasfaprod1')}/CX_1/job/1`);
        await addJob(tx, 'site_j2', 'site_avient', `${host('fa-eqzh-saasfaprod1')}/CX_1/job/2`);
        await addJob(tx, 'site_j3', 'site_avient', 'https://careers.avient.com/job/3');
        await addJob(tx, 'site_j4', 'site_staples', `${host('fa-exhh-saasfaprod1')}/StaplesRetail/job/4`);
        await addJob(tx, 'site_j5', 'site_staples', `${host('fa-exhh-saasfaprod1')}/CX/job/5`);
        await addJob(tx, 'site_j6', 'site_staples', `${host('fa-exhh-saasfaprod1')}/CX/job/6`);
        await addJob(tx, 'site_j7', 'site_generic', `${host('fa-eocc-saasfaprod1')}/CX/job/7`);
        await addJob(tx, 'site_j8', 'site_checked', `${host('fa-ewjt-saasfaprod1')}/CX/job/8`);
        await addJob(tx, 'site_j9', 'site_named', `${host('fa-zzzz-saasfaprod1')}/CX/job/9`);
        await addJob(tx, 'site_j10', 'site_down', `${host('fa-exdu-dev2-saasfaprod1')}/CX_1/job/10`);

        const names: Record<string, string> = {
          [`${host('fa-eqzh-saasfaprod1')}/CX_1`]: '<meta property="og:site_name" content="Avient"/>',
          [`${host('fa-exhh-saasfaprod1')}/StaplesRetail`]: '<title>Staples Retail</title>',
          [`${host('fa-exhh-saasfaprod1')}/CX`]: '<title>Staples Inc.</title>',
          [`${host('fa-eocc-saasfaprod1')}/CX`]: '<title>Candidate Experience site</title>',
        };
        const page = (reads: string[]): SitePage => async (url) => {
          reads.push(url);
          const html = names[url];
          if (html === undefined) throw new Error('careers site answered 503');
          return html;
        };
        await refreshSiteNames({ sql: tx, log, sitePage: page(result.reads), recheckDays: 90 });
        // A second run reads only what failed.
        await refreshSiteNames({ sql: tx, log, sitePage: page(result.again), recheckDays: 90 });
        result.rows = [...(await tx`select company_id, site_url, jobs, site_name, checked_at is not null as checked from company_site_name where company_id like 'site_%' order by company_id, site_url`)];
        await applyCompanyNames(tx);
        result.company = [...(await tx`select company_id, display_name, named from company where company_id like 'site_%' order by company_id`)];
        // A site with no open roles left is dropped, and the name goes with it.
        await tx`delete from job_mirror where company_id = 'site_avient'`;
        await refreshSiteNames({ sql: tx, log, sitePage: page([]), recheckDays: 90 });
        await applyCompanyNames(tx);
        result.afterLoss = [...(await tx`select display_name, named from company where company_id = 'site_avient'`)];
        throw new Rollback();
      })
      .catch((err: unknown) => {
        if (!(err instanceof Rollback)) throw err;
      });

    expect(result.reads.sort()).toEqual(
      [
        `${host('fa-eqzh-saasfaprod1')}/CX_1`,
        `${host('fa-exhh-saasfaprod1')}/StaplesRetail`,
        `${host('fa-exhh-saasfaprod1')}/CX`,
        `${host('fa-eocc-saasfaprod1')}/CX`,
        `${host('fa-exdu-dev2-saasfaprod1')}/CX_1`,
      ].sort(),
    );
    expect(result.again).toEqual([`${host('fa-exdu-dev2-saasfaprod1')}/CX_1`]);
    expect(result.rows).toEqual([
      { company_id: 'site_avient', site_url: `${host('fa-eqzh-saasfaprod1')}/CX_1`, jobs: 2, site_name: 'Avient', checked: true },
      { company_id: 'site_down', site_url: `${host('fa-exdu-dev2-saasfaprod1')}/CX_1`, jobs: 1, site_name: null, checked: false },
      { company_id: 'site_generic', site_url: `${host('fa-eocc-saasfaprod1')}/CX`, jobs: 1, site_name: 'Candidate Experience site', checked: true },
      { company_id: 'site_staples', site_url: `${host('fa-exhh-saasfaprod1')}/CX`, jobs: 2, site_name: 'Staples Inc.', checked: true },
      { company_id: 'site_staples', site_url: `${host('fa-exhh-saasfaprod1')}/StaplesRetail`, jobs: 1, site_name: 'Staples Retail', checked: true },
    ]);
    expect(result.company).toEqual([
      { company_id: 'site_avient', display_name: 'Avient', named: true },
      { company_id: 'site_checked', display_name: 'EXL', named: true },
      { company_id: 'site_down', display_name: 'fa-exdu-dev2-saasfaprod1', named: false },
      { company_id: 'site_generic', display_name: 'Fa Eocc Saasfaprod1', named: false },
      { company_id: 'site_named', display_name: 'Bluelight Consulting', named: true },
      { company_id: 'site_staples', display_name: 'Staples', named: true },
    ]);
    expect(result.afterLoss).toEqual([{ display_name: 'fa-eqzh-saasfaprod1', named: false }]);
  });
});
