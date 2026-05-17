/**
 * Notification batcher — debounces a high-frequency stream of alert
 * triggers into per-user windowed batches so a whale that buys 30
 * tokens in 60 seconds doesn't spam the user with 30 separate
 * Telegram + email notifications.
 *
 * Configured with:
 *   • window     debounce window in seconds (default 60)
 *   • maxQueue   safety cap so a runaway producer can't grow the
 *                buffer indefinitely (default 200 per user)
 *
 * Pure data structure — caller is responsible for calling flush()
 * on a schedule (cron / setInterval) and shipping the batched
 * payload to the delivery layer.
 *
 * Audit §B.6 notifications cadence + §B.2 sniper signal grouping.
 */

export interface BatchItem<T> {
  /** UNIX seconds when the item entered the batcher. */
  enqueuedAt: number;
  payload: T;
}

export class NotificationBatcher<T> {
  private buckets = new Map<string, BatchItem<T>[]>();

  constructor(
    private readonly windowSeconds: number = 60,
    private readonly maxQueue: number = 200,
  ) {}

  /**
   * Enqueue an item for the given user/channel key. Caps the
   * per-bucket queue at maxQueue — overflow items are silently
   * dropped (logged at the call site if desired).
   */
  push(key: string, payload: T, now: number = Math.floor(Date.now() / 1000)): boolean {
    const bucket = this.buckets.get(key) ?? [];
    if (bucket.length >= this.maxQueue) return false;
    bucket.push({ enqueuedAt: now, payload });
    this.buckets.set(key, bucket);
    return true;
  }

  /**
   * Return + clear all buckets whose oldest item is older than the
   * debounce window. Younger buckets stay in the batcher so a fresh
   * push doesn't immediately re-fire while events are still arriving.
   */
  flushReady(now: number = Math.floor(Date.now() / 1000)): Array<{ key: string; items: BatchItem<T>[] }> {
    const cutoff = now - this.windowSeconds;
    const out: Array<{ key: string; items: BatchItem<T>[] }> = [];
    for (const [key, items] of this.buckets) {
      if (items.length === 0) continue;
      const oldest = items[0].enqueuedAt;
      if (oldest <= cutoff) {
        out.push({ key, items });
        this.buckets.delete(key);
      }
    }
    return out;
  }

  /**
   * Force-flush every bucket regardless of age. Useful when a worker
   * is shutting down or the user explicitly hits 'send digest now'.
   */
  flushAll(): Array<{ key: string; items: BatchItem<T>[] }> {
    const out: Array<{ key: string; items: BatchItem<T>[] }> = [];
    for (const [key, items] of this.buckets) {
      if (items.length > 0) out.push({ key, items });
    }
    this.buckets.clear();
    return out;
  }

  size(): number {
    let total = 0;
    for (const items of this.buckets.values()) total += items.length;
    return total;
  }
}
