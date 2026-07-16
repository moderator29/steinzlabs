'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';

/**
 * One-tap "Copy" / "Copying" toggle for a top trader. Mirrors that leader's
 * coin buys through the existing non-custodial copy rails: every fill is signed
 * by your own wallet in the browser, the platform never holds keys or auto-signs.
 *
 * Optimistic with revert. Honest disabled state when the row is your own account.
 * Mount on leaderboard trader rows and coin-page holders.
 */

interface Props {
  leaderUserId: string;
  leaderName?: string;
}

interface CopyStatus {
  copying: boolean;
  isSelf: boolean;
}

const BASE =
  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold border transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed';
const ACTIVE = 'bg-[#0066FF]/18 border-[#0066FF]/60 text-white shadow-[0_0_18px_-4px_rgba(0,102,255,.8)]';
const IDLE = 'nl-glass border-white/10 text-white/70 hover:text-white hover:border-white/20';

export default function CopyTraderButton({ leaderUserId, leaderName }: Props) {
  const [copying, setCopying] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/coins/copy?leaderUserId=${encodeURIComponent(leaderUserId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as CopyStatus;
        if (cancelled) return;
        setCopying(!!json.copying);
        setIsSelf(!!json.isSelf);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leaderUserId]);

  async function toggle() {
    if (busy || isSelf) return;
    const want = !copying;
    setBusy(true);
    setCopying(want); // optimistic
    try {
      const res = want
        ? await fetch('/api/coins/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leaderUserId }),
          })
        : await fetch(`/api/coins/copy?leaderUserId=${encodeURIComponent(leaderUserId)}`, {
            method: 'DELETE',
          });
      if (!res.ok) throw new Error('request failed');
    } catch {
      setCopying(!want); // revert
    } finally {
      setBusy(false);
    }
  }

  const label = isSelf ? 'You' : copying ? 'Copying' : 'Copy';
  const Icon = busy ? Loader2 : copying ? Check : Copy;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={!loaded || busy || isSelf}
        aria-pressed={copying}
        aria-label={isSelf ? 'This is you' : copying ? `Stop copying ${leaderName ?? 'this trader'}` : `Copy ${leaderName ?? 'this trader'}`}
        className={`${BASE} ${copying && !isSelf ? ACTIVE : IDLE} ${isSelf ? 'opacity-50' : ''}`}
      >
        <Icon className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} strokeWidth={2} />
        {label}
      </button>
      {!isSelf && copying ? (
        <span className="text-[10px] leading-tight text-white/40">You sign every fill in your own wallet.</span>
      ) : null}
    </div>
  );
}
