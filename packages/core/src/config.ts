import path from 'node:path';
import { z } from 'zod';

/**
 * The one module that reads the environment. Every service (builder, read API,
 * web app) calls loadConfig(); each takes only the fields it needs and calls the
 * matching require* helper for values that have no safe default.
 */
const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url().default('postgres://cm:cm@127.0.0.1:55432/career_market'),

  KRILL_API_URL: z.string().url().default('https://krill.kurso.sh'),
  KRILL_API_KEY: optionalString,
  KRILL_RATE_PER_MIN: z.coerce.number().int().positive().optional(),
  KRILL_CACHE_DIR: z.string().default('.cache/krill'),
  KRILL_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  WORKER_BACKFILL_PER_MIN: z.coerce.number().int().min(0).max(500).default(120),
  WORKER_SWEEP_MINUTES: z.coerce.number().int().positive().default(15),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(12),
  GROWTH_MODE: z.enum(['like-for-like', 'raw']).default('like-for-like'),
  BUILDER_POLL_MINUTES: z.coerce.number().int().positive().default(5),
  BUILDER_CLOSING_SAMPLE_PER_DAY: z.coerce.number().int().min(0).default(60),
  BUILDER_GROUPED_REFRESH_DAYS: z.coerce.number().int().min(1).default(7),
  BUILDER_SKILL_PAGES: z.coerce.number().int().min(0).default(60),
  BUILDER_COMPANY_PROFILES: z.coerce.number().int().min(0).default(100),

  READ_API_HOST: z.string().default('127.0.0.1'),
  READ_API_PORT: z.coerce.number().int().positive().default(4100),
  READ_API_URL: z.string().url().default('http://127.0.0.1:4100'),
  READ_API_TOKEN: optionalString,

  REVALIDATE_TOKEN: optionalString,
  WEB_REVALIDATE_URL: optionalString,

  CONTEXT_DEV_PUBLIC_CLIENT_ID: optionalString,
  CONTEXT_DEV_API_KEY: optionalString,
  LOGO_DAILY_CREDITS: z.coerce.number().int().min(0).default(1000),
  LOGO_DAILY_CHECKS: z.coerce.number().int().min(0).default(3000),
  LOGO_LOOKUPS_PER_RUN: z.coerce.number().int().min(0).default(100),
  LOGO_CHECKS_PER_RUN: z.coerce.number().int().min(0).default(300),
  LOGO_RECHECK_DAYS: z.coerce.number().int().positive().default(90),
  LOGO_MONOGRAM_RECHECK_DAYS: z.coerce.number().int().positive().default(7),
  LOGO_RUN_MINUTES: z.coerce.number().int().positive().default(30),
  LOGO_LOOKUP_INTERVAL_MS: z.coerce.number().int().min(0).default(500),
  LOGO_CHECK_REFERER: z.string().url().default('https://careermarket.app/'),
});

export type RawConfig = z.infer<typeof schema>;

export interface Config {
  env: RawConfig['NODE_ENV'];
  logLevel: RawConfig['LOG_LEVEL'];
  databaseUrl: string;
  krill: {
    baseUrl: string;
    apiKey: string | undefined;
    /** Requests per minute this client allows itself. */
    ratePerMinute: number;
    cacheDir: string;
    timeoutMs: number;
  };
  worker: { backfillPerMinute: number; sweepMinutes: number; concurrency: number; growthMode: 'like-for-like' | 'raw' };
  builder: {
    pollMinutes: number;
    closingSamplePerDay: number;
    groupedRefreshDays: number;
    /** How many of the largest skills get a Skill page (history, companies, pairs, latest roles). */
    skillPages: number;
    /** Companies (largest by open roles) that get a full profile: facets, board url and median age. */
    companyProfiles: number;
  };
  logos: {
    /** Server-side key for paid brand lookups; without it only the free sources run. */
    apiKey: string | undefined;
    /** Public id of the logo service; without it domains stay unverified. */
    publicClientId: string | undefined;
    dailyCredits: number;
    dailyChecks: number;
    lookupsPerRun: number;
    checksPerRun: number;
    recheckDays: number;
    monogramRecheckDays: number;
    runMinutes: number;
    lookupIntervalMs: number;
    /** The site the logo service expects checks to come from once domain restrictions are on. */
    checkReferer: string;
  };
  readApi: {
    host: string;
    port: number;
    url: string;
    token: string | undefined;
  };
  web: {
    revalidateToken: string | undefined;
    revalidateUrl: string | undefined;
    contextDevClientId: string | undefined;
  };
}

/** Krill allows 60 calls a minute per address without a key, 600 with one. Stay under both. */
const ANON_RATE = 50;
const KEYED_RATE = 500;

export function parseConfig(env: Record<string, string | undefined>, cwd = process.cwd()): Config {
  const raw = schema.parse(env);
  return {
    env: raw.NODE_ENV,
    logLevel: raw.LOG_LEVEL,
    databaseUrl: raw.DATABASE_URL,
    krill: {
      baseUrl: raw.KRILL_API_URL.replace(/\/+$/, ''),
      apiKey: raw.KRILL_API_KEY,
      ratePerMinute: Math.min(raw.KRILL_RATE_PER_MIN ?? (raw.KRILL_API_KEY ? KEYED_RATE : ANON_RATE), raw.KRILL_API_KEY ? KEYED_RATE : ANON_RATE),
      cacheDir: path.resolve(cwd, raw.KRILL_CACHE_DIR),
      timeoutMs: raw.KRILL_TIMEOUT_MS,
    },
    worker: { backfillPerMinute: raw.WORKER_BACKFILL_PER_MIN, sweepMinutes: raw.WORKER_SWEEP_MINUTES, concurrency: raw.WORKER_CONCURRENCY, growthMode: raw.GROWTH_MODE },
    builder: {
      pollMinutes: raw.BUILDER_POLL_MINUTES,
      closingSamplePerDay: raw.BUILDER_CLOSING_SAMPLE_PER_DAY,
      groupedRefreshDays: raw.BUILDER_GROUPED_REFRESH_DAYS,
      skillPages: raw.BUILDER_SKILL_PAGES,
      companyProfiles: raw.BUILDER_COMPANY_PROFILES,
    },
    logos: {
      apiKey: raw.CONTEXT_DEV_API_KEY,
      publicClientId: raw.CONTEXT_DEV_PUBLIC_CLIENT_ID,
      dailyCredits: raw.LOGO_DAILY_CREDITS,
      dailyChecks: raw.LOGO_DAILY_CHECKS,
      lookupsPerRun: raw.LOGO_LOOKUPS_PER_RUN,
      checksPerRun: raw.LOGO_CHECKS_PER_RUN,
      recheckDays: raw.LOGO_RECHECK_DAYS,
      monogramRecheckDays: raw.LOGO_MONOGRAM_RECHECK_DAYS,
      runMinutes: raw.LOGO_RUN_MINUTES,
      lookupIntervalMs: raw.LOGO_LOOKUP_INTERVAL_MS,
      checkReferer: raw.LOGO_CHECK_REFERER,
    },
    readApi: {
      host: raw.READ_API_HOST,
      port: raw.READ_API_PORT,
      url: raw.READ_API_URL.replace(/\/+$/, ''),
      token: raw.READ_API_TOKEN,
    },
    web: {
      revalidateToken: raw.REVALIDATE_TOKEN,
      revalidateUrl: raw.WEB_REVALIDATE_URL,
      contextDevClientId: raw.CONTEXT_DEV_PUBLIC_CLIENT_ID,
    },
  };
}

let cached: Config | undefined;

export function loadConfig(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}

/** The read API token has no default: both the API and the web app refuse to run without it. */
export function requireReadApiToken(config: Config): string {
  const token = config.readApi.token;
  if (!token || token.length < 16) {
    throw new Error('READ_API_TOKEN must be set (at least 16 characters)');
  }
  return token;
}
