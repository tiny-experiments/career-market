import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { sql } from 'kysely';
import { createQueries, type Database } from './database/client.ts';
import { AppError, notFound, originNotAllowed } from './http/errors.ts';
import { createMarketServices } from './modules/market/services/index.ts';
import { marketRoutes } from './modules/market/routes/marketRoutes.ts';
import { createMetaServices } from './modules/meta/services/index.ts';
import { metaRoutes } from './modules/meta/routes/metaRoutes.ts';
import { createProfessionsServices } from './modules/professions/services/index.ts';
import { professionsRoutes } from './modules/professions/routes/professionsRoutes.ts';
import { createCompaniesServices } from './modules/companies/services/index.ts';
import { companiesRoutes } from './modules/companies/routes/companiesRoutes.ts';
import { createSkillsServices } from './modules/skills/services/index.ts';
import { skillsRoutes } from './modules/skills/routes/skillsRoutes.ts';
import { createJobsServices } from './modules/jobs/services/index.ts';
import { jobsRoutes } from './modules/jobs/routes/jobsRoutes.ts';
import type { JobsRepository } from './modules/jobs/domain.ts';
import { createSearchServices } from './modules/search/services/index.ts';
import { searchRoutes } from './modules/search/routes/searchRoutes.ts';

export interface AppDependencies {
  db: Database;
  log: Logger;
  jobs: JobsRepository;
  /** Set to the exact proxy hop count/subnets when deployed behind the VPS proxy. */
  trustProxy?: number | string;
  previewOriginPattern?: RegExp;
  rateLimit?: { limit: number; windowMs: number };
}

export function allowedOrigin(origin: string, preview?: RegExp): boolean {
  if (
    origin === 'https://careermarket.app' ||
    origin === 'https://www.careermarket.app'
  )
    return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  if (
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    url.port !== ''
  )
    return true;
  // Project-specific pattern can further restrict the public preview allow-list.
  return (
    url.protocol === 'https:' &&
    /^[a-z0-9-]+\.vercel\.app$/.test(url.hostname) &&
    (!preview || preview.test(origin))
  );
}

export function createApp(deps: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.trustProxy ?? false);
  app.set('query parser', 'simple');
  app.use(
    pinoHttp({
      logger: deps.log,
      autoLogging: true,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(
          !origin || allowedOrigin(origin, deps.previewOriginPattern)
            ? null
            : originNotAllowed(),
          true,
        ),
      methods: ['GET', 'HEAD', 'OPTIONS'],
      maxAge: 86400,
      exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
    }),
  );
  app.get('/health', async (_req, res) => {
    try {
      await sql`select 1`.execute(deps.db);
      res.set('Cache-Control', 'no-store').json({ ok: true });
    } catch {
      res.set('Cache-Control', 'no-store').status(503).json({ ok: false });
    }
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: deps.rateLimit?.windowMs ?? 60_000,
      limit: deps.rateLimit?.limit ?? 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => {
        res
          .set('Cache-Control', 'no-store')
          .status(429)
          .json({
            message: 'Too many requests. Try again shortly.',
            code: 'RATE_LIMITED',
          });
      },
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    );
    next();
  });
  const queries = createQueries(deps.db);
  const jobs = createJobsServices({ queries, jobs: deps.jobs });
  const companies = createCompaniesServices({
    db: deps.db,
    queries,
    listJobs: jobs.list,
  });
  app.use(
    '/api/market',
    marketRoutes(createMarketServices({ queries, companies })),
  );
  app.use('/api/meta', metaRoutes(createMetaServices({ queries })));
  app.use(
    '/api/professions',
    professionsRoutes(createProfessionsServices({ queries })),
  );
  app.use('/api/companies', companiesRoutes(companies));
  app.use('/api/skills', skillsRoutes(createSkillsServices({ queries })));
  app.use('/api/jobs', jobsRoutes(jobs));
  app.use(
    '/api/search',
    searchRoutes(createSearchServices({ queries, listJobs: jobs.list })),
  );
  app.use((_req, _res, next) => next(notFound()));
  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    req,
    res,
    _next,
  ) => {
    const failure =
      error instanceof AppError
        ? error
        : new AppError(500, 'INTERNAL', 'Internal server error');
    if (failure.status >= 500)
      deps.log.error(
        { err: error, path: req.path, event: 'api.request.failed' },
        failure.message,
      );
    res
      .set('Cache-Control', 'no-store')
      .status(failure.status)
      .json({
        message: failure.message,
        code: failure.code,
        ...failure.details,
      });
  };
  app.use(errorHandler);
  return app;
}
