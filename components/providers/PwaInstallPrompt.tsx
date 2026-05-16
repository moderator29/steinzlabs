'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * PWA install prompt. Captures the browser's beforeinstallprompt event
 * so we can show our own branded CTA instead of waiting for the user
 * to find the menu → 'Install app' option. Once dismissed it stays
 * dismissed for 30 days (localStorage timestamp).
 *
 * Renders nothing on iOS Safari (which doesn't fire beforeinstallprompt
 * — Apple gates PWA install to a manual share-sheet flow we can't
 * trigger from JS) and nothing when the app is already running as a
 * standalone PWA. Renders inside the existing fixed-overlay layer.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'naka_pwa_dismissed_at';
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
      if (at && Date.now() - at < DISMISS_WINDOW_MS) return;
    } catch {
      /* localStorage blocked — show anyway */
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* non-fatal */
    }
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* swallow — same effect as dismiss */
    }
    setDeferred(null);
    close();
  };

  if (!open || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Install Naka Labs as an app"
      className="fixed bottom-20 left-4 right-4 z-[160] max-w-md mx-auto rounded-2xl bg-[#0F1320] border border-[#0A1EFF]/30 shadow-2xl p-4 naka-safe-mb"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] flex items-center justify-center shrink-0">
          <Download className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-0.5">Install Naka Labs</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Faster launch, native notifications, offline shell. One tap.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={install}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-xs font-bold text-white"
            >
              Install
            </button>
            <button onClick={close} className="text-xs text-slate-400 hover:text-white px-2 py-1.5">
              Not now
            </button>
          </div>
        </div>
        <button onClick={close} className="p-1 rounded hover:bg-white/[0.06] text-slate-500 shrink-0" aria-label="Dismiss install prompt">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
