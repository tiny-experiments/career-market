import type { KrillMeta } from './krill/schemas.ts';

/** exportedAt belongs to the advertised snapshot. Until deployed, require all enabled lanes to finish. */
export function snapshotReady(meta: KrillMeta): boolean {
  if (!meta.lastSnapshotDate) return false;
  if (meta.exportedAt !== undefined) {
    return meta.exportedAt !== null && meta.exportedAt.slice(0, 10) >= meta.lastSnapshotDate;
  }
  const enabled = meta.ats.filter((a) => a.enabled !== false);
  return enabled.length > 0 && enabled.every((a) => a.lastRun?.date === meta.lastSnapshotDate);
}

/** Serializes build and sweep; independent deadlines keep sweeps alive after build failures. */
export function createWatchTick(deps: {
  build: () => Promise<unknown>;
  sweep: () => Promise<unknown>;
  onError: (error: unknown) => void;
  pollMs: number;
  sweepMs: number;
}) {
  let nextBuild = 0;
  let nextSweep = 0;
  let running = false;
  return async (now: number): Promise<void> => {
    if (running) return;
    running = true;
    try {
      if (now >= nextBuild) {
        nextBuild = now + deps.pollMs;
        try { await deps.build(); } catch (error) { deps.onError(error); }
      }
      if (now >= nextSweep) {
        nextSweep = now + deps.sweepMs;
        try { await deps.sweep(); } catch (error) { deps.onError(error); }
      }
    } finally { running = false; }
  };
}
