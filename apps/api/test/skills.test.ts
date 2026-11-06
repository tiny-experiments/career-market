import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { Sql } from '@cm/core/db';
import { createApp } from '../src/app.ts';

const token = 'test-token-0123456789';
const failingSql = (() => {
  throw new Error('database not used in this test');
}) as unknown as Sql;
const app = createApp({ sql: failingSql, token, log: pino({ level: 'silent' }) });
const auth = { headers: { authorization: `Bearer ${token}` } };

describe('skill routes', () => {
  it('need the bearer token', async () => {
    expect((await app.request('/v1/skills')).status).toBe(401);
    expect((await app.request('/v1/skills/pytorch')).status).toBe(401);
  });

  it('answer 404 for a slug that cannot name a skill, without touching the database', async () => {
    for (const slug of ['..%2Fetc', 'a%20b', 'x'.repeat(80), '%25']) {
      const res = await app.request(`/v1/skills/${slug}`, auth);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ code: 'NOT_FOUND', message: 'no such skill page' });
    }
  });

  it('answer 500 without leaking the error when the read model fails', async () => {
    const res = await app.request('/v1/skills/pytorch', auth);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: 'INTERNAL', message: 'internal error' });
  });
});
