import type { Sql } from '@cm/core/db';

/** Pin the session: builds and sweeps must never overwrite one another's commits. */
export async function withWorkerLock<T>(sql: Sql, run: (connection: Sql) => Promise<T>): Promise<T | null> {
  const connection = await sql.reserve();
  try {
    const [row] = await connection`select pg_try_advisory_lock(712903, 3) as locked`;
    if (!row?.locked) return null;
    try { return await run(sql); }
    finally { await connection`select pg_advisory_unlock(712903, 3)`; }
  } finally { connection.release(); }
}
