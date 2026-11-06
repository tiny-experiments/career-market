import { serve } from '@hono/node-server';
import { loadConfig, requireReadApiToken } from '@cm/core/config';
import { createSql } from '@cm/core/db';
import { createLogger } from '@cm/core/logger';
import { createApp } from './app.ts';
import { KrillLive } from './krillLive.ts';

const config = loadConfig();
const log = createLogger('read-api');
const sql = createSql(config.databaseUrl, { max: 10 });
const live = new KrillLive({ baseUrl: config.krill.baseUrl, apiKey: config.krill.apiKey, log });
const app = createApp({ sql, token: requireReadApiToken(config), log, live });

const server = serve({ fetch: app.fetch, hostname: config.readApi.host, port: config.readApi.port }, (info) => {
  log.info({ host: info.address, port: info.port }, 'read api listening');
});

const shutdown = () => {
  server.close();
  void sql.end({ timeout: 5 }).then(() => process.exit(0));
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
