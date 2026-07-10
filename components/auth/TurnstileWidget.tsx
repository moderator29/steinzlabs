'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  /** Visual theme — default 'light' so the widget stands out clearly against
   *  the dark auth surfaces (a dark widget blends in and reads as invisible). */
  theme?: 'dark' | 'light' | 'auto';
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
  ready: (cb: () => void) => void;
}

/**
 * TurnstileWidget — robust, self-contained Cloudflare Turnstile.
 *
 * Industry-standard load sequence (the previous version assumed
 * window.turnstile already existed and never loaded the script, so it would
 * silently never render):
 *   1. Inject the api.js?render=explicit script once (deduped across mounts).
 *   2. Wait for the API via turnstile.ready() — render only when ready.
 *   3. Explicit render with appearance:'always' so the widget is ALWAYS
 *      visible (not hidden until an interaction is demanded), theme:'dark',
 *      size:'normal' (fixed 300x65 — never collapses to 0 height).
 *   4. A 15s watchdog distinguishes "script/widget never loaded" (show a
 *      retry) from a rendered-but-pending widget.
 *
 * Requires NEXT_PUBLIC_TURNSTILE_SITE_KEY. If the persistent symptom is the
 * widget stuck on "Verifying…" or invisible, the cause is almost always the
 * Cloudflare sitekey's domain allowlist not including the deployment host, or
 * a test sitekey in production — verify in the Cloudflare dashboard.
 */
export function TurnstileWidget({ onSuccess, onError, onExpire, theme = 'light' }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (!siteKey) {
      // Dev/preview without a sitekey: don't block the form.
      const t = setTimeout(() => onSuccess('dev-bypass'), 100);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    const getApi = (): TurnstileApi | undefined =>
      (window as unknown as { turnstile?: TurnstileApi }).turnstile;

    const render = () => {
      const api = getApi();
      if (cancelled || !api || !containerRef.current || widgetIdRef.current) return;
      try {
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size: 'normal',
          appearance: 'always',
          callback: onSuccess,
          'error-callback': () => onError?.(),
          'expired-callback': () => {
            onExpire?.();
            const a = getApi();
            if (a && widgetIdRef.current) a.reset(widgetIdRef.current);
          },
        });
      } catch {
        onError?.();
      }
    };

    const whenReady = () => {
      const api = getApi();
      if (api?.ready) api.ready(render);
      else render();
    };

    // Inject the script once; if it's already present/loaded, render now.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (getApi()) {
      whenReady();
    } else if (existing) {
      existing.addEventListener('load', whenReady, { once: true });
    } else {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.addEventListener('load', whenReady, { once: true });
      s.addEventListener('error', () => { if (!cancelled) setUnreachable(true); }, { once: true });
      document.head.appendChild(s);
    }

    // Watchdog — surface a retry only when the widget genuinely never rendered.
    const watchdog = setTimeout(() => {
      if (!cancelled && !widgetIdRef.current) setUnreachable(true);
    }, 15000);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      const api = getApi();
      if (api && widgetIdRef.current) {
        try { api.remove(widgetIdRef.current); } catch { /* already gone */ }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, theme, onSuccess, onError, onExpire]);

  if (!siteKey) {
    return (
      <div style={{ fontSize: '11px', color: '#f59e0b', padding: '8px' }}>
        Bot protection not configured. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY to env.
      </div>
    );
  }

  return (
    <div style={{ margin: '16px 0' }}>
      <div
        ref={containerRef}
        style={{ minHeight: 65, minWidth: 300, colorScheme: 'light', display: 'flex', justifyContent: 'center' }}
      />
      {unreachable && (
        <button
          type="button"
          onClick={() => { setUnreachable(false); window.location.reload(); }}
          style={{ marginTop: 8, fontSize: '12px', color: '#93c5fd', textDecoration: 'underline', background: 'none', border: 0, cursor: 'pointer' }}
        >
          Security check didn’t load. Tap to retry
        </button>
      )}
    </div>
  );
}
