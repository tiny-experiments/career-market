import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { KrillLive, KrillLiveError } from '../src/krillLive.ts';

const log = pino({ level: 'silent' });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const company = { id: 'co_1', name: 'Apple', domain: 'apple.com', openJobs: 3288 };

function make(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof KrillLive>[0]> = {}) {
  let t = 1_000_000;
  const sleeps: number[] = [];
  const live = new KrillLive({
    baseUrl: 'https://krill.test',
    ratePerMinute: 600,
    timeoutMs: 1000,
    log,
    fetchImpl,
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    ...extra,
  });
  return { live, sleeps, advance: (ms: number) => (t += ms) };
}

describe('KrillLive', () => {
  it('caches an answer for an hour and shares one call between identical requests in flight', async () => {
    const fetchImpl = vi.fn(async () => json(company));
    const { live, advance } = make(fetchImpl as unknown as typeof fetch);
    const [a, b] = await Promise.all([live.company('co_1'), live.company('co_1')]);
    expect(a).toEqual(company);
    expect(b).toEqual(company);
    await live.company('co_1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    advance(3_600_001);
    await live.company('co_1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('answers a missing job and a closed job without throwing', async () => {
    const tomb = { id: 'kr_abc12345', status: 'closed', closedAt: '2026-11-05', openedAt: '2026-10-01', openedSource: 'posted', family: 'ai-ml' };
    const responses = [json({ code: 'NOT_FOUND' }, 404), json(tomb, 410), json({ code: 'VALIDATION_FAILED' }, 400)];
    const { live } = make((async () => responses.shift()) as unknown as typeof fetch);
    expect(await live.job('kr_missing1')).toEqual({ kind: 'missing' });
    expect(await live.job('kr_abc12345')).toEqual({ kind: 'closed', tombstone: tomb });
    expect(await live.job('kr_short')).toEqual({ kind: 'missing' });
  });

  it('retries a 429 after the time krill asks for, then succeeds', async () => {
    const responses = [json({ code: 'RATE_LIMITED' }, 429, { 'retry-after': '3' }), json(company)];
    const { live, sleeps } = make((async () => responses.shift()) as unknown as typeof fetch);
    expect(await live.company('co_1')).toEqual(company);
    expect(sleeps.some((ms) => ms >= 3000)).toBe(true);
  });

  it('throws a KrillLiveError when krill keeps failing, and serves the last good answer once it is stale', async () => {
    let healthy = true;
    const fetchImpl = (async () => (healthy ? json(company) : json({ code: 'X' }, 500))) as unknown as typeof fetch;
    const { live, advance } = make(fetchImpl);
    await live.company('co_1');
    healthy = false;
    advance(3_700_000);
    expect(await live.company('co_1')).toEqual(company);

    const down = make((async () => json({ code: 'X' }, 500)) as unknown as typeof fetch);
    await expect(down.live.company('co_2')).rejects.toBeInstanceOf(KrillLiveError);
  });

  it('rejects an answer that does not match the schema', async () => {
    const { live } = make((async () => json({ id: 'co_1' })) as unknown as typeof fetch);
    await expect(live.company('co_1')).rejects.toThrow(/unexpected shape/);
  });

  it('paces calls under the per-minute limit', async () => {
    const { live, sleeps } = make((async () => json(company)) as unknown as typeof fetch, { ratePerMinute: 60 });
    await live.company('co_a');
    await live.company('co_b');
    expect(sleeps.some((ms) => ms > 0 && ms <= 1000)).toBe(true);
  });

  it('refuses to queue a call more than 15 s behind the pacing, without reserving a slot for it', async () => {
    const fetchImpl = vi.fn(async () => json(company));
    const sleeps: number[] = [];
    const { live, advance } = make(fetchImpl as unknown as typeof fetch, {
      ratePerMinute: 60,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => live.company(`co_${i}`)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(16);
    expect(refused).toHaveLength(4);
    for (const r of refused) expect((r as PromiseRejectedResult).reason).toBeInstanceOf(KrillLiveError);
    expect(fetchImpl).toHaveBeenCalledTimes(16);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(15_000);

    advance(16_000);
    await live.company('co_after');
    expect(fetchImpl).toHaveBeenCalledTimes(17);
  });
});
