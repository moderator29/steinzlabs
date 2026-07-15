'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WireComposer, type WireComposerHandle } from '@/components/wire/WireComposer';

/**
 * The Wire — full-screen compose page (X-style).
 *
 * The "+" on The Wire routes here instead of opening a small sheet. It is a full
 * page, not a floating card: a sticky top bar (back + Post), an identity row
 * (avatar, name, @handle, audience), a large textarea, up to four image
 * attachments, a topics dropdown, and an optional AI draft helper. Post lives in
 * the top bar (X-style) and is driven through a ref into the shared WireComposer,
 * so the composer's own action row never has to fit a Post button on a phone.
 *
 * Default topic = the general Wire: if the user picks no topic, the wire still
 * publishes and shows up in the Signal feed (Signal never filters by topic).
 */
export default function ComposePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const composerRef = useRef<WireComposerHandle>(null);
  const [postState, setPostState] = useState({ canPost: false, submitting: false });

  // Signed-out users can't compose — bounce to login once auth resolves.
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const backToWire = () => router.push('/dashboard?subtab=wire');
  // Signal the feed to refetch on return. Next.js's client router cache can
  // otherwise restore the Wire with a stale snapshot, so a just-published wire
  // would not appear until a hard reload. WireTab reads + clears this flag.
  const postedAndBack = () => {
    try { localStorage.setItem('nl-wire-posted', String(Date.now())); } catch { /* ignore */ }
    backToWire();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="w-full max-w-2xl mx-auto min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top bar — back on the left, Post on the right (X-style). */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-black/40 backdrop-blur-md border-b border-white/[0.06]">
        <button
          onClick={backToWire}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition flex-shrink-0"
          aria-label="Back to The Wire"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white font-semibold text-base">New wire</h1>
      </div>

      {/* Composer — full page, no caged card. */}
      <div className="flex-1 px-4 py-4">
        <WireComposer
          ref={composerRef}
          bare
          large
          hideInlinePost
          onStateChange={setPostState}
          avatarUrl={(user as { avatar_url?: string | null }).avatar_url ?? null}
          displayName={user.first_name || user.username || 'You'}
          username={user.username ?? null}
          userId={user.id}
          onPosted={postedAndBack}
        />

        <p className="mt-4 text-center text-xs text-white/35">
          No topic? Your wire still posts to the general Wire and shows in Signal.
        </p>
      </div>

      {/* Post lives at the BOTTOM (owner preference, not the X-style top bar). */}
      <div className="sticky bottom-0 z-20 px-4 py-3 bg-black/50 backdrop-blur-md border-t border-white/[0.06]">
        <button
          type="button"
          onClick={() => composerRef.current?.submit()}
          disabled={!postState.canPost}
          className="w-full naka-button-primary py-3 rounded-2xl inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
        >
          {postState.submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Post
        </button>
      </div>
    </div>
  );
}
