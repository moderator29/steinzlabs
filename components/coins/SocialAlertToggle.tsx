'use client';

import { useEffect, useState } from 'react';
import { Users, Trophy, Bell } from 'lucide-react';

/**
 * Two toggle chips that arm / disarm a social buy alert on a coin: "People I
 * follow buy" and "Proven traders buy". Each chip POSTs to arm and DELETEs to
 * disarm the owner-scoped alert. Signed-out users see a sign-in prompt instead.
 * Real state only: chips reflect what is actually armed in the DB.
 */

type Scope = 'following' | 'proven';

interface Props {
  chain: string;
  address: string;
  signedIn: boolean;
}

interface AlertRow {
  scope: Scope;
  active: boolean;
}

const CHIP_BASE =
  'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold border transition-all duration-200 active:scale-[0.98] disabled:opacity-50';
const CHIP_ACTIVE =
  'bg-[#0066FF]/18 border-[#0066FF]/60 text-white shadow-[0_0_18px_-4px_rgba(0,102,255,.8)]';
const CHIP_IDLE = 'border-white/10 text-white/70 hover:text-white hover:border-white/20';

export default function SocialAlertToggle({ chain, address, signedIn }: Props) {
  const [armed, setArmed] = useState<Record<Scope, boolean>>({ following: false, proven: false });
  const [pending, setPending] = useState<Scope | null>(null);
  const [loaded, setLoaded] = useState(false);

  const base = `/api/coins/${chain}/${encodeURIComponent(address)}/social-alerts`;

  useEffect(() => {
    if (!signedIn) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(base, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { alerts?: AlertRow[] };
        if (cancelled) return;
        const next: Record<Scope, boolean> = { following: false, proven: false };
        for (const a of json.alerts ?? []) {
          if (a.active && (a.scope === 'following' || a.scope === 'proven')) next[a.scope] = true;
        }
        setArmed(next);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [base, signedIn]);

  async function toggle(scope: Scope) {
    if (pending) return;
    const want = !armed[scope];
    setPending(scope);
    setArmed((prev) => ({ ...prev, [scope]: want })); // optimistic
    try {
      const res = want
        ? await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope }),
          })
        : await fetch(`${base}?scope=${scope}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('request failed');
    } catch {
      setArmed((prev) => ({ ...prev, [scope]: !want })); // revert
    } finally {
      setPending(null);
    }
  }

  if (!signedIn) {
    return (
      <div className="nl-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <Bell className="h-4 w-4 text-[#0066FF]" strokeWidth={2} />
          Social buy alerts
        </div>
        <p className="mt-1 text-[12px] text-white/60">
          Sign in to get notified when people you follow or Proven traders buy this coin.
        </p>
        <a
          href="/login"
          className="mt-3 inline-flex items-center justify-center rounded-full bg-[#0066FF] px-4 py-2 text-[13px] font-bold text-white shadow-[0_12px_32px_-12px_rgba(0,102,255,.9)]"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="nl-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
        <Bell className="h-4 w-4 text-[#0066FF]" strokeWidth={2} />
        Social buy alerts
      </div>
      <p className="mt-1 text-[12px] text-white/60">
        Get notified when they buy this coin.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggle('following')}
          disabled={!loaded || pending === 'following'}
          aria-pressed={armed.following}
          className={`${CHIP_BASE} ${armed.following ? CHIP_ACTIVE : CHIP_IDLE}`}
        >
          <Users className="h-4 w-4" strokeWidth={2} />
          People I follow buy
        </button>
        <button
          type="button"
          onClick={() => toggle('proven')}
          disabled={!loaded || pending === 'proven'}
          aria-pressed={armed.proven}
          className={`${CHIP_BASE} ${armed.proven ? CHIP_ACTIVE : CHIP_IDLE}`}
        >
          <Trophy className="h-4 w-4" strokeWidth={2} />
          Proven traders buy
        </button>
      </div>
    </div>
  );
}
