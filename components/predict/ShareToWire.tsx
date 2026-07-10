'use client';

import { useState } from 'react';
import { Check, Loader2, Share2 } from 'lucide-react';
import type { Entry } from './types';
import { winShareBody } from './utils';

type State = 'idle' | 'sharing' | 'done' | 'error';

// Posts a won prediction to The Wire as a real, honest post. Reused by the win
// celebration toast and the My Predictions history rows.
export function ShareToWire({
  entry,
  size = 'sm',
  className = '',
}: {
  entry: Entry;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [state, setState] = useState<State>('idle');

  const share = async () => {
    if (state === 'sharing' || state === 'done') return;
    setState('sharing');
    try {
      const res = await fetch('/api/wire/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: winShareBody(entry), tags: ['prediction'] }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  const pad = size === 'md' ? 'h-9 px-3.5 text-sm' : 'h-8 px-3 text-xs';

  if (state === 'done') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/[0.1] font-semibold text-emerald-300 ${pad} ${className}`}
      >
        <Check className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} /> Shared to The Wire
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={state === 'sharing'}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-[#0066FF]/40 bg-[#0066FF]/[0.14] font-semibold text-[#9FD0FF] transition-all hover:border-[#0066FF]/70 hover:bg-[#0066FF]/[0.22] disabled:opacity-60 ${pad} ${className}`}
    >
      {state === 'sharing' ? (
        <>
          <Loader2 className={size === 'md' ? 'w-4 h-4 animate-spin' : 'w-3.5 h-3.5 animate-spin'} /> Sharing…
        </>
      ) : (
        <>
          <Share2 className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          {state === 'error' ? 'Retry share' : 'Share'}
        </>
      )}
    </button>
  );
}
