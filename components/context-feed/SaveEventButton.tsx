'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useState } from 'react';
import type { ContextEvent } from '@/lib/hooks/useContextFeed';

/**
 * SaveEventButton — toggles an event in the user's "Saved" vault. Renders the
 * current saved state (filled vs outline bookmark) and a brief in-flight state.
 * Wired to the parent's toggle handler from useSavedEvents, so the persistent
 * source of truth is Supabase saved_events (user-id bound), not local state.
 */
export default function SaveEventButton({
  event,
  saved,
  onToggle,
}: {
  event: ContextEvent;
  saved: boolean;
  onToggle: (event: ContextEvent) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try { await onToggle(event); } finally { setBusy(false); }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from Saved' : 'Save to vault'}
      title={saved ? 'Saved · click to remove' : 'Save to your vault'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-60 ${
        saved
          ? 'bg-[#0066FF]/15 text-[#8B7CFF] border border-[#0066FF]/35'
          : 'nl-glass text-gray-300 hover:text-white border border-white/10'
      }`}
      style={saved ? { boxShadow: '0 0 12px rgba(0,102,255,.25)' } : undefined}
    >
      {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
