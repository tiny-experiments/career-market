import { expect, it } from 'vitest';
import { parseConfig } from '../src/config.ts';

it('defaults to a five-minute watch and fifteen-minute sweep with like-for-like growth', () => {
  const config = parseConfig({});
  expect(config.builder.pollMinutes).toBe(5);
  expect(config.worker).toEqual({ backfillPerMinute: 120, sweepMinutes: 15, concurrency: 12, growthMode: 'like-for-like' });
  expect(config.krill.ratePerMinute).toBe(50);
});
it('caps keyed and anonymous request rates and allows slower pacing', () => {
  expect(parseConfig({ KRILL_API_KEY: 'test', KRILL_RATE_PER_MIN: '1000' }).krill.ratePerMinute).toBe(500);
  expect(parseConfig({ KRILL_RATE_PER_MIN: '1000' }).krill.ratePerMinute).toBe(50);
  expect(parseConfig({ KRILL_API_KEY: 'test', KRILL_RATE_PER_MIN: '100' }).krill.ratePerMinute).toBe(100);
});
it('can switch headline growth to raw without a code change', () => {
  expect(parseConfig({ GROWTH_MODE: 'raw' }).worker.growthMode).toBe('raw');
});
