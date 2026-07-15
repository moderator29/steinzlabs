'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';

/**
 * Per-user notify bell for a profile. Tap to turn ON notifications for this
 * user's posts; a small popover adds a "when they come online" toggle. Backed by
 * /api/notify/subscribe (user_notify_subscriptions). Hidden for your own profile.
 */
export function NotifyBell({ targetId, self }: { targetId: string; self?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [notifyOnline, setNotifyOnline] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (self) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/notify/subscribe?target=${encodeURIComponent(targetId)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!cancelled) { setSubscribed(!!j.subscribed); setNotifyOnline(!!j.notify_online); }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [targetId, self]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (self) return null;

  const save = async (nextSub: boolean, nextOnline: boolean) => {
    setBusy(true);
    setSubscribed(nextSub); setNotifyOnline(nextOnline); // optimistic
    try {
      if (!nextSub) {
        await fetch(`/api/notify/subscribe?target=${encodeURIComponent(targetId)}`, { method: 'DELETE' });
      } else {
        await fetch('/api/notify/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId, notify_posts: true, notify_online: nextOnline }),
        });
      }
    } catch { /* keep optimistic */ }
    finally { setBusy(false); }
  };

  const toggleMain = () => {
    if (!subscribed) { void save(true, notifyOnline); setOpen(true); }
    else setOpen((v) => !v);
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={toggleMain}
        disabled={busy || (!loaded && !self)}
        aria-pressed={subscribed}
        aria-label={subscribed ? 'Notifications on' : 'Notify me'}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
          subscribed
            ? 'bg-[#0066FF]/15 border-[#0066FF]/45 text-[#7FB2FF]'
            : 'bg-white/[0.04] border-white/10 text-white/70 hover:text-white'
        }`}
      >
        {subscribed ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      </button>

      {open && subscribed ? (
        <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-white/10 bg-[#0b1022]/95 backdrop-blur p-3 shadow-2xl">
          <div className="text-[12px] font-semibold text-white mb-2">Notifications for this user</div>
          <label className="flex items-center justify-between gap-2 py-1.5 text-[13px] text-white/80">
            <span>New posts</span>
            <input type="checkbox" checked readOnly className="accent-[#0066FF] w-4 h-4" />
          </label>
          <label className="flex items-center justify-between gap-2 py-1.5 text-[13px] text-white/80 cursor-pointer">
            <span>When they come online</span>
            <input
              type="checkbox"
              checked={notifyOnline}
              onChange={(e) => void save(true, e.target.checked)}
              className="accent-[#0066FF] w-4 h-4"
            />
          </label>
          <button
            type="button"
            onClick={() => { void save(false, false); setOpen(false); }}
            className="mt-2 w-full text-[12px] font-semibold text-rose-300 hover:text-rose-200 py-1.5 rounded-lg bg-white/[0.03] border border-white/10"
          >
            Turn off
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default NotifyBell;
