import { pino } from 'pino';
import { loadConfig } from '@cm/core/config';
import { createSql } from '@cm/core/db';
import { createDescriptionHydrator } from '@cm/worker/descriptions';
import { KrillApi } from '@cm/worker/krill';
import { KrillClient } from '@cm/worker/client';
import { createDatabase } from './database/client.ts';
import { createApp } from './app.ts';
import { apiConfig } from './config/config.ts';
import { createMirrorJobs } from './integrations/mirrorJobs.ts';

/** First visits to a role whose text is not stored yet; everything else reads Postgres. */
const DESCRIPTION_FETCHES_PER_MINUTE = 120;
const DESCRIPTION_TIMEOUT_MS = 4_000;

const config = loadConfig();
const log = pino({ name: 'career-market-api', level: config.logLevel });
const db = createDatabase(config.databaseUrl);
const descriptionsSql = createSql(config.databaseUrl, { max: 2 });
const descriptions = createDescriptionHydrator({
  sql: descriptionsSql,
  api: new KrillApi(
    new KrillClient({
      baseUrl: config.krill.baseUrl,
      apiKey: config.krill.apiKey,
      ratePerMinute: Math.min(
        config.krill.ratePerMinute,
        DESCRIPTION_FETCHES_PER_MINUTE,
      ),
      cacheDir: config.krill.cacheDir,
      timeoutMs: Math.min(config.krill.timeoutMs, DESCRIPTION_TIMEOUT_MS),
      concurrency: 4,
      logger: log,
    }),
  ),
});
const app = createApp({
  db,
  log,
  jobs: createMirrorJobs({ db, descriptions }),
  trustProxy: apiConfig.trustProxy,
});
const server = app.listen(config.readApi.port, config.readApi.host, () => {
  log.info(
    {
      event: 'api.listening',
      host: config.readApi.host,
      port: config.readApi.port,
    },
    'API listening',
  );
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => {
    log.error({ event: 'api.shutdown.timeout' }, 'Shutdown timed out');
    process.exit(1);
  }, 10_000).unref();
  server.close(() => {
    void Promise.all([db.destroy(), descriptionsSql.end()]).then(() => {
      clearTimeout(deadline);
      process.exit(0);
    });
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
