import { pino } from 'pino';
import { loadConfig } from '@cm/core/config';
import { createDatabase } from './database/client.ts';
import { createApp } from './app.ts';
import { apiConfig } from './config/config.ts';
import { KrillLive } from './integrations/krillLive.ts';
import { createUpstreamJobs } from './integrations/upstreamJobs.ts';

const config = loadConfig();
const log = pino({ name: 'career-market-api', level: config.logLevel });
const db = createDatabase(config.databaseUrl);
const live = new KrillLive({ ...config.krill, log, ttlMs: 300_000 });
const app = createApp({
  db,
  log,
  jobs: createUpstreamJobs(live),
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
    void db.destroy().then(() => {
      clearTimeout(deadline);
      process.exit(0);
    });
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
