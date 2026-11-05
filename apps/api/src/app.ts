import { timingSafeEqual } from 'node:crypto';
import type { Sql } from '@cm/core/db';
import type { Logger } from '@cm/core/logger';
import { Hono } from 'hono';
import { chrome, marketOverview, NotReadyError } from './readModel.ts';

/**
 * Read-only HTTP API in front of the read model. Server-to-server only: every
 * /v1 route needs `Authorization: Bearer <READ_API_TOKEN>`. The web app calls
 * it from server components; browsers never do.
 */
export function createApp(deps: { sql: Sql; token: string; log: Logger }): Hono {
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

  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'no such route' }, 404));
  app.onError((err, c) => {
    if (err instanceof NotReadyError) return c.json({ code: 'NOT_READY', message: err.message }, 503);
    deps.log.error({ err: String(err), path: c.req.path }, 'read api error');
    return c.json({ code: 'INTERNAL', message: 'internal error' }, 500);
  });
  return app;
}
