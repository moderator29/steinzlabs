/**
 * Bounded-concurrency parallel map. Runs at most `limit` workers at once and
 * returns all settled results in input order — failures don't abort siblings.
 *
 * Used on cron fan-outs (copy-trade match, alert delivery, sniper sweep) where
 * sequential awaits add up to a maxDuration overrun but unbounded
 * Promise.allSettled would hammer downstream APIs.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runner(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const value = await worker(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const runners: Promise<void>[] = [];
  for (let i = 0; i < effectiveLimit; i++) runners.push(runner());
  await Promise.all(runners);
  return results;
}
