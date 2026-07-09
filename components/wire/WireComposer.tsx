'use client';

import { useState } from 'react';
import { Loader2, ImagePlus } from 'lucide-react';
import type { WirePost } from './WirePostCard';

/**
 * WireComposer — the post box for creating a wire.
 *
 * Textarea with a live 0/600 counter, an optional media URL field, and a Post
 * button that is disabled while empty, over the limit, or submitting. On
 * success it hands the created wire back to the parent for optimistic prepend.
 */

const MAX = 600;

export interface WireComposerProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  /** Called with the freshly created wire so the parent can prepend it. */
  onPosted: (post: WirePost) => void;
}

export function WireComposer({ avatarUrl, displayName, onPosted }: WireComposerProps) {
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showMedia, setShowMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const len = body.length;
  const over = len > MAX;
  const empty = body.trim().length === 0;
  const canPost = !empty && !over && !submitting;

  const submit = async () => {
    if (!canPost) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/wire/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          media_url: showMedia && mediaUrl.trim() ? mediaUrl.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error || 'Could not post your wire');
        return;
      }
      const { post } = await res.json();
      if (post) onPosted(post);
      setBody('');
      setMediaUrl('');
      setShowMedia(false);
    } catch {
      setError('Network error — try again');
    } finally {
      setSubmitting(false);
    }
  };

  const initial = (displayName || '?').trim().charAt(0).toUpperCase();
  const pct = Math.min(1, len / MAX);
  const ringColor = over ? '#ef4444' : len > MAX * 0.9 ? '#f59e0b' : '#0066FF';

  return (
    <div className="nl-glass rounded-2xl p-4">
      <div className="flex gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover border border-white/10 flex-shrink-0" />
        ) : (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white/90 font-semibold border border-white/10"
            style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}
          >
            {initial}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
            }}
            placeholder="What's happening on the wire?"
            rows={3}
            className="w-full bg-transparent resize-none outline-none text-[15px] text-white placeholder:text-white/35 leading-relaxed"
          />

          {showMedia ? (
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Media URL (https://…)"
              className="mt-1 w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#0066FF]/50"
            />
          ) : null}

          {error ? <div className="mt-2 text-xs text-red-400" role="alert">{error}</div> : null}

          <div className="mt-3 flex items-center gap-3 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => setShowMedia((s) => !s)}
              className={`p-2 rounded-lg transition hover:bg-[#0066FF]/12 ${showMedia ? 'text-[#4d94ff]' : 'text-white/45 hover:text-[#4d94ff]'}`}
              aria-label="Add media"
              title="Add media"
            >
              <ImagePlus className="w-[18px] h-[18px]" />
            </button>

            <div className="ms-auto flex items-center gap-3">
              {/* Character ring + counter */}
              <div className="flex items-center gap-2">
                <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90">
                  <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                  <circle
                    cx="11"
                    cy="11"
                    r="9"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 9}
                    strokeDashoffset={2 * Math.PI * 9 * (1 - pct)}
                  />
                </svg>
                <span className={`text-xs tabular-nums ${over ? 'text-red-400' : 'text-white/40'}`}>
                  {len}/{MAX}
                </span>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!canPost}
                className="naka-button-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WireComposer;
