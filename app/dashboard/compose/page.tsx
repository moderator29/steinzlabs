'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WireComposer } from '@/components/wire/WireComposer';

/**
 * The Wire — full-screen compose page (X-style).
 *
 * The "+" on The Wire routes here instead of opening a small sheet. It gives a
 * dedicated, focused surface: the author's avatar, a large textarea, up to four
 * image attachments, an always-visible topic picker, an optional AI draft
 * helper, and a Post button. All of the posting / upload / tagging logic is the
 * shared WireComposer — this page only supplies the page chrome and routes back
 * to the wire on success.
 *
 * Default topic = the general Wire: if the user picks no topic, the wire still
 * publishes and shows up in the Signal feed (Signal never filters by topic).
 */
export default function ComposePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Signed-out users can't compose — bounce to login once auth resolves.
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const backToWire = () => router.push('/dashboard?subtab=wire');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-3 flex items-center gap-3 bg-gradient-to-b from-black/50 to-transparent backdrop-blur-sm">
        <Link
          href="/dashboard?subtab=wire"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition flex-shrink-0"
          aria-label="Back to The Wire"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white font-semibold text-lg">New wire</h1>
        <span className="ms-auto inline-flex items-center gap-1 text-[11px] text-white/40">
          <Sparkles className="w-3.5 h-3.5 text-[#4d94ff]" />
          The Wire
        </span>
      </div>

      {/* Composer card */}
      <div className="nl-glass rounded-2xl p-4">
        <WireComposer
          bare
          large
          expandedTags
          avatarUrl={(user as any).avatar_url ?? null}
          displayName={user.first_name || user.username || 'You'}
          userId={user.id}
          onPosted={backToWire}
        />
      </div>

      <p className="mt-3 text-center text-xs text-white/35">
        No topic? Your wire still posts to the general Wire and shows in Signal.
      </p>
    </div>
  );
}
