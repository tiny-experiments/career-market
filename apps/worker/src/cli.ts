import { createDescriptionBackfill, createDescriptionHydrator } from './descriptions.ts';
import { createWatchTick } from './watch.ts';
import { sweepChanges } from './mirror.ts';
import { loadConfig } from '@cm/core/config';
import { createSql } from '@cm/core/db';
import { createLogger } from '@cm/core/logger';
import { migrate } from '@cm/core/migrate';
import { runBuild } from './build.ts';
import { KrillApi } from './krill/api.ts';
import { KrillClient } from './krill/client.ts';
import { createBrandSearch, createLogoProbe } from './logos/contextDev.ts';
import { resolveCompanyDomains, type LogoDeps } from './logos/resolve.ts';

const USAGE = `career-market worker

  migrate              apply SQL migrations to DATABASE_URL
  build [--force] [--full]
                       build the read model for krill's latest snapshot day
                       --force  rebuild a day that was already built
                       --full   refetch every grouped day since 2026-11-02
  sweep                apply the persisted change feed cursor
  logos [--limit N]    resolve company website domains for logos; N caps paid
                       lookups in this run (the daily budget still applies)
  watch                poll krill /v1/meta every BUILDER_POLL_MINUTES and
                       build each new snapshot day`;

async function main(argv: string[]): Promise<number> {
  const [command, ...flags] = argv;
  const config = loadConfig();
  const log = createLogger('worker');
  if (!command || command === '--help' || command === 'help') {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  const sql = createSql(config.databaseUrl);
  try {
    const applied = await migrate(sql);
    if (applied.length) log.info({ applied }, 'migrations applied');
    if (command === 'migrate') return 0;

    const api = new KrillApi(
      new KrillClient({
        baseUrl: config.krill.baseUrl,
        apiKey: config.krill.apiKey,
        ratePerMinute: config.krill.ratePerMinute,
        cacheDir: config.krill.cacheDir,
        timeoutMs: config.krill.timeoutMs,
        concurrency: config.worker.concurrency,
        logger: log,
      }),
    );

    const logoDeps = (lookupsPerRun = config.logos.lookupsPerRun): LogoDeps => ({
      sql,
      log,
      settings: { ...config.logos, lookupsPerRun, checksPerRun: Math.max(config.logos.checksPerRun, lookupsPerRun) },
      brandSearch: config.logos.apiKey ? createBrandSearch(config.logos.apiKey) : undefined,
      logoProbe: config.logos.publicClientId ? createLogoProbe(config.logos.publicClientId, config.logos.checkReferer) : undefined,
    });

    if (command === 'logos') {
      const at = flags.indexOf('--limit');
      const limit = at >= 0 ? Number(flags[at + 1]) : undefined;
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) throw new Error('--limit needs a whole number');
      await resolveCompanyDomains(logoDeps(limit));
      return 0;
    }

    if (command === 'build') {
      const result = await runBuild({ sql, api, config, log }, { force: flags.includes('--force'), full: flags.includes('--full') });
      log.info(result.status === 'skipped' ? result : { status: result.status, snapshotDate: result.snapshotDate }, 'done');
      return 0;
    }

    if (command === 'sweep') {
      log.info(await sweepChanges(sql, api), 'change sweep finished');
      return 0;
    }

    if (command === 'watch') {
      const intervalMs = config.builder.pollMinutes * 60_000;
      let stopping = false;
      const stop = () => {
        stopping = true;
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      log.info({ pollMinutes: config.builder.pollMinutes }, 'watching krill for new snapshot days');
      const backfill = createDescriptionBackfill({ sql, hydrator: createDescriptionHydrator({ sql, api }),
        ratePerMinute: config.worker.backfillPerMinute,
        onError: (err) => log.warn({ err: String(err) }, 'description deferred for retry'),
      });
      const tick = createWatchTick({
        backfill,
        pollMs: intervalMs, sweepMs: config.worker.sweepMinutes * 60_000,
        build: () => runBuild({ sql, api, config, log }),
        sweep: () => sweepChanges(sql, api),
        logos: () => resolveCompanyDomains(logoDeps()),
        logosMs: config.logos.runMinutes * 60_000,
        onError: (err) => log.error({ err: String(err) }, 'worker tick failed; retrying at next interval'),
      });
      while (!stopping) {
        await tick(Date.now());
        if (!stopping) await new Promise((resolve) => setTimeout(resolve, config.worker.backfillPerMinute ? Math.min(1_000, Math.ceil(60_000 / config.worker.backfillPerMinute)) : 1_000));
      }
      return 0;
    }

    console.error(`unknown command: ${command}\n\n${USAGE}`);
    return 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
