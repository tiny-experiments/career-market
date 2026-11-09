import { describe, expect, it, vi } from 'vitest';
import { createWatchTick, snapshotReady } from '../src/watch.ts';
import { metaSchema } from '../src/krill/schemas.ts';
import { growthRatio } from '../src/growth.ts';

const meta = (extra = {}) => metaSchema.parse({ taxonomy: { version: 1, hash: 'x' }, lastSnapshotDate: '2026-11-09',
  companies: 1, boards: 1, openJobs: 1, ats: [{ ats: 'a', openJobs: 1, enabled: true, lastRun: { date: '2026-11-09' } }], ...extra });

describe('completed snapshot trigger', () => {
  it('waits for exportedAt once supplied, and accepts a completed export', () => {
    expect(snapshotReady(meta({ exportedAt: null }))).toBe(false);
    expect(snapshotReady(meta({ exportedAt: '2026-11-08T06:00:00Z' }))).toBe(false);
    expect(snapshotReady(meta({ exportedAt: '2026-11-09T06:00:00Z' }))).toBe(true);
  });
  it('falls back to every enabled lane, ignoring disabled lanes', () => {
    expect(snapshotReady(meta())).toBe(true);
    expect(snapshotReady(meta({ ats: [{ ats: 'a', openJobs: 1, lastRun: { date: '2026-11-08' } }] }))).toBe(false);
    expect(snapshotReady(meta({ ats: [{ ats: 'a', openJobs: 1 }] }))).toBe(false);
    expect(snapshotReady(meta({ ats: [] }))).toBe(false);
    expect(snapshotReady(meta({ ats: [...meta().ats, { ats: 'b', enabled: false, openJobs: 0 }] }))).toBe(true);
    expect(snapshotReady(meta({ lastSnapshotDate: null }))).toBe(false);
  });
  it('polls every five minutes and sweeps every fifteen, even after a failed build', async () => {
    const build = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
    const sweep = vi.fn().mockResolvedValue(undefined);
    const error = vi.fn();
    const tick = createWatchTick({ build, sweep, onError: error, pollMs: 300000, sweepMs: 900000 });
    await tick(0); await tick(299999); await tick(300000); await tick(600000); await tick(900000);
    expect(build).toHaveBeenCalledTimes(4); expect(sweep).toHaveBeenCalledTimes(2); expect(error).toHaveBeenCalledTimes(1);
  });
  it('does not overlap build and sweep or concurrent ticks', async () => {
    let release!: () => void;
    const build = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const sweep = vi.fn().mockResolvedValue(undefined);
    const tick = createWatchTick({ build, sweep, onError: () => {}, pollMs: 1, sweepMs: 1 });
    const first = tick(0); await tick(10); expect(sweep).not.toHaveBeenCalled(); release(); await first;
    expect(build).toHaveBeenCalledTimes(1); expect(sweep).toHaveBeenCalledTimes(1);
  });
});

it('compares only companies present in both periods unless raw is configured', () => {
  const base = new Map([['a', 100], ['gone', 50]]);
  const now = new Map([['a', 110], ['discovered', 500]]);
  expect(growthRatio(base, now, 'like-for-like')).toBeCloseTo(0.1);
  expect(growthRatio(base, now, 'raw')).toBeCloseTo(610 / 150 - 1);
  expect(growthRatio(new Map(), now, 'like-for-like')).toBeNull();
});

it('admits backfill only between foreground ticks, after due builds and sweeps', async () => {
  const calls: string[] = [];
  const tick = createWatchTick({ pollMs: 300000, sweepMs: 900000,
    build: async () => { calls.push('build'); }, sweep: async () => { calls.push('sweep'); },
    backfill: async () => { calls.push('backfill'); }, onError: () => {},
  });
  await tick(0); await tick(500); await tick(300000); await tick(900000);
  expect(calls).toEqual(['build', 'sweep', 'backfill', 'build', 'build', 'sweep']);
});
