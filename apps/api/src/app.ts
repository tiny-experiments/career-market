import { timingSafeEqual } from 'node:crypto';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import { Hono } from 'hono';
import { registerCompanyRoutes } from './companyRoutes.ts';
import { parseScreenerQuery } from '@cm/core/screener';
import { KrillLive } from './krillLive.ts';
import { chrome, marketOverview, NotReadyError } from './readModel.ts';
import { screener } from './screener.ts';
import { MAX_QUERY_LENGTH, search, searchRoles } from './search.ts';

/**
 * Read-only HTTP API in front of the read model. Server-to-server only: every
 * /v1 route needs `Authorization: Bearer <READ_API_TOKEN>`. The web app calls
 * it from server components; browsers never do.
 */
export function createApp(deps: { sql: Sql; token: string; log: Logger; live?: KrillLive }): Hono {
  const live = deps.live ?? new KrillLive({ baseUrl: 'https://krill.kurso.sh', log: deps.log });
  const app = new Hono();
  const expected = Buffer.from(deps.token);

  app.get('/health', async (c) => {
    try {
      await deps.sql`select 1`;
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  app.use('/v1/*', async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return c.json({ code: 'UNAUTHORIZED', message: 'missing or wrong bearer token' }, 401);
    }
    await next();
  });

  app.get('/v1/chrome', async (c) => c.json(await chrome(deps.sql)));
  app.get('/v1/market', async (c) => c.json(await marketOverview(deps.sql)));
  registerCompanyRoutes(app, deps);

  // Screener: the read model, plus krill live for filtered counts and the matching roles (cached 1 h).
  app.get('/v1/screener', async (c) => c.json(await screener(deps.sql, live, parseScreenerQuery(new URL(c.req.url).searchParams))));

  // Typeahead (professions, companies, skills) and, with roles=1, the roles of the full search page.
  app.get('/v1/search', async (c) => {
    const q = (c.req.query('q') ?? '').slice(0, MAX_QUERY_LENGTH * 2);
    const limit = Math.min(10, Math.max(1, Number(c.req.query('limit')) || 5));
    const results = await search(deps.sql, live, q, limit);
    if (c.req.query('roles') !== '1') return c.json({ ...results, roles: [] });
    const roles = await searchRoles(deps.sql, live, q, 8).catch(() => null);
    return c.json({ ...results, roles: roles ?? [], rolesUnavailable: roles === null });
  });

  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'no such route' }, 404));
  app.onError((err, c) => {
    if (err instanceof NotReadyError) return c.json({ code: 'NOT_READY', message: err.message }, 503);
    deps.log.error({ err: String(err), path: c.req.path }, 'read api error');
    return c.json({ code: 'INTERNAL', message: 'internal error' }, 500);
  });
  return app;
}
