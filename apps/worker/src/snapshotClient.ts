import type { Logger } from '@cm/core/logger';
import type { z } from 'zod';
import { KrillClient, type Params, type ReadOptions } from './krill/client.ts';
import type { MirrorJob } from './mirror.ts';
import type { KrillCompanyListing } from './krill/companyApi.ts';

/** Reuse the complete snapshot for current facets and samples, rather than pull it again in thousands of slices. */
export class SnapshotClient extends KrillClient {
  private readonly valuesCache = new WeakMap<MirrorJob, Record<string, string[]>>();
  private readonly index = new Map<string, MirrorJob[]>();
  private readonly companies: Map<string, KrillCompanyListing>;
  private readonly answers = new Map<string, unknown>();

  constructor(private readonly source: KrillClient, private readonly jobs: MirrorJob[], directory: KrillCompanyListing[], logger: Logger) {
    super({ baseUrl: 'https://snapshot.invalid', ratePerMinute: 500, timeoutMs: 1000, logger });
    this.companies = new Map(directory.map((company) => [company.id, company]));
    for (const job of jobs) {
      for (const [key, values] of Object.entries(this.values(job))) {
        for (const value of values) {
          const indexKey = `${key}:${value}`;
          const list = this.index.get(indexKey);
          if (list) list.push(job); else this.index.set(indexKey, [job]);
        }
      }
    }
  }

  private values(job: MirrorJob): Record<string, string[]> {
    const cached = this.valuesCache.get(job);
    if (cached) return cached;
    const values = { family: job.family ? [job.family] : [], specialty: job.specialty ? [job.specialty] : [],
      level: job.level ? [job.level] : [], workMode: job.workMode ? [job.workMode] : [],
      ats: job.ats ? [job.ats] : [], company: [job.company.id], skill: [...new Set(job.skills)],
      language: [...new Set(job.languages)], country: [...new Set(job.places.flatMap((p) => p.countryCode ? [p.countryCode] : []))] };
    this.valuesCache.set(job, values);
    return values;
  }

  private filtered(params: Params): MirrorJob[] {
    const filters = Object.entries(params).filter(([key, value]) => value !== undefined && ['family', 'specialty', 'level', 'workMode', 'ats', 'company', 'skills', 'country'].includes(key));
    let candidates = this.jobs;
    for (const [key, value] of filters) {
      const values = String(value).split(',');
      if (values.length !== 1) continue;
      const list = this.index.get(`${key === 'skills' ? 'skill' : key}:${values[0]}`) ?? [];
      if (list.length < candidates.length) candidates = list;
    }
    return candidates.filter((job) => {
      const values = this.values(job);
      for (const [key, value] of filters) {
        const have = values[key === 'skills' ? 'skill' : key] ?? [];
        if (!String(value).split(',').some((v) => have.includes(v))) return false;
      }
      if (params.openedSince && job.openedAt < String(params.openedSince)) return false;
      if (params.postedSince && (!job.postedAt || job.postedAt.slice(0, 10) < String(params.postedSince))) return false;
      if (params.currency && job.salary?.currency !== params.currency) return false;
      if (params.salaryMin !== undefined && Math.max(job.salary?.annualMin ?? 0, job.salary?.annualMax ?? 0) < Number(params.salaryMin)) return false;
      return true;
    });
  }

  override async get<S extends z.ZodTypeAny>(pathname: string, params: Params, schema: S,
    options: ReadOptions = {}): Promise<{ status: number; data: z.infer<S> }> {
    const key = JSON.stringify([pathname, Object.entries(params).sort(([a], [b]) => a.localeCompare(b)), options.countOnly, options.facetDimensions]);
    let answer = this.answers.get(key);
    if (answer === undefined) {
      if (pathname === '/v1/facets') {
        const jobs = this.filtered(params);
        const counts = new Map<string, Map<string, number>>();
        const dimensions = options.countOnly ? [] : options.facetDimensions ?? ['family', 'specialty', 'level', 'workMode', 'ats', 'company', 'skill', 'language', 'country'];
        for (const job of jobs) for (const name of dimensions) {
          const values = this.values(job)[name] ?? [];
          const count = counts.get(name) ?? new Map<string, number>();
          for (const value of values) count.set(value, (count.get(value) ?? 0) + 1);
          counts.set(name, count);
        }
        const facets = Object.fromEntries(['family', 'specialty', 'level', 'workMode', 'ats', 'company', 'skill', 'language', 'country'].map((name) => [name,
          [...(counts.get(name) ?? [])].map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, Number(params.limit ?? 20))]));
        answer = { total: jobs.length, facets };
      } else if (pathname === '/v1/jobs') {
        const jobs = this.filtered(params);
        const sort = params.sort === 'posted' ? (job: MirrorJob) => job.postedAt ?? ''
          : params.sort === 'salary' ? (job: MirrorJob) => job.salary?.annualMax ?? job.salary?.annualMin ?? 0
          : (job: MirrorJob) => job.firstSeenAt;
        jobs.sort((a, b) => sort(a) < sort(b) ? 1 : sort(a) > sort(b) ? -1 : b.id.localeCompare(a.id));
        const offset = Number(params.cursor ?? 0);
        const size = Number(params.pageSize ?? 100);
        answer = { items: jobs.slice(offset, offset + size), pageSize: size, nextCursor: offset + size < jobs.length ? String(offset + size) : null };
      } else if (pathname === '/v1/companies') {
        const companies = [...this.companies.values()].sort((a, b) => params.sort === 'name' ? a.name.localeCompare(b.name) : b.openJobs - a.openJobs || a.id.localeCompare(b.id));
        const offset = Number(params.cursor ?? 0);
        const size = Number(params.pageSize ?? 100);
        answer = { items: companies.slice(offset, offset + size), pageSize: size, nextCursor: offset + size < companies.length ? String(offset + size) : null };
      } else if (pathname.startsWith('/v1/companies/')) {
        const company = this.companies.get(decodeURIComponent(pathname.slice('/v1/companies/'.length)));
        if (company && schema.safeParse(company).success) answer = company;
      }
      if (answer === undefined) return this.source.get(pathname, params, schema, options);
      this.answers.set(key, answer);
    }
    // A previous name-only lookup may have cached the directory record; profiles need boards too.
    if (pathname.startsWith('/v1/companies/') && !schema.safeParse(answer).success) {
      return this.source.get(pathname, params, schema, options);
    }
    return { status: 200, data: schema.parse(answer) };
  }
}
