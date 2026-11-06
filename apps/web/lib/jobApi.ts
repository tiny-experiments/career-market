import 'server-only';
import { loadConfig, requireReadApiToken } from '@cm/core/config';
import type { ClosedJobPayload, JobPagePayload } from '@cm/core/job';
import { READ_MODEL_TAG } from './readApi';

/**
 * One posting from the read API. 410 is a normal answer here (the role closed),
 * so it does not go through the shared `get` helper. Cached for an hour like
 * every read API response; the builder's refresh expires it.
 */
export type JobResult =
  | { kind: 'open'; payload: JobPagePayload }
  | { kind: 'closed'; payload: ClosedJobPayload }
  | { kind: 'missing' }
  | { kind: 'error'; status: number | null };

const JOB_FETCH_TIMEOUT_MS = 20_000;
const DEGRADED_REVALIDATE_SECONDS = 60;

export async function getJob(id: string): Promise<JobResult> {
  const result = await fetchJob(id, 3600, '');
  if (result.kind !== 'open' || !result.payload.degraded) return result;
  const retry = await fetchJob(id, DEGRADED_REVALIDATE_SECONDS, `?retry=${Math.floor(Date.now() / (DEGRADED_REVALIDATE_SECONDS * 1000))}`);
  return retry.kind === 'open' ? retry : result;
}

async function fetchJob(id: string, revalidate: number, query: string): Promise<JobResult> {
  const config = loadConfig();
  let res: Response;
  try {
    res = await fetch(`${config.readApi.url}/v1/jobs/${encodeURIComponent(id)}${query}`, {
      headers: { authorization: `Bearer ${requireReadApiToken(config)}`, accept: 'application/json' },
      signal: AbortSignal.timeout(JOB_FETCH_TIMEOUT_MS),
      next: { revalidate, tags: [READ_MODEL_TAG] },
    });
  } catch {
    return { kind: 'error', status: null };
  }
  if (res.status === 404) return { kind: 'missing' };
  if (res.status === 410) return { kind: 'closed', payload: (await res.json()) as ClosedJobPayload };
  if (!res.ok) return { kind: 'error', status: res.status };
  return { kind: 'open', payload: (await res.json()) as JobPagePayload };
}
