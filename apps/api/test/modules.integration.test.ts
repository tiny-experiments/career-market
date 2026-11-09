import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import { createSql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import type { KrillJobDetail } from '@cm/core/krillJob';
import { createDatabase, type Database } from '../src/database/client.ts';
import { createApp } from '../src/app.ts';
import type { JobsRepository, JobsQuery } from '../src/modules/jobs/domain.ts';

const url = process.env.TEST_DATABASE_URL;
const job: KrillJobDetail = {
  id: 'kr_aaaaaaaaaaaaaaaa',
  status: 'open',
  title: 'Software Engineer',
  company: { id: 'acme', name: 'Acme' },
  url: 'https://acme.example/jobs/1',
  applyUrl: 'https://acme.example/apply/1',
  employmentType: 'FULL_TIME',
  workMode: 'remote',
  locations: ['London'],
  places: [{ label: 'London', countryCode: 'GB' }],
  salary: null,
  postedAt: null,
  openedAt: '2026-11-05',
  openedSource: 'first_seen',
  firstSeenAt: '2026-11-05',
  lastSeenAt: '2026-11-09',
  family: 'software',
  specialty: null,
  level: 'senior',
  skills: ['lang:python'],
  languages: ['lang:python'],
  tools: [],
  ageDays: 4,
  repostCount: 2,
  staleScore: 0.1,
  description: 'Build software.',
};
const list = vi.fn(async (q: JobsQuery) => ({
  items: [job],
  page: q.page,
  pageSize: q.pageSize,
  total: 1,
}));
const lookup = vi.fn<JobsRepository['lookup']>(async (id) =>
  id === job.id
    ? { kind: 'open', job }
    : id === 'kr_bbbbbbbbbbbbbbbb'
      ? {
          kind: 'closed',
          tombstone: {
            id,
            status: 'closed',
            closedAt: '2026-11-09',
            openedAt: '2026-11-05',
            openedSource: 'posted',
            family: 'software',
          },
        }
      : { kind: 'missing' },
);
const similar = vi.fn(async () => []);
const pulseCounts = vi.fn(async () => ({
  open: 100,
  newToday: 3,
  withPay: 40,
}));
const source: JobsRepository = { list, lookup, similar, pulseCounts };
const log = pino({ level: 'silent' });

describe.skipIf(!url)('public module integration (real Postgres)', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!/^cm_(test|cmr_p2_api)/.test(parsed.pathname.slice(1)))
      throw new Error(
        'Use an isolated cm_test* or cm_cmr_p2_api* test database',
      );
    const setup = createSql(url!, { max: 1 });
    try {
      await migrate(setup);
      await setup`truncate job_mirror, skill_pair_daily, skill_salary_effect restart identity cascade`;
      await setup`truncate build_run, market_daily, family_daily, profession_daily, profession_snapshot, market_change, company,
        company_daily, company_signal, search_entry, skill_tracked, skill_summary, skill_daily,
        skill_latest_role, skill_series, screener_facet restart identity cascade`;
      await setup`insert into build_run (snapshot_date, status, finished_at) values ('2026-11-09','ok',now())`;
      await setup`insert into market_daily (date, estimated, open, open_on_today_boards, opened, closed, index_value)
        values ('2026-11-09',false,100,100,10,5,100)`;
      await setup`insert into family_daily (date,family,code,open,opened,closed,share,index_value)
        values ('2026-11-06','software','SWE',80,10,5,1,90),('2026-11-08','software','SWE',98,10,5,1,99),
               ('2026-11-09','software','SWE',100,10,5,1,100)`;
      await setup`insert into profession_snapshot (date,family,companies,remote,hybrid,onsite,work_mode_total,salary_n,salary_p25,salary_p50,salary_p75)
        values ('2026-11-09','software',12,20,30,50,100,300,100000,120000,150000)`;
      await setup`insert into profession_daily (date,family,specialty,level,country,open,new,closed,opened)
        values ('2026-11-06','software','','senior','GB',40,10,5,10),('2026-11-06','software','','senior','US',40,10,5,10),
               ('2026-11-08','software','','senior','GB',50,10,5,10),('2026-11-08','software','','senior','US',48,10,5,10),
               ('2026-11-09','software','','senior','GB',60,10,5,10),('2026-11-09','software','','senior','US',40,10,5,10)`;
      await setup`insert into market_change (as_of,subject,range,base_date,change,partial,estimated) values
        ('2026-11-09','market','1W','2026-11-02',0.1,false,false),
        ('2026-11-09','family:software','1W','2026-11-02',0.1,false,false),
        ('2026-11-09','cpage:acme','1W','2026-11-02',0.2,false,false),
        ('2026-11-09','cpage:acme','1M','2026-11-03',0.2,true,false),
        ('2026-11-09','cpage:beta','1W','2026-11-08',0.5,true,false),
        ('2026-11-09','cpage:beta','1M','2026-10-10',-0.3,false,false),
        ('2026-11-09','skillseries:lang:python','1W','2026-11-02',0.05,false,true),
        ('2026-11-09','skillseries:lang:python','1M','2026-10-10',0.12,false,true)`;
      await setup`insert into company (company_id,slug,name,domain,open,rank,updated_on) values
        ('acme','acme','Acme','acme.example',100,1,'2026-11-09'),
        ('beta','beta','Beta',null,30,2,'2026-11-09'),
        ('small','small','Small',null,1,3,'2026-11-09'),
        ('literal','literal','100%_literal',null,1,4,'2026-11-09')`;
      await setup`insert into company_daily (date,company_id,family,open,new,closed) values
        ('2026-11-08','acme','*',90,5,1),('2026-11-09','acme','*',100,10,0)`;
      await setup`insert into company_signal (as_of,company_id,state,window_from,window_days,opened,closed,open_base,partial,explainer)
        values ('2026-11-09','acme','RAMPING','2026-11-02',7,20,1,80,false,'Private upstream wording')`;
      await setup`insert into skill_tracked (date,skill) values ('2026-11-09','lang:python'),('2026-11-09','ml:jax')`;
      await setup`insert into skill_summary (date,skill,slug,open_total,primary_family) values
        ('2026-11-09','lang:python','python',70,'software'),('2026-11-08','ml:jax','jax',10,'software')`;
      await setup`insert into skill_daily (date,skill,family,country,open) values
        ('2026-11-09','lang:python','software','*',70),('2026-11-08','ml:jax','software','*',10)`;
      await setup`insert into skill_series (skill,family,date,open,estimated) values
        ('lang:python','software','2026-11-08',60,false),('lang:python','software','2026-11-09',70,false)`;
      await setup`insert into skill_pair_daily (date,skill,other,open) values
        ('2026-11-09','lang:python','cloud:aws',35),('2026-11-09','lang:python','lang:java',7)`;
      await setup`insert into skill_salary_effect (date,skill,family,currency,n_with,n_without,median_with,median_without,sample_size) values
        ('2026-11-09','lang:python','software','USD',60,60,180000,165000,120)`;
      for (const [index, mode] of ['remote', 'remote', 'onsite', 'onsite', null].entries()) {
        const payload = { skills: index < 4 ? ['lang:python', 'cloud:aws'] : ['lang:python'] };
        await setup`insert into job_mirror (id,company_id,company_name,title,family,level,countries,work_mode,remote,opened_at,first_seen_at,last_seen_at,opened_source,salary_min,salary_max,salary_currency,repost_count,payload)
          values (${`kr_facet${index}`},'acme','Acme','Engineer',${index < 3 ? 'software' : 'data'},${index < 4 ? 'senior' : null},${['GB']},${mode},${mode === 'remote'},'2026-11-01','2026-11-01','2026-11-09','posted',${100000 + index * 10000},${120000 + index * 10000},'USD',0,${setup.json(payload)})`;
      }
      await setup`select refresh_market_facets()`;
      await setup`insert into search_entry (as_of,kind,id,slug,label,open,domain,keywords) values
        ('2026-11-09','company','acme','acme','Acme',100,'acme.example','acme'),
        ('2026-11-09','skill','lang:python','python','Python',70,null,'python'),
        ('2026-11-09','company','literal','literal','100%_literal',1,null,'literal')`;
      await setup`insert into screener_facet (as_of,kind,value,count) values
        ('2026-11-09','total','*',100),('2026-11-09','country','GB',100)`;
    } finally {
      await setup.end();
    }
    db = createDatabase(url!);
    app = createApp({ db, log, jobs: source });
  });
  afterAll(async () => {
    await db?.destroy();
  });

  describe('market', () => {
    it('preserves headline, changes and aggregate projections without a browser token', async () => {
      const res = await request(app).get('/api/market').expect(200);
      expect(res.body.headline).toMatchObject({
        open: 100,
        change: { value: 0.1 },
      });
      expect(res.body.series).toHaveLength(1);
      expect(res.body.countries[0]).toMatchObject({ code: 'GB', open: 60 });
      expect(res.body.stats.remoteShare).toBeCloseTo(0.2);
      expect(res.body.signalCounts).toEqual({
        ramping: 1,
        steady: 0,
        cooling: 0,
        freezing: 0,
      });
      expect(res.headers['cache-control']).toContain('s-maxage=300');
      expect(JSON.stringify(res.body)).not.toMatch(/krill/i);
    });
  });
  describe('meta', () => {
    it('ports the ticker and chrome payload', async () => {
      const res = await request(app).get('/api/meta').expect(200);
      expect(res.body.asOf).toBe('2026-11-09');
      expect(res.body.ticker).toEqual(expect.any(Array));
    });
  });
  describe('professions', () => {
    it('serves the index and detail from Postgres', async () => {
      const index = await request(app).get('/api/professions').expect(200);
      expect(index.body.rows.length).toBeGreaterThan(0);
      expect(index.body.region).toBeNull();
      expect(index.body.rows[0]).toMatchObject({
        family: 'software',
        open: 100,
        companies: 12,
        pay: { low: 100000, median: 120000, high: 150000 },
        remoteShare: 0.2,
        newThisWeek: 30,
      });
      expect(index.body.rows[0].change1d).toBeCloseTo(100 / 99 - 1);

      const europe = await request(app)
        .get('/api/professions?region=europe')
        .expect(200);
      expect(europe.body.region).toBe('europe');
      expect(europe.body.rows[0]).toMatchObject({
        open: 60,
        companies: null,
        remoteShare: null,
      });
      // The family index rose 100/90 and Europe's share of it went from 50% to 60%.
      expect(europe.body.rows[0].change.value).toBeCloseTo(
        ((100 * 0.6) / (90 * 0.5)) - 1,
      );
      await request(app).get('/api/professions?region=mars').expect(400);

      const detail = await request(app).get('/api/professions/swe').expect(200);
      expect(detail.body).toMatchObject({ family: 'software', open: 100 });
      expect(JSON.stringify(detail.body)).not.toMatch(/krill/i);
      await request(app).get('/api/professions/nope').expect(404);
    });
  });
  describe('companies', () => {
    it('paginates all companies including those with one role, without a fixed cap', async () => {
      const first = await request(app)
        .get('/api/companies?pageSize=2')
        .expect(200);
      const last = await request(app)
        .get('/api/companies?pageSize=2&page=2')
        .expect(200);
      expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 4 });
      expect(
        [...first.body.items, ...last.body.items].map(
          (c: { slug: string }) => c.slug,
        ),
      ).toContain('small');
      expect(
        new Set(
          [...first.body.items, ...last.body.items].map(
            (c: { slug: string }) => c.slug,
          ),
        ).size,
      ).toBe(4);
      const empty = await request(app)
        .get('/api/companies?page=99')
        .expect(200);
      expect(empty.body.items).toEqual([]);
      expect(empty.body.total).toBe(4);
    });
    it('filters by signal and literal name; sorts by requested value', async () => {
      const signal = await request(app)
        .get('/api/companies?signal=ramping')
        .expect(200);
      expect(signal.body.items.map((c: { slug: string }) => c.slug)).toEqual([
        'acme',
      ]);
      const name = await request(app)
        .get('/api/companies?q=100%25_')
        .expect(200);
      expect(name.body.items.map((c: { slug: string }) => c.slug)).toEqual([
        'literal',
      ]);
      const sorted = await request(app)
        .get('/api/companies?sort=name&dir=asc')
        .expect(200);
      expect(sorted.body.items.map((c: { name: string }) => c.name)).toEqual([
        '100%_literal',
        'Acme',
        'Beta',
        'Small',
      ]);
      const byName = await request(app)
        .get('/api/companies?sort=name')
        .expect(200);
      expect(byName.body.items).toEqual(sorted.body.items);
      const byNameDesc = await request(app)
        .get('/api/companies?sort=name&dir=desc')
        .expect(200);
      expect(byNameDesc.body.items.map((c: { name: string }) => c.name)).toEqual(
        ['Small', 'Beta', 'Acme', '100%_literal'],
      );
    });
    it('preserves detail and serves company roles through the job repository', async () => {
      const res = await request(app).get('/api/companies/acme').expect(200);
      expect(res.body.company).toMatchObject({
        id: 'acme',
        domain: 'acme.example',
        open: 100,
      });
      expect(res.body.explainer).toBe(
        'Openings are growing faster than closures.',
      );
      const jobs = await request(app)
        .get('/api/companies/acme/jobs?workMode=remote')
        .expect(200);
      expect(jobs.body.items[0].href).toBe('/jobs/kr_aaaaaaaaaaaaaaaa');
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ company: 'acme', workMode: ['remote'] }),
      );
      await request(app).get('/api/companies/unknown').expect(404);
    });
  });
  describe('company facets', () => {
    beforeAll(async () => {
      const setup = createSql(url!, { max: 1 });
      await setup`insert into company (company_id,slug,name,domain,open,rank,updated_on,display_name,named) values
        ('code','code','fa-saasfaprod1','code.example',500,5,'2026-11-09','fa-saasfaprod1',false),
        ('named','careers-at-named','Careers at Named: search jobs','named.example',500,6,'2026-11-09','Named',true)`;
      await setup`insert into market_change (as_of,subject,range,base_date,change,partial,estimated) values
        ('2026-11-09','cpage:code','1W','2026-11-02',0.5,false,false),
        ('2026-11-09','cpage:named','1W','2026-11-02',0.4,false,false)`;
      await setup.end();
    });
    afterAll(async () => {
      const setup = createSql(url!, { max: 1 });
      await setup`delete from company where company_id in ('code','named')`;
      await setup`delete from market_change where subject in ('cpage:code','cpage:named')`;
      await setup.end();
    });
    it('adds top profession, remote share and only full-window changes to the directory', async () => {
      const res = await request(app).get('/api/companies?q=acme').expect(200);
      expect(res.body.items[0]).toMatchObject({
        topProfession: { family: 'software' },
        remoteShare: 0.5,
        change30d: null,
      });
      expect(res.body.items[0].change.value).toBe(0.2);
      const beta = await request(app).get('/api/companies?q=beta').expect(200);
      expect(beta.body.items[0].change).toBeNull();
      expect(beta.body.items[0].change30d.value).toBe(-0.3);
      expect(beta.body.items[0]).toMatchObject({
        topProfession: null,
        remoteShare: null,
      });
    });
    it('shows and searches the name a visitor reads', async () => {
      const shown = await request(app).get('/api/companies?q=named').expect(200);
      expect(shown.body.items[0].name).toBe('Named');
      const raw = await request(app)
        .get('/api/companies?q=search%20jobs')
        .expect(200);
      expect(raw.body.items[0].name).toBe('Named');
      const code = await request(app)
        .get('/api/companies?q=saasfaprod')
        .expect(200);
      expect(code.body.items[0].name).toBe('fa-saasfaprod1');
      const detail = await request(app)
        .get('/api/companies/careers-at-named')
        .expect(200);
      expect(detail.body.company.name).toBe('Named');
    });
    it('sorts by 30-day change and leaves out companies with no open roles', async () => {
      const res = await request(app)
        .get('/api/companies?sort=change30d&dir=asc')
        .expect(200);
      expect(res.body.items[0].slug).toBe('beta');
    });
    it('sorts a window too short to show as no value, in either direction', async () => {
      const week = await request(app)
        .get('/api/companies?sort=change1w&dir=desc')
        .expect(200);
      const weekSlugs = week.body.items.map((i: { slug: string }) => i.slug);
      expect(weekSlugs.slice(0, 3)).toEqual(['code', 'careers-at-named', 'acme']);
      const weekAsc = await request(app)
        .get('/api/companies?sort=change1w&dir=asc')
        .expect(200);
      expect(weekAsc.body.items[0].slug).toBe('acme');
      const month = await request(app)
        .get('/api/companies?sort=change30d&dir=desc')
        .expect(200);
      expect(month.body.items[0].slug).toBe('beta');
    });
    it('counts signals and lists the week\'s movers', async () => {
      const res = await request(app).get('/api/company-signals').expect(200);
      expect(res.body.counts).toEqual({
        RAMPING: 1,
        STEADY: 0,
        COOLING: 0,
        FREEZING: 0,
      });
      // The code is listed elsewhere but never headlines a card.
      expect(res.body.ramping.map((m: { name: string }) => m.name)).toEqual([
        'Named',
        'Acme',
      ]);
      expect(res.body.cooling).toEqual([]);
    });
    it('breaks a company\'s roles down for its page', async () => {
      const res = await request(app).get('/api/companies/acme').expect(200);
      expect(res.body.change7d.value).toBe(0.2);
      expect(res.body.change30d).toBeNull();
      expect(res.body.facets).toMatchObject({
        open: 5,
        remoteShare: 0.5,
        families: [
          { value: 'software', label: 'Software', count: 3 },
          { value: 'data', count: 2 },
        ],
        levels: [{ value: 'senior', count: 4 }],
        countries: [{ code: 'GB', count: 5 }],
        pay: { roles: 5, median: 130000 },
      });
      expect(res.body.facets.skills[0]).toMatchObject({
        value: 'lang:python',
        count: 5,
        slug: 'python',
        domain: 'python.org',
      });
      expect(JSON.stringify(res.body.facets)).not.toMatch(/krill/i);
    });
    it('has no facets for a company it has not counted', async () => {
      const res = await request(app).get('/api/companies/beta').expect(200);
      expect(res.body.facets).toBeNull();
    });
  });
  describe('skills', () => {
    it('serves tracked skills and preserves last-good-day fallback', async () => {
      const index = await request(app).get('/api/skills').expect(200);
      expect(index.body.skills.map((s: { slug: string }) => s.slug)).toEqual([
        'python',
        'jax',
      ]);
      const detail = await request(app).get('/api/skills/python').expect(200);
      expect(detail.body).toMatchObject({ totalOpen: 70, stale: false });
      const stale = await request(app).get('/api/skills/jax').expect(200);
      expect(stale.body).toMatchObject({
        asOf: '2026-11-08',
        stale: true,
        totalOpen: 10,
      });
      expect(index.body.skills[0]).toMatchObject({
        change7d: { value: 0.05 },
        spark: [60, 70],
        remoteShare: 0.5,
        pay: { roles: 5, median: 130000 },
        payEffect: 15000,
        topPair: { slug: null, label: 'AWS', share: 0.5 },
      });
      expect(index.body.skills[1]).toMatchObject({
        spark: [],
        remoteShare: null,
        pay: null,
        payEffect: null,
        topPair: null,
      });
      expect(detail.body).toMatchObject({
        rank: 1,
        remoteShare: 0.5,
        change7d: { value: 0.05 },
        pay: { median: 130000 },
      });
      await request(app).get('/api/skills/unknown').expect(404);
      expect(JSON.stringify(detail.body)).not.toMatch(/krill/i);
    });
  });
  describe('jobs', () => {
    it('filters and paginates via the injected repository, with local company names and logos', async () => {
      const res = await request(app)
        .get(
          '/api/jobs?company=Acme&workMode=remote&postedWithin=7&hasPay=true&page=2&pageSize=10',
        )
        .expect(200);
      expect(res.body).toMatchObject({ page: 2, pageSize: 10, total: 1 });
      expect(res.body.items[0]).toMatchObject({
        href: '/jobs/kr_aaaaaaaaaaaaaaaa',
        company: { domain: 'acme.example' },
      });
      expect(res.body.items[0]).not.toHaveProperty('url');
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          company: 'acme',
          workMode: ['remote'],
          postedWithin: 7,
          hasPay: 'true',
        }),
      );
      await request(app).get('/api/jobs?company=Not-a-company').expect(200);
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          company: undefined,
          companyContains: 'Not-a-company',
        }),
      );
    });
    it('serves the Jobs strip from the read model and live counts', async () => {
      const res = await request(app).get('/api/jobs/pulse').expect(200);
      expect(res.body).toMatchObject({
        open: 100,
        newToday: 3,
        withPay: 40,
        change1w: 0.1,
        openSpark: [100],
        professions: [{ family: 'software', code: 'SWE', change1w: 0.1 }],
      });
      expect(JSON.stringify(res.body)).not.toMatch(/krill/i);
    });
    it('preserves job verdict/context, closed and missing responses', async () => {
      const res = await request(app).get(`/api/jobs/${job.id}`).expect(200);
      expect(res.body).toMatchObject({
        status: 'open',
        job: {
          description: 'Build software.',
          repostCount: 2,
          company: { domain: 'acme.example' },
        },
      });
      expect(res.body.context.health).toBeDefined();
      expect(res.body.context.verdict).toMatchObject({
        kind: 'evergreen',
        repostCount: 2,
      });
      expect(res.body.job.company.slug).toBe('acme');
      expect(res.body.context.companyTrend).toMatchObject({
        available: true,
        open: 100,
        spark: [90, 100],
      });
      await request(app).get('/api/jobs/kr_bbbbbbbbbbbbbbbb').expect(410);
      await request(app).get('/api/jobs/kr_cccccccccccccccc').expect(404);
      expect(JSON.stringify(res.body)).not.toMatch(/krill/i);
      const facets = await request(app).get('/api/jobs/facets').expect(200);
      expect(facets.body.facets).toContainEqual({
        kind: 'country',
        value: 'GB',
        count: 100,
      });
    });
    it('returns plain source errors rather than internal upstream details', async () => {
      list.mockRejectedValueOnce(new Error('private upstream error'));
      const res = await request(app).get('/api/jobs').expect(503);
      expect(res.body).toEqual({
        code: 'SOURCE_UNAVAILABLE',
        message: 'Roles could not be loaded. Try again shortly.',
      });
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });
  describe('search', () => {
    it('returns local ranked hits and internal job links', async () => {
      const res = await request(app)
        .get('/api/search?q=Acme&roles=1')
        .expect(200);
      expect(res.body.groups[0].hits[0]).toMatchObject({
        id: 'acme',
        href: '/companies/acme',
      });
      expect(res.body.roles[0].url).toBe('/jobs/kr_aaaaaaaaaaaaaaaa');
      const small = await request(app).get('/api/search?q=Small').expect(200);
      expect(small.body.groups[0].hits[0].id).toBe('small');
      const literal = await request(app).get('/api/search?q=%25_').expect(200);
      expect(literal.body.groups[0].hits[0].id).toBe('literal');
      list.mockRejectedValueOnce(new Error('source unavailable'));
      const degraded = await request(app)
        .get('/api/search?q=Acme&roles=1')
        .expect(200);
      expect(degraded.body).toMatchObject({
        roles: [],
        rolesUnavailable: true,
      });
      expect(degraded.body.groups[0].hits[0].id).toBe('acme');
    });
  });
  describe('HTTP contracts', () => {
    it.each([
      '/api/companies?pageSize=101',
      '/api/companies?page=0',
      '/api/companies?sort=sql',
      '/api/jobs?workMode=wrong',
      '/api/jobs?page=1&page=2',
      '/api/jobs?unknown=1',
      '/api/search?limit=999',
      '/api/meta?unknown=1',
    ])('strictly rejects %s', async (path) => {
      const res = await request(app).get(path).expect(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fields: expect.any(Object),
      });
      expect(res.headers['cache-control']).toBe('no-store');
    });
    it.each([
      'https://careermarket.app',
      'https://www.careermarket.app',
      'https://career-market-git-feature-team.vercel.app',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
    ])('allows browser origin %s', async (origin) => {
      const res = await request(app)
        .get('/api/meta')
        .set('Origin', origin)
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers.vary).toContain('Origin');
    });
    it('denies unapproved origins and supports preflight', async () => {
      await request(app)
        .get('/api/meta')
        .set('Origin', 'https://evil.example')
        .expect(403);
      await request(app)
        .get('/api/meta')
        .set('Origin', 'https://careermarket.app.evil.example')
        .expect(403);
      const res = await request(app)
        .options('/api/jobs')
        .set('Origin', 'https://careermarket.app')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
      expect(res.headers['access-control-allow-methods']).toBe(
        'GET,HEAD,OPTIONS',
      );
    });
    it('limits by actual IP and does not trust arbitrary forwarded headers', async () => {
      const limited = createApp({
        db,
        log,
        jobs: source,
        rateLimit: { limit: 1, windowMs: 60_000 },
      });
      await request(limited).get('/api/meta').expect(200);
      const res = await request(limited)
        .get('/api/meta')
        .set('X-Forwarded-For', '203.0.113.9')
        .expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      expect(res.headers['retry-after']).toBeDefined();
    });
    it('removes old versioned routes and revalidation', async () => {
      await request(app).get('/v1/market').expect(404);
      await request(app).post('/api/revalidate').expect(404);
      await request(app).post('/api/jobs').expect(404);
      await request(app).get('/health').expect(200);
    });
    it('turns database faults into generic, uncached JSON errors', async () => {
      const bad = createDatabase(
        'postgres://invalid:invalid@127.0.0.1:1/cm_test',
      );
      try {
        const failing = createApp({ db: bad, log, jobs: source });
        const res = await request(failing).get('/api/meta').expect(500);
        expect(res.body).toEqual({
          code: 'INTERNAL',
          message: 'Internal server error',
        });
      } finally {
        await bad.destroy();
      }
    });
  });
});
