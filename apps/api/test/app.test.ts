import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { Sql } from '@cm/core/db';
import { createApp } from '../src/app.ts';

const token = 'test-token-0123456789';
const failingSql = (() => {
  throw new Error('database not used in this test');
}) as unknown as Sql;
const app = createApp({ sql: failingSql, token, log: pino({ level: 'silent' }) });

describe('read API auth', () => {
  it('rejects /v1 calls without the bearer token', async () => {
    const res = await app.request('/v1/market');
    expect(res.status).toBe(401);
  });

  it('rejects a wrong token of the same length', async () => {
    const res = await app.request('/v1/market', { headers: { authorization: `Bearer ${'x'.repeat(token.length)}` } });
    expect(res.status).toBe(401);
  });

  it('passes the right token to the route', async () => {
    const res = await app.request('/v1/nothing-here', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(404);
  });

  it('answers 500 without leaking the error when the read model fails', async () => {
    const res = await app.request('/v1/market', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: 'INTERNAL', message: 'internal error' });
  });
});
