import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@cm/core/config', () => ({
  loadConfig: () => ({ readApi: { url: 'http://read-api.test' } }),
  requireReadApiToken: () => 'token',
}));

import { getJob } from '../lib/jobApi.ts';

const open = (degraded: boolean) => ({ status: 'open', asOf: '2026-11-06', degraded, job: { id: 'kr_x' }, context: {} });
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

type Init = { next?: { revalidate?: number } };

afterEach(() => vi.unstubAllGlobals());

describe('getJob', () => {
  it('caches a complete page for an hour with a single fetch', async () => {
    const fetchMock = vi.fn(async () => reply(open(false)));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getJob('kr_x');
    expect(result.kind).toBe('open');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string, Init])[1].next?.revalidate).toBe(3600);
  });

  it('refetches a degraded page with a 60 s revalidate and returns the fresher answer', async () => {
    const answers = [open(true), open(false)];
    const fetchMock = vi.fn(async () => reply(answers.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getJob('kr_x');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, Init];
    expect(url).toMatch(/\/v1\/jobs\/kr_x\?retry=\d+$/);
    expect(init.next?.revalidate).toBe(60);
    expect(result).toMatchObject({ kind: 'open', payload: { degraded: false } });
  });

  it('keeps the degraded page when the short refetch fails', async () => {
    const answers = [reply(open(true)), new Response('{}', { status: 502 })];
    vi.stubGlobal('fetch', vi.fn(async () => answers.shift()));
    expect(await getJob('kr_x')).toMatchObject({ kind: 'open', payload: { degraded: true } });
  });
});
