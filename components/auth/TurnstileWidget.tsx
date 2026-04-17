'use client';
import { useEffect, useRef } from 'react';

interface Props {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export function TurnstileWidget({ onSuccess, onError, onExpire }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) {
      setTimeout(() => onSuccess('dev-bypass'), 100);
      return;
    }

    const win = window as Window & {
      turnstile?: {
        render: (el: HTMLElement, opts: Record<string, unknown>) => string;
        reset: (id: string) => void;
      };
    };

    if (!win.turnstile || !containerRef.current) return;

    widgetIdRef.current = win.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'dark',
      size: 'normal',
      callback: onSuccess,
      'error-callback': () => onError?.(),
      'expired-callback': () => {
        onExpire?.();
        if (widgetIdRef.current) win.turnstile?.reset(widgetIdRef.current);
      },
    });

    return () => {
      widgetIdRef.current = null;
    };
  }, [siteKey, onSuccess, onError, onExpire]);

  if (!siteKey) {
    return (
      <div style={{ fontSize: '11px', color: '#f59e0b', padding: '8px' }}>
        Bot protection not configured. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY to env.
      </div>
    );
  }

  return <div ref={containerRef} style={{ margin: '16px 0' }} />;
}
