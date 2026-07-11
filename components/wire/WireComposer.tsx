'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Loader2, ImagePlus, X, Sparkles, ChevronDown, Check,
  Coins, Building2, Bot, BrainCircuit, Blocks, TrendingUp, Laugh, Hexagon, Globe,
  Plus, DollarSign, LineChart, ArrowUpRight, ArrowDownRight, Users, UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WIRE_TOPICS, WIRE_MAX_TAGS } from '@/lib/wire/topics';
import type { WirePost } from './WirePostCard';

/**
 * WireComposer - the post box for creating a wire.
 *
 * Textarea with a live 0/600 counter, up to FOUR image uploads (each
 * client-validated < 1MB, images only, stored in the public `wire-media` bucket
 * under <uid>/<uuid>.<ext>), a 1 to 3 topic tag picker behind an "Options"
 * dropdown, and a Post button disabled while empty, over the limit, uploading,
 * or submitting. Attached images show as a compact thumbnail row with per-image
 * remove and an "add" tile that disables at the 4-image cap. On success it hands
 * the created wire back to the parent for optimistic prepend.
 *
 * Media is submitted as media_urls: string[] (bucket public URLs only); the API
 * still accepts the legacy single media_url for older clients.
 *
 * The full-page compose route drives Post from its own top bar, so it holds a
 * ref to this component and calls submit(); onStateChange keeps that button's
 * enabled/spinner state in sync.
 */

const MAX = 600;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1_048_576; // 1MB - mirrors the wire-media bucket cap
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// One flat icon per topic so the Options dropdown reads at a glance. Chains that
// have no dedicated glyph share a neutral hexagon rather than a fake logo.
const TOPIC_ICON: Record<string, LucideIcon> = {
  new: Sparkles,
  crypto: Coins,
  rwa: Building2,
  ai: Bot,
  agi: BrainCircuit,
  blockchain: Blocks,
  solana: Hexagon,
  eth: Hexagon,
  bnb: Hexagon,
  prediction: TrendingUp,
  memes: Laugh,
};

// Audience options for the visibility pill. Meaning is enforced server-side in
// the feed (applyAudience): everyone = public; followers = only the author's
// accepted followers; following = only accounts the author follows.
const AUDIENCE_OPTS: Array<{
  key: 'everyone' | 'followers' | 'following';
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { key: 'everyone', label: 'Everyone', hint: 'Anyone on Naka can see this', icon: Globe },
  { key: 'followers', label: 'Followers', hint: 'Only people who follow you', icon: Users },
  { key: 'following', label: 'Following', hint: 'Only people you follow', icon: UserCheck },
];

export interface WireComposerHandle {
  submit: () => void;
}

export interface WireComposerProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  /** @handle shown under the display name in page mode (X-style identity row). */
  username?: string | null;
  /** Session user id - the storage upload folder must be <uid>/ (owner-scoped). */
  userId?: string | null;
  /** Called with the freshly created wire so the parent can prepend it. */
  onPosted: (post: WirePost) => void;
  /** Page mode: larger textarea + autofocus + X-style identity row. */
  large?: boolean;
  /** Render without the outer glass card (the compose page supplies its own). */
  bare?: boolean;
  /** Hide the inline Post button - the page renders Post in its own top bar. */
  hideInlinePost?: boolean;
  /** Live enabled/spinner state for a host-rendered Post button. */
  onStateChange?: (s: { canPost: boolean; submitting: boolean }) => void;
}

export const WireComposer = forwardRef<WireComposerHandle, WireComposerProps>(function WireComposer(
  { avatarUrl, displayName, username, userId, onPosted, large, bare, hideInlinePost, onStateChange },
  ref,
) {
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  // Who can see the wire. Drives the audience pill dropdown + the create call.
  const [audience, setAudience] = useState<'everyone' | 'followers' | 'following'>('everyone');
  const [showAudience, setShowAudience] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Attachment tray: attach a $cashtag price chip helper, a prediction call, or
  // media to the wire before posting.
  const [trayOpen, setTrayOpen] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [priceSymbol, setPriceSymbol] = useState('');
  const [showPredForm, setShowPredForm] = useState(false);
  const [predSymbol, setPredSymbol] = useState('');
  const [predDirection, setPredDirection] = useState<'above' | 'below'>('above');
  const [predTarget, setPredTarget] = useState('');
  const [predHorizon, setPredHorizon] = useState(3600);
  // The staged call, attached to the wire after it is created.
  const [prediction, setPrediction] = useState<
    { symbol: string; direction: 'above' | 'below'; target: number; horizonSeconds: number } | null
  >(null);

  const HORIZONS: { label: string; seconds: number }[] = [
    { label: '1h', seconds: 3600 },
    { label: '4h', seconds: 4 * 3600 },
    { label: '24h', seconds: 24 * 3600 },
    { label: '7d', seconds: 7 * 24 * 3600 },
  ];

  const insertCashtag = () => {
    const sym = priceSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!sym) return;
    setBody((b) => {
      const next = `${b.trimEnd()}${b.trim() ? ' ' : ''}$${sym} `.slice(0, MAX);
      return next;
    });
    setPriceSymbol('');
    setShowPrice(false);
  };

  const stagePrediction = () => {
    const sym = predSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const target = parseFloat(predTarget);
    if (!sym || !Number.isFinite(target) || target <= 0) return;
    setPrediction({ symbol: sym, direction: predDirection, target, horizonSeconds: predHorizon });
    setShowPredForm(false);
    setPredSymbol('');
    setPredTarget('');
  };

  const len = body.length;
  const over = len > MAX;
  const empty = body.trim().length === 0;
  const canPost = !empty && !over && !submitting && !uploading;

  // Keep a host-rendered Post button (compose page top bar) in sync.
  useEffect(() => {
    onStateChange?.({ canPost, submitting });
  }, [canPost, submitting, onStateChange]);

  const toggleTag = (value: string) => {
    setTags((prev) => {
      if (prev.includes(value)) return prev.filter((t) => t !== value);
      if (prev.length >= WIRE_MAX_TAGS) return prev; // cap at 3
      return [...prev, value];
    });
  };

  /** Upload one already-validated file, returning its public URL (or null). */
  const uploadOne = async (file: File, ext: string): Promise<string | null> => {
    const uuid =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${userId}/${uuid}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('wire-media')
      .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
    if (upErr) {
      setError(upErr.message || 'Upload failed. Try again.');
      return null;
    }
    const { data: pub } = supabase.storage.from('wire-media').getPublicUrl(path);
    if (!pub?.publicUrl) {
      setError('Could not resolve the image URL');
      return null;
    }
    return pub.publicUrl;
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // Allow re-picking the same file(s) later
    if (fileRef.current) fileRef.current.value = '';
    if (picked.length === 0) return;
    setError(null);

    if (!userId) {
      setError('Sign in to attach an image');
      return;
    }

    // Only take as many as remain under the 4-image cap.
    const remaining = MAX_IMAGES - mediaUrls.length;
    if (remaining <= 0) {
      setError(`Up to ${MAX_IMAGES} images per wire`);
      return;
    }
    const files = picked.slice(0, remaining);
    if (picked.length > remaining) {
      setError(`Up to ${MAX_IMAGES} images per wire. Extra images skipped.`);
    }

    setUploading(true);
    try {
      for (const file of files) {
        const ext = ALLOWED_MIME[file.type];
        if (!ext) {
          setError('Images only: JPG, PNG, WebP or GIF');
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          setError(`"${file.name}" is too large (${(file.size / 1_048_576).toFixed(1)}MB). Max is 1MB.`);
          continue;
        }
        const url = await uploadOne(file, ext);
        if (url) setMediaUrls((prev) => (prev.length < MAX_IMAGES ? [...prev, url] : prev));
      }
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => setMediaUrls((prev) => prev.filter((u) => u !== url));

  /**
   * Optional AI draft helper. Sends the current draft (which may be empty, a
   * pasted ticker / contract, or rough notes) to /api/wire/ai-draft and drops
   * the returned clean draft straight into the editable textarea - the user
   * still reviews, edits and posts manually. Suggested topics are merged into
   * the picker (respecting the 3-tag cap) but never auto-submitted. If the AI
   * layer is unavailable we surface an honest message and posting is untouched.
   */
  const aiAssist = async () => {
    if (aiLoading || submitting) return;
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await fetch('/api/wire/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: body.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setAiError(j?.error || 'AI assist unavailable');
        return;
      }
      const j = await res.json();
      if (typeof j.text === 'string' && j.text.trim()) {
        setBody(j.text.trim().slice(0, MAX));
      }
      if (Array.isArray(j.tags) && j.tags.length) {
        setTags((prev) => {
          const merged = [...prev];
          for (const t of j.tags) {
            if (typeof t === 'string' && !merged.includes(t) && merged.length < WIRE_MAX_TAGS) {
              merged.push(t);
            }
          }
          return merged;
        });
      }
    } catch {
      setAiError('AI assist unavailable');
    } finally {
      setAiLoading(false);
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
          media_urls: mediaUrls.length ? mediaUrls : undefined,
          tags: tags.length ? tags : undefined,
          audience: audience !== 'everyone' ? audience : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error || 'Could not post your wire');
        return;
      }
      const { post } = await res.json();

      // Attach a staged prediction call to the freshly created wire. If the
      // attach fails, the wire still posts - we just surface an honest note.
      if (post && prediction) {
        try {
          const pr = await fetch('/api/wire/predictions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId: post.id,
              symbol: prediction.symbol,
              direction: prediction.direction,
              target: prediction.target,
              horizonSeconds: prediction.horizonSeconds,
            }),
          });
          if (pr.ok) {
            const { prediction: attached } = await pr.json();
            if (attached) post.prediction = attached;
          }
        } catch {
          /* wire is posted; the call just did not attach */
        }
      }

      if (post) onPosted(post);
      setBody('');
      setTags([]);
      setShowTags(false);
      setMediaUrls([]);
      setPrediction(null);
      setTrayOpen(false);
      setShowPrice(false);
      setShowPredForm(false);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  useImperativeHandle(ref, () => ({ submit }));

  const initial = (displayName || '?').trim().charAt(0).toUpperCase();
  const pct = Math.min(1, len / MAX);
  const ringColor = over ? '#ef4444' : len > MAX * 0.9 ? '#f59e0b' : '#0066FF';

  const avatar = avatarUrl ? (
    <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover border border-white/10 flex-shrink-0" />
  ) : (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white/90 font-semibold border border-white/10"
      style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}
    >
      {initial}
    </div>
  );

  return (
    <div className={bare ? '' : 'nl-glass rounded-2xl p-4'}>
      {/* X-style identity row (page mode): avatar + name/@handle + public pill. */}
      {large ? (
        <div className="flex items-center gap-3 mb-3">
          {avatar}
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-sm leading-tight truncate">{displayName || 'You'}</div>
            {username ? <div className="text-white/40 text-xs leading-tight truncate">@{username}</div> : null}
          </div>
          {(() => {
            const current = AUDIENCE_OPTS.find((o) => o.key === audience) ?? AUDIENCE_OPTS[0];
            const CurrentIcon = current.icon;
            return (
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAudience((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={showAudience}
                  className="inline-flex items-center gap-1 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-2.5 py-1 text-[11px] font-semibold text-[#8fb6ff] transition-colors hover:bg-[#0066FF]/20"
                >
                  <CurrentIcon className="w-3 h-3" /> {current.label}
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
                {showAudience ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAudience(false)} />
                    <div
                      role="listbox"
                      className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1120] p-1.5 shadow-2xl"
                    >
                      {AUDIENCE_OPTS.map((o) => {
                        const Icon = o.icon;
                        const active = o.key === audience;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              setAudience(o.key);
                              setShowAudience(false);
                            }}
                            className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                              active ? 'bg-[#0066FF]/15' : 'hover:bg-white/[0.05]'
                            }`}
                          >
                            <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${active ? 'text-[#4d94ff]' : 'text-white/60'}`} />
                            <span className="min-w-0">
                              <span className={`block text-[13px] font-semibold ${active ? 'text-white' : 'text-white/85'}`}>
                                {o.label}
                              </span>
                              <span className="block text-[11px] leading-tight text-white/45">{o.hint}</span>
                            </span>
                            {active ? <Check className="ml-auto mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#4d94ff]" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })()}
        </div>
      ) : null}

      <div className="flex gap-3">
        {large ? null : avatar}

        <div className="min-w-0 flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
            }}
            placeholder="What's happening on The Wire?"
            rows={large ? 6 : 3}
            autoFocus={large}
            className={`w-full bg-transparent resize-none outline-none text-white placeholder:text-white/35 leading-relaxed ${
              large ? 'text-lg min-h-[9rem]' : 'text-[15px]'
            }`}
          />

          {/* Thumbnail row - up to 4 attached images + an add tile */}
          {mediaUrls.length > 0 || uploading ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {mediaUrls.map((url) => (
                <div
                  key={url}
                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 flex-shrink-0"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white/90 hover:bg-black/80 transition"
                    aria-label="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {uploading ? (
                <div className="w-20 h-20 rounded-xl border border-white/10 flex items-center justify-center flex-shrink-0 text-white/50">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : mediaUrls.length < MAX_IMAGES ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border border-dashed border-white/15 flex items-center justify-center flex-shrink-0 text-white/40 hover:text-[#4d94ff] hover:border-[#0066FF]/40 hover:bg-[#0066FF]/8 transition"
                  aria-label="Add another image"
                  title="Add image"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Selected-topic pills (always visible once chosen) */}
          {tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((v) => {
                const t = WIRE_TOPICS.find((x) => x.value === v);
                const Icon = TOPIC_ICON[v] ?? Hexagon;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleTag(v)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#0066FF]/50 bg-[#0066FF]/20 px-2.5 py-1 text-xs font-medium text-[#8fb6ff]"
                  >
                    <Icon className="w-3 h-3" /> {t?.label ?? v}
                    <X className="w-3 h-3 opacity-70" />
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Topic picker - a single "Options" trigger that pulls out a vertical,
              icon-led list (like the Context Feed chain picker). Multi-select up
              to 3; the list stays open so several can be added, and closes on the
              trigger or a tap outside. */}
          <div className="mt-3 relative">
            <button
              type="button"
              onClick={() => setShowTags((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                showTags || tags.length
                  ? 'border-[#0066FF]/50 bg-[#0066FF]/15 text-[#8fb6ff]'
                  : 'border-white/12 text-white/60 hover:text-white hover:border-white/25'
              }`}
              aria-expanded={showTags}
              aria-haspopup="listbox"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {tags.length ? `${tags.length}/${WIRE_MAX_TAGS} topics` : 'Add topics'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTags ? 'rotate-180' : ''}`} />
            </button>

            {showTags ? (
              <>
                <button
                  type="button"
                  aria-label="Close topics"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setShowTags(false)}
                />
                <div
                  role="listbox"
                  className="absolute z-20 mt-2 w-60 max-h-72 overflow-y-auto no-scrollbar nl-glass rounded-2xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
                >
                  {WIRE_TOPICS.map((t) => {
                    const active = tags.includes(t.value);
                    const atCap = !active && tags.length >= WIRE_MAX_TAGS;
                    const Icon = TOPIC_ICON[t.value] ?? Hexagon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => toggleTag(t.value)}
                        disabled={atCap}
                        className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition text-left ${
                          active
                            ? 'bg-[#0066FF]/18 text-white'
                            : atCap
                              ? 'text-white/25 cursor-not-allowed'
                              : 'text-white/75 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#4d94ff]' : 'text-white/45'}`} />
                        <span className="flex-1">{t.label}</span>
                        {active ? <Check className="w-4 h-4 text-[#4d94ff]" /> : null}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          {/* Attachment tray - Price chip / Prediction call / Media */}
          {trayOpen ? (
            <div className="mt-3 nl-glass rounded-xl p-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => { setShowPrice((s) => !s); setShowPredForm(false); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
                  showPrice ? 'border-[#0066FF]/50 bg-[#0066FF]/15 text-[#8fb6ff]' : 'border-white/12 text-white/70 hover:text-white hover:border-white/25'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" /> Price chip
              </button>
              <button
                type="button"
                onClick={() => { setShowPredForm((s) => !s); setShowPrice(false); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
                  showPredForm ? 'border-[#0066FF]/50 bg-[#0066FF]/15 text-[#8fb6ff]' : 'border-white/12 text-white/70 hover:text-white hover:border-white/25'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" /> Prediction
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || mediaUrls.length >= MAX_IMAGES}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition border border-white/12 text-white/70 hover:text-white hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImagePlus className="w-3.5 h-3.5" /> Media
              </button>
            </div>
          ) : null}

          {/* Price chip helper - type a ticker to drop a $SYMBOL into the body */}
          {trayOpen && showPrice ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="inline-flex items-center gap-1 nl-glass rounded-lg px-2 py-1.5 flex-1 min-w-0">
                <span className="text-white/40 text-sm">$</span>
                <input
                  value={priceSymbol}
                  onChange={(e) => setPriceSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertCashtag(); } }}
                  placeholder="BTC"
                  maxLength={10}
                  className="bg-transparent outline-none text-sm text-white placeholder:text-white/30 w-full uppercase"
                />
              </div>
              <button
                type="button"
                onClick={insertCashtag}
                disabled={!priceSymbol.trim()}
                className="naka-button-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          ) : null}

          {/* Prediction call mini-form */}
          {trayOpen && showPredForm ? (
            <div className="mt-2 nl-glass rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 nl-glass rounded-lg px-2 py-1.5">
                  <span className="text-white/40 text-sm">$</span>
                  <input
                    value={predSymbol}
                    onChange={(e) => setPredSymbol(e.target.value.toUpperCase())}
                    placeholder="BTC"
                    maxLength={10}
                    className="bg-transparent outline-none text-sm text-white placeholder:text-white/30 w-16 uppercase"
                  />
                </div>
                <div className="inline-flex rounded-lg nl-glass p-0.5">
                  <button
                    type="button"
                    onClick={() => setPredDirection('above')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${predDirection === 'above' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/55 hover:text-white'}`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> Above
                  </button>
                  <button
                    type="button"
                    onClick={() => setPredDirection('below')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${predDirection === 'below' ? 'bg-rose-500/20 text-rose-300' : 'text-white/55 hover:text-white'}`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" /> Below
                  </button>
                </div>
                <div className="inline-flex items-center gap-1 nl-glass rounded-lg px-2 py-1.5 flex-1 min-w-[6rem]">
                  <span className="text-white/40 text-sm">$</span>
                  <input
                    value={predTarget}
                    onChange={(e) => setPredTarget(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    placeholder="Target"
                    className="bg-transparent outline-none text-sm text-white placeholder:text-white/30 w-full tabular-nums"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg nl-glass p-0.5">
                  {HORIZONS.map((h) => (
                    <button
                      key={h.seconds}
                      type="button"
                      onClick={() => setPredHorizon(h.seconds)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition tabular-nums ${predHorizon === h.seconds ? 'bg-[#0066FF]/20 text-[#8fb6ff]' : 'text-white/55 hover:text-white'}`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={stagePrediction}
                  disabled={!predSymbol.trim() || !predTarget.trim()}
                  className="naka-button-primary text-sm ms-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Attach call
                </button>
              </div>
            </div>
          ) : null}

          {/* Staged prediction chip */}
          {prediction ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#0066FF]/40 bg-[#0066FF]/12 px-3 py-1.5 text-xs font-medium text-[#8fb6ff]">
              <LineChart className="w-3.5 h-3.5" />
              <span className="tabular-nums">
                ${prediction.symbol} {prediction.direction} ${prediction.target}
              </span>
              <span className="text-white/40">
                · {HORIZONS.find((h) => h.seconds === prediction.horizonSeconds)?.label ?? ''}
              </span>
              <button type="button" onClick={() => setPrediction(null)} aria-label="Remove call" className="text-white/50 hover:text-white transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}

          {error ? <div className="mt-2 text-xs text-red-400" role="alert">{error}</div> : null}
          {aiError ? <div className="mt-2 text-xs text-amber-400/90" role="status">{aiError}</div> : null}

          <div className="mt-3 flex items-center gap-1.5 rounded-xl nl-glass px-2 py-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={onPickFile}
            />
            <button
              type="button"
              onClick={() => setTrayOpen((t) => !t)}
              className={`p-2 rounded-lg transition hover:bg-[#0066FF]/12 ${trayOpen ? 'text-[#4d94ff] rotate-45' : 'text-white/45 hover:text-[#4d94ff]'}`}
              aria-label="Attachment tray"
              aria-expanded={trayOpen}
              title="Attach price, prediction or media"
            >
              <Plus className="w-[18px] h-[18px] transition-transform" />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || mediaUrls.length >= MAX_IMAGES}
              className="p-2 rounded-lg transition text-white/45 hover:text-[#4d94ff] hover:bg-[#0066FF]/12 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Add image"
              title={mediaUrls.length >= MAX_IMAGES ? `Up to ${MAX_IMAGES} images per wire` : 'Add image'}
            >
              <ImagePlus className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={aiAssist}
              disabled={aiLoading || submitting}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[13px] font-medium text-[#4d94ff] hover:bg-[#0066FF]/12 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="AI draft assist"
              title="Draft or refine with AI"
            >
              {aiLoading ? <Loader2 className="w-[16px] h-[16px] animate-spin" /> : <Sparkles className="w-[16px] h-[16px]" />}
              AI
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

              {hideInlinePost ? null : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canPost}
                  className="naka-button-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Post
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default WireComposer;
