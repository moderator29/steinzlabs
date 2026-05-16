import 'server-only';

/**
 * Retry wrapper around fetch for external APIs. Handles the three
 * recoverable failures we actually see in prod:
 *   • 429 Too Many Requests   — Alchemy / Helius / GoPlus / CoinGecko all
 *                                throttle; backoff respects Retry-After.
 *   • 5xx                     — transient upstream; exponential backoff.
 *   • Network reset / timeout — abort signal or fetch throw.
 *
 * 4xx other than 429 are NOT retried — they're caller bugs (bad params,
 * missing auth) and retrying just burns rate limit.
 *
 * Caller controls total attempts (default 3) and a per-attempt timeout
 * via AbortSignal. The exponential base is 250ms × 2^attempt, capped at
 * 4s. When the response carries Retry-After (seconds or HTTP-date), we
 * honor it instead of our backoff.
 *
 * §5.11 — replaces ad-hoc try/setTimeout patterns scattered across
 * 12 different service files.
 */

export interface RetryFetchOptions {
  retries?: number;
  timeoutMs?: number;
  /** Status codes to retry on top of the default 429 + 5xx set. */
  retryStatuses?: ReadonlySet<number>;
}

const DEFAULT_RETRYABLE: ReadonlySet<number> = new Set([408, 425, 429, 500, 502, 503, 504]);

function backoffMs(attempt: number): number {
  return Math.min(4_000, 250 * 2 ** attempt) + Math.random() * 100;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const asSeconds = Number(value);
  if (Number.isFinite(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryFetch(
  url: string | URL,
  init: RequestInit & RetryFetchOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 15_000,
    retryStatuses,
    ...fetchInit
  } = init;
  const retryable: ReadonlySet<number> = retryStatuses ?? DEFAULT_RETRYABLE;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    // Compose the caller's signal with the internal timeout signal.
    const signal = fetchInit.signal
      ? anySignal([fetchInit.signal, ctrl.signal])
      : ctrl.signal;
    try {
      const res = await fetch(url, { ...fetchInit, signal });
      clearTimeout(timer);
      if (!retryable.has(res.status) || attempt === retries) {
        return res;
      }
      const ra = parseRetryAfter(res.headers.get('retry-after'));
      await sleep(ra ?? backoffMs(attempt));
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt === retries) throw err;
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      if (aborted && fetchInit.signal?.aborted) throw err;
      await sleep(backoffMs(attempt));
    }
  }
  throw lastErr ?? new Error('retryFetch exhausted with no error captured');
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  const onAbort = (reason: unknown) => ctrl.abort(reason);
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort((s as AbortSignal & { reason?: unknown }).reason);
      break;
    }
    s.addEventListener('abort', () => onAbort((s as AbortSignal & { reason?: unknown }).reason), { once: true });
  }
  return ctrl.signal;
}
