import { pino } from 'pino';
import { KrillApi } from '../src/krill/api.ts';
import { KrillClient } from '../src/krill/client.ts';
import type { MirrorJob } from '../src/mirror.ts';

export const job = (id = 'j1', extra: Partial<MirrorJob> = {}): MirrorJob => ({
  id, status: 'open', title: 'Software Engineer', company: { id: 'c1', name: 'Acme' }, url: 'https://example.com/job', applyUrl: null,
  employmentType: 'full-time', workMode: 'remote', locations: ['London'], places: [{ label: 'London', countryCode: 'GB' }],
  salary: { min: 100, max: 200, currency: 'GBP', period: 'year', annualMin: 100, annualMax: 200 },
  postedAt: '2026-11-09T00:00:00Z', openedAt: '2026-11-09', openedSource: 'posted', firstSeenAt: '2026-11-09', lastSeenAt: '2026-11-09',
  family: 'software-engineering', specialty: 'backend', level: 'senior', skills: ['lang:typescript'], languages: [], tools: [],
  ageDays: 1, repostCount: 2, staleScore: 0.4, description: 'Build useful software.', ...extra,
});
export const apiWith = (handler: (url: URL) => unknown) => new KrillApi(new KrillClient({
  baseUrl: 'https://source.test', ratePerMinute: 500, timeoutMs: 1000, sleep: async () => {}, logger: pino({ level: 'silent' }),
  fetchImpl: (async (input) => new Response(JSON.stringify(handler(new URL(String(input)))))) as typeof fetch,
}));
