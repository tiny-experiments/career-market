import { loadConfig } from '@cm/core/config';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import type { Hono } from 'hono';
import { companyDirectory, companyIdOf, companyPage } from './companyModel.ts';
import { COUNTRY_RE, createCompanyJobs, FAMILY_RE } from './companyJobs.ts';

/** Company routes: the directory, one company's page and its live role list. */
export function registerCompanyRoutes(app: Hono, deps: { sql: Sql; log: Logger }): void {
  const { krill } = loadConfig();
  const jobs = createCompanyJobs({ baseUrl: krill.baseUrl, apiKey: krill.apiKey, log: deps.log });

  app.get('/v1/companies', async (c) => c.json(await companyDirectory(deps.sql, 100)));

  app.get('/v1/companies/:slug', async (c) => {
    const page = await companyPage(deps.sql, c.req.param('slug'));
    return page ? c.json(page) : c.json({ code: 'NOT_FOUND', message: 'no such company' }, 404);
  });

  app.get('/v1/companies/:slug/jobs', async (c) => {
    const id = await companyIdOf(deps.sql, c.req.param('slug'));
    if (!id) return c.json({ code: 'NOT_FOUND', message: 'no such company' }, 404);
    const profession = c.req.query('profession');
    const country = c.req.query('country');
    if ((profession && !FAMILY_RE.test(profession)) || (country && !COUNTRY_RE.test(country))) {
      return c.json({ code: 'BAD_REQUEST', message: 'unknown profession or country filter' }, 400);
    }
    const limit = Math.min(25, Math.max(1, Number(c.req.query('limit') ?? 8) || 8));
    return c.json(await jobs(id, { profession, country, remote: c.req.query('remote') === '1', limit }));
  });
}
