import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { Sql } from '@cm/core/db';
import type { KrillJob, KrillJobDetail } from '@cm/core/krillJob';
import { createApp } from '../src/app.ts';
import { pickSimilar } from '../src/job.ts';
import { KrillLive, KrillLiveError } from '../src/krillLive.ts';

const token = 'test-token-0123456789';
const headers = { authorization: `Bearer ${token}` };

const job: KrillJobDetail = {
  id: 'kr_fsnjx38cyxf8r908',
  status: 'open',
  title: 'Sr. Machine Learning Engineer, Siri Speech',
  company: { id: 'co_apple', name: 'Apple' },
  ats: 'apple',
  url: 'https://jobs.apple.com/en-us/details/1',
  applyUrl: 'https://jobs.apple.com/app/en-us/apply/1',
  employmentType: 'FULL_TIME',
  workMode: null,
  locations: ['Cupertino, California, United States'],
  places: [{ label: 'Cupertino, California, United States', countryCode: 'US' }],
  salary: { min: 184_700, max: 324_800, currency: 'USD', period: 'YEAR', annualMin: 184_700, annualMax: 324_800 },
  postedAt: '2026-09-19T10:00:00.000Z',
  openedAt: '2026-09-19',
  openedSource: 'posted',
  firstSeenAt: '2026-11-01',
  lastSeenAt: '2026-11-06',
  family: 'ai-ml',
  specialty: 'ml-engineering',
  level: 'senior',
  skills: ['lang:python', 'ml:pytorch'],
  languages: ['lang:python'],
  tools: ['ml:pytorch'],
  ageDays: 48,
  repostCount: 0,
  staleScore: 0.56,
  description: 'About the role: build speech models.',
  skillEvidence: [
    { id: 'lang:python', count: 2 },
    { id: 'ml:pytorch', count: 5 },
  ],
};

const other = (id: string, companyId: string, title = 'ML Engineer'): KrillJob => ({ ...job, id, title, company: { id: companyId, name: companyId } });

/** A fake Postgres: answers each query by a word in its text. */
function fakeSql(rows: Record<string, unknown[]>): Sql {
  return ((strings: TemplateStringsArray) => {
    const text = strings.join('?');
    for (const [needle, result] of Object.entries(rows)) if (text.includes(needle)) return Promise.resolve(result);
    return Promise.resolve([]);
  }) as unknown as Sql;
}

const readModel = {
  'from build_run': [{ snapshot_date: '2026-11-06', finished_at: new Date('2026-11-06T15:00:00Z') }],
  'from pay_band': [
    { specialty: '', level: '', n: 400, p25: 150_000, p50: 200_000, p75: 260_000 },
    { specialty: 'ml-engineering', level: 'senior', n: 80, p25: 185_000, p50: 250_000, p75: 325_000 },
  ],
  'from family_daily': [
    { date: '2026-11-05', open: 9_000, index_value: 100 },
    { date: '2026-11-06', open: 9_625, index_value: 107 },
  ],
  'from market_change': [{ range: '1W', base_date: '2026-11-03', change: 0.031, partial: true, estimated: false }],
  'from closing_sample': [{ n: 12, p25: null, p50: null, p75: null }],
};

function fakeKrill(overrides: Partial<Record<'job' | 'company' | 'companyDaily' | 'jobs', unknown>> = {}) {
  const calls: string[] = [];
  const krill = {
    job: async (id: string) => {
      calls.push(`job:${id}`);
      const v = overrides.job ?? { kind: 'open', job };
      if (v instanceof Error) throw v;
      return v;
    },
    company: async () => {
      const v = overrides.company ?? { id: 'co_apple', name: 'Apple', domain: 'apple.com', openJobs: 3288 };
      if (v instanceof Error) throw v;
      return v;
    },
    companyDaily: async () => {
      const v = overrides.companyDaily ?? [
        { date: '2026-11-04', companyId: 'co_apple', open: 3200, new: 5, closed: 4 },
        { date: '2026-11-05', companyId: 'co_apple', open: 3250, new: 5, closed: 4 },
        { date: '2026-11-06', companyId: 'co_apple', open: 3288, new: 5, closed: 4 },
      ];
      if (v instanceof Error) throw v;
      return v;
    },
    jobs: async () => {
      const v = overrides.jobs ?? [other(job.id, 'co_apple'), other('kr_aaaaaaaa1', 'co_v'), other('kr_bbbbbbbb2', 'co_v'), other('kr_cccccccc3', 'co_t')];
      if (v instanceof Error) throw v;
      return v;
    },
  };
  return { krill: krill as unknown as KrillLive, calls };
}

function appWith(krill: KrillLive, rows = readModel) {
  return createApp({ sql: fakeSql(rows), token, log: pino({ level: 'silent' }), live: krill });
}

describe('GET /v1/jobs/:id', () => {
  it('composes the posting with the read model', async () => {
    const { krill } = fakeKrill();
    const res = await appWith(krill).request(`/v1/jobs/${job.id}`, { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('open');
    expect(body.asOf).toBe('2026-11-06');
    expect(body.job.location).toBe('Cupertino, California, US');
    expect(body.job.employmentType).toBe('Full-time');
    expect(body.job.company).toEqual({ id: 'co_apple', name: 'Apple', domain: 'apple.com' });
    expect(body.job.skills.map((s: { label: string }) => s.label)).toEqual(['PyTorch', 'Python']);
    expect(body.job.description).toContain('speech models');

    expect(body.context.health).toMatchObject({ state: 'active', headline: 'Looks active' });
    expect(body.context.salaryBand).toMatchObject({ available: true, p25: 185_000, p75: 325_000, n: 80, verdict: 'at market median' });
    expect(body.context.professionTrend).toMatchObject({ available: true, code: 'AIML', open: 9_625 });
    expect(body.context.professionTrend.change.value).toBe(0.031);
    expect(body.context.companyTrend).toMatchObject({ available: true, open: 3288, signal: null });
    expect(body.context.companyTrend.spark).toEqual([3200, 3250, 3288]);
    expect(body.context.companyTrend.signalNote).toContain('30 days');
    expect(body.context.similar.roles.map((r: { id: string }) => r.id)).toEqual(['kr_aaaaaaaa1', 'kr_cccccccc3', 'kr_bbbbbbbb2']);
  });

  it('keeps the page when a side panel fails, with an honest reason', async () => {
    const { krill } = fakeKrill({ companyDaily: new KrillLiveError(500, 'down'), jobs: new KrillLiveError(500, 'down') });
    const res = await appWith(krill, { ...readModel, 'from pay_band': [] } as typeof readModel).request(`/v1/jobs/${job.id}`, { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.context.companyTrend.available).toBe(false);
    expect(body.context.similar.available).toBe(false);
    expect(body.context.salaryBand).toEqual({ available: false, reason: 'Pay bands appear after the next nightly build.' });
  });

  it('says why there is no band for a posting without pay or outside the US', async () => {
    const nopay = { kind: 'open', job: { ...job, salary: null } };
    const r1 = await appWith(fakeKrill({ job: nopay }).krill).request(`/v1/jobs/${job.id}`, { headers });
    expect(((await r1.json()) as any).context.salaryBand.reason).toBe('This posting lists no pay.');
    const de = { kind: 'open', job: { ...job, places: [{ label: 'Berlin', countryCode: 'DE' }] } };
    const r2 = await appWith(fakeKrill({ job: de }).krill).request(`/v1/jobs/${job.id}`, { headers });
    expect(((await r2.json()) as any).context.salaryBand.reason).toContain('US roles priced in USD');
  });

  it('answers 410 with the tombstone for a closed role', async () => {
    const tomb = { id: job.id, status: 'closed', closedAt: '2026-11-05', openedAt: '2026-10-01', openedSource: 'posted', family: 'ai-ml' };
    const res = await appWith(fakeKrill({ job: { kind: 'closed', tombstone: tomb } }).krill).request(`/v1/jobs/${job.id}`, { headers });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ ...tomb, familyName: 'AI & ML' });
  });

  it('answers 404 for an unknown job and for an id that is not a krill id, without calling krill', async () => {
    const { krill, calls } = fakeKrill({ job: { kind: 'missing' } });
    const app = appWith(krill);
    expect((await app.request('/v1/jobs/kr_unknown123', { headers })).status).toBe(404);
    expect((await app.request('/v1/jobs/..%2Fsecret', { headers })).status).toBe(404);
    expect(calls).toEqual(['job:kr_unknown123']);
  });

  it('answers 502 when krill does not answer for the job itself', async () => {
    const res = await appWith(fakeKrill({ job: new KrillLiveError(null, 'down') }).krill).request(`/v1/jobs/${job.id}`, { headers });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ code: 'KRILL_UNAVAILABLE', message: 'krill did not answer' });
  });

  it('needs the bearer token', async () => {
    expect((await appWith(fakeKrill().krill).request(`/v1/jobs/${job.id}`)).status).toBe(401);
  });

  it('rejects an apply link that is not http(s)', async () => {
    const bad = { kind: 'open', job: { ...job, applyUrl: 'javascript:alert(1)', url: 'https://jobs.apple.com/x' } };
    const body = (await (await appWith(fakeKrill({ job: bad }).krill).request(`/v1/jobs/${job.id}`, { headers })).json()) as any;
    expect(body.job.applyUrl).toBe('https://jobs.apple.com/x');
    const none = { kind: 'open', job: { ...job, applyUrl: 'javascript:alert(1)', url: 'data:text/html,x' } };
    const body2 = (await (await appWith(fakeKrill({ job: none }).krill).request(`/v1/jobs/${job.id}`, { headers })).json()) as any;
    expect(body2.job.applyUrl).toBeNull();
  });
});

describe('pickSimilar', () => {
  it('leaves out the role itself and shows one role per company before repeating a company', () => {
    const items = [other('self', 'a'), other('1', 'a'), other('2', 'a'), other('3', 'b'), other('4', 'c'), other('5', 'd')];
    expect(pickSimilar(items, 'self').map((j) => j.id)).toEqual(['1', '3', '4', '5']);
    expect(pickSimilar(items.slice(0, 3), 'self').map((j) => j.id)).toEqual(['1', '2']);
  });
});
