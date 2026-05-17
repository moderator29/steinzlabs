'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useVtxStream — manages an SSE/fetch stream connection for the
 * VTX chat UI:
 *
 *   • exposes an `abort()` that the Stop button calls — cancels the
 *     in-flight fetch via AbortController so the server can shed
 *     the work and the client stops appending to the message
 *   • tracks `isStreaming` so the UI can swap Stop ↔ Send + render
 *     the StreamingCursor
 *   • exposes `start(opts)` returning a Promise that resolves once
 *     the stream completes (or rejects on abort/error)
 *   • cleans up on unmount — outstanding controllers are aborted
 *     so a navigation-away during a stream doesn't leak the fetch
 *
 * Caller supplies the URL + body + token-handling callback. Audit
 * §B.5 P1 stop generation + streaming state.
 */

export interface StartStreamOpts {
  url: string;
  body: unknown;
  /** Called for each parsed SSE event. Use `event.type` to branch on stream-start / tool / token / done / error. */
  onEvent: (event: { type: string; data: unknown }) => void;
  /** Optional extra headers. */
  headers?: Record<string, string>;
}

export function useVtxStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
  }, []);

  useEffect(() => () => abort(), [abort]);

  const start = useCallback(async (opts: StartStreamOpts): Promise<void> => {
    abort(); // cancel any prior stream so we never have two open at once
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    setIsStreaming(true);
    try {
      const res = await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
        body: JSON.stringify(opts.body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`stream ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf('\n\n');
        while (idx >= 0) {
          const chunk = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (chunk) {
            const lines = chunk.split('\n');
            let eventName = 'message';
            let data = '';
            for (const line of lines) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (data) {
              try {
                opts.onEvent({ type: eventName, data: JSON.parse(data) });
              } catch {
                opts.onEvent({ type: eventName, data });
              }
            }
          }
          idx = buffer.indexOf('\n\n');
        }
      }
    } finally {
      if (controllerRef.current === ctrl) controllerRef.current = null;
      setIsStreaming(false);
    }
  }, [abort]);

  return { isStreaming, start, abort } as const;
}
