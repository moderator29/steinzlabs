'use client';

import { useRef, useState } from 'react';
import { Loader2, ImagePlus, X, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WIRE_TOPICS, WIRE_MAX_TAGS } from '@/lib/wire/topics';
import type { WirePost } from './WirePostCard';

/**
 * WireComposer — the post box for creating a wire.
 *
 * Textarea with a live 0/600 counter, a single image upload (client-validated
 * < 1MB, images only, stored in the public `wire-media` bucket under
 * <uid>/<uuid>.<ext>), a 1–3 topic tag picker, and a Post button disabled while
 * empty, over the limit, uploading, or submitting. On success it hands the
 * created wire back to the parent for optimistic prepend.
 *
 * NOTE (flagged, not faked): wire_posts.media_url is a single column, so this
 * supports ONE image. Multi-image (up to 4) is a deliberate follow-up requiring
 * a media[] column or wire_media child table — see the delivery notes.
 */

const MAX = 600;
const MAX_IMAGE_BYTES = 1_048_576; // 1MB — mirrors the wire-media bucket cap
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface WireComposerProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  /** Session user id — the storage upload folder must be <uid>/ (owner-scoped). */
  userId?: string | null;
  /** Called with the freshly created wire so the parent can prepend it. */
  onPosted: (post: WirePost) => void;
}

export function WireComposer({ avatarUrl, displayName, userId, onPosted }: WireComposerProps) {
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const len = body.length;
  const over = len > MAX;
  const empty = body.trim().length === 0;
  const canPost = !empty && !over && !submitting && !uploading;

  const toggleTag = (value: string) => {
    setTags((prev) => {
      if (prev.includes(value)) return prev.filter((t) => t !== value);
      if (prev.length >= WIRE_MAX_TAGS) return prev; // cap at 3
      return [...prev, value];
    });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-picking the same file later
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError(null);

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      setError('Images only — JPG, PNG, WebP or GIF');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image is too large (${(file.size / 1_048_576).toFixed(1)}MB). Max is 1MB.`);
      return;
    }
    if (!userId) {
      setError('Sign in to attach an image');
      return;
    }

    setUploading(true);
    try {
      const uuid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${userId}/${uuid}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('wire-media')
        .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (upErr) {
        setError(upErr.message || 'Upload failed — try again');
        return;
      }
      const { data: pub } = supabase.storage.from('wire-media').getPublicUrl(path);
      if (!pub?.publicUrl) {
        setError('Could not resolve the image URL');
        return;
      }
      setMediaUrl(pub.publicUrl);
    } catch {
      setError('Upload failed — try again');
    } finally {
      setUploading(false);
    }
  };

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
          media_url: mediaUrl ?? undefined,
          tags: tags.length ? tags : undefined,
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
      setTags([]);
      setShowTags(false);
      setMediaUrl(null);
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

          {/* Image preview */}
          {mediaUrl ? (
            <div className="mt-2 relative rounded-xl overflow-hidden border border-white/10 max-w-full">
              <img src={mediaUrl} alt="" className="w-full max-h-[320px] object-cover" />
              <button
                type="button"
                onClick={() => setMediaUrl(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white/90 hover:bg-black/80 transition"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : uploading ? (
            <div className="mt-2 flex items-center gap-2 text-white/50 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading image…
            </div>
          ) : null}

          {/* Tag picker */}
          {showTags ? (
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/45">Add up to {WIRE_MAX_TAGS} topics</span>
                <span className="text-xs text-white/35 tabular-nums">{tags.length}/{WIRE_MAX_TAGS}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WIRE_TOPICS.map((t) => {
                  const active = tags.includes(t.value);
                  const atCap = !active && tags.length >= WIRE_MAX_TAGS;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleTag(t.value)}
                      disabled={atCap}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                        active
                          ? 'bg-[#0066FF]/20 text-[#4d94ff] border-[#0066FF]/50'
                          : atCap
                            ? 'text-white/25 border-white/10 cursor-not-allowed'
                            : 'text-white/60 border-white/12 hover:text-white hover:border-white/25'
                      }`}
                      aria-pressed={active}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error ? <div className="mt-2 text-xs text-red-400" role="alert">{error}</div> : null}

          <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !!mediaUrl}
              className="p-2 rounded-lg transition text-white/45 hover:text-[#4d94ff] hover:bg-[#0066FF]/12 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Add image"
              title={mediaUrl ? 'One image per wire' : 'Add image'}
            >
              <ImagePlus className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setShowTags((s) => !s)}
              className={`p-2 rounded-lg transition hover:bg-[#0066FF]/12 ${showTags || tags.length ? 'text-[#4d94ff]' : 'text-white/45 hover:text-[#4d94ff]'}`}
              aria-label="Add topics"
              aria-pressed={showTags}
              title="Add topics"
            >
              <Hash className="w-[18px] h-[18px]" />
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
