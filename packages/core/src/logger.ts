import { pino, type Logger } from 'pino';
import { loadConfig } from './config.ts';

export type { Logger };

export function createLogger(name: string): Logger {
  return pino({ name, level: loadConfig().logLevel });
}
