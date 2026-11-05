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

  BUILDER_POLL_MINUTES: z.coerce.number().int().positive().default(60),
  BUILDER_CLOSING_SAMPLE_PER_DAY: z.coerce.number().int().min(0).default(60),
  BUILDER_GROUPED_REFRESH_DAYS: z.coerce.number().int().min(1).default(7),

  READ_API_HOST: z.string().default('127.0.0.1'),
  READ_API_PORT: z.coerce.number().int().positive().default(4100),
  READ_API_URL: z.string().url().default('http://127.0.0.1:4100'),
  READ_API_TOKEN: optionalString,

  REVALIDATE_TOKEN: optionalString,
  WEB_REVALIDATE_URL: optionalString,

  CONTEXT_DEV_PUBLIC_CLIENT_ID: optionalString,
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
  builder: {
    pollMinutes: number;
    closingSamplePerDay: number;
    groupedRefreshDays: number;
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
      ratePerMinute: raw.KRILL_RATE_PER_MIN ?? (raw.KRILL_API_KEY ? KEYED_RATE : ANON_RATE),
      cacheDir: path.resolve(cwd, raw.KRILL_CACHE_DIR),
      timeoutMs: raw.KRILL_TIMEOUT_MS,
    },
    builder: {
      pollMinutes: raw.BUILDER_POLL_MINUTES,
      closingSamplePerDay: raw.BUILDER_CLOSING_SAMPLE_PER_DAY,
      groupedRefreshDays: raw.BUILDER_GROUPED_REFRESH_DAYS,
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
