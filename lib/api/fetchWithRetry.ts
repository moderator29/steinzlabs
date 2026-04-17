import * as Sentry from "@sentry/nextjs";

export interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
  source?: string;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 8000,
    backoffMs = 500,
    source = "unknown",
    ...init
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) return response;
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status} from ${source}`);
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        }
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
      }
    }
  }
  Sentry.captureException(lastError, { tags: { source, url } });
  throw lastError ?? new Error(`Failed after ${retries} retries: ${url}`);
}
