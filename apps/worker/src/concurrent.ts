/** Bounded work, preserving result order. All callers share the client's rate gate. */
export async function concurrentMap<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>, limit = 12): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const outcomes = await Promise.allSettled(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  }));
  const failure = outcomes.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return results;
}

export async function allResults<T extends readonly unknown[]>(promises: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
  const results = await Promise.allSettled(promises);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return results.map((result) => (result as PromiseFulfilledResult<unknown>).value) as unknown as T;
}
