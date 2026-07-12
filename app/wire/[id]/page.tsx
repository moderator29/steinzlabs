import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSiteUrl } from '@/lib/siteUrl';
import { computeAuthorSignals } from '@/lib/wire/signal';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import type { WirePost } from '@/components/wire/WirePostCard';
import { PublicWire, OpenInAppCta, WireComments, WireBackButton } from './PublicWire';

/**
 * app/wire/[id] - the PUBLIC, signed-out-safe page for a single wire.
 *
 * It renders the wire read-only in the SocialFi style and deep-links visitors
 * into the app. generateMetadata() produces real OpenGraph + Twitter card meta
 * so links preview correctly on X / Telegram / iMessage. All data is the real
 * wire pulled via the service client; nothing here is fabricated.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Embed-free author columns. We deliberately do NOT use a PostgREST embed
// (author:profiles!fkey(...)) here: a stale PostgREST relationship cache makes
// that embed 500/return null, which used to send getWire() → null → notFound(),
// i.e. every "open post" and every username/avatar tap dead-ended on the 404
// page. Fetching authors with a plain batched query removes that failure mode.
const AUTHOR_COLS = 'id,username,display_name,avatar_url,is_verified,show_success_rate';

function shapePrediction(raw: any): WirePost['prediction'] {
  if (!raw) return null;
  return {
    id: raw.id,
    symbol: raw.symbol,
    direction: raw.direction,
    target: Number(raw.target),
    priceAtCreate: raw.price_at_create != null ? Number(raw.price_at_create) : null,
    resolvesAt: raw.resolves_at,
    status: raw.status,
    agreeCount: raw.agree_count ?? 0,
    agreed: false,
  };
}

/** Fetch and shape a single wire (with author signals + prediction) or null. */
async function getWire(id: string): Promise<WirePost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sb = getSupabaseAdmin();

  // 1) The wire itself (embed-free).
  const { data, error } = await sb
    .from('wire_posts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;

  const post = data as any;

  // 2) The reposted original, if any (embed-free).
  if (post.repost_of) {
    const { data: orig } = await sb.from('wire_posts').select('*').eq('id', post.repost_of).maybeSingle();
    post.original = orig ?? null;
  }

  // 3) Authors, batched (embed-free) — the piece that used to fail as an embed.
  const authorIds = Array.from(new Set([post.author_id, post.original?.author_id].filter(Boolean)));
  const { data: authors } = await sb.from('profiles').select(AUTHOR_COLS).in('id', authorIds);
  const authorMap = new Map((authors ?? []).map((a: any) => [a.id, a]));
  post.author = authorMap.get(post.author_id) ?? null;
  if (post.original) post.original.author = authorMap.get(post.original.author_id) ?? null;

  const allIds = [post.id, post.original?.id].filter(Boolean);
  const [signals, { data: preds }, { data: reps }] = await Promise.all([
    computeAuthorSignals(sb, authorIds),
    sb.from('wire_predictions').select('*').in('post_id', allIds),
    // Real success rate (0-100) per author — the SAME badge shown on the
    // profile. Gated per-author by profiles.show_success_rate below.
    sb.from('user_reputation').select('user_id, success_rate').in('user_id', authorIds),
  ]);
  const predByPost = new Map<string, any>();
  for (const pr of preds ?? []) predByPost.set(pr.post_id, pr);
  const rateByUser = new Map<string, number>();
  for (const r of reps ?? []) if (r?.success_rate != null) rateByUser.set(r.user_id, Number(r.success_rate));

  // Only surface the rate when the author opted to show it (privacy parity
  // with the profile). null → the badge simply hides.
  const rateFor = (u: any) => (u?.show_success_rate ? rateByUser.get(u.id) ?? null : null);

  post.authorSignal = signals.has(post.author_id) ? signals.get(post.author_id) : null;
  post.authorSuccessRate = rateFor(post.author);
  post.prediction = shapePrediction(predByPost.get(post.id));
  if (post.original) {
    post.original.authorSignal = signals.has(post.original.author_id) ? signals.get(post.original.author_id) : null;
    post.original.authorSuccessRate = rateFor(post.original.author);
    post.original.prediction = shapePrediction(predByPost.get(post.original.id));
  }
  return post as WirePost;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getWire(id);
  const site = getSiteUrl();

  if (!post) {
    return {
      title: 'Wire not found · Naka Labs',
      description: 'This wire may have been removed or the link is invalid.',
    };
  }

  const shown = post.repost_of && post.original && !post.original.deleted_at ? post.original : post;
  const author = shown.author?.display_name || shown.author?.username || 'Someone';
  const snippet = (shown.body || '').replace(/\s+/g, ' ').trim();
  const title = `${author} on The Wire`;
  const description = snippet ? snippet.slice(0, 180) : `${author} posted on The Wire, the SocialFi feed on Naka Labs.`;
  const url = `${site}/wire/${post.id}`;

  const firstMedia =
    (Array.isArray(shown.media_urls) && shown.media_urls[0]) || shown.media_url || `${site}/steinz-logo-64.png`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: 'Naka Labs',
      images: [{ url: firstMedia }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [firstMedia],
    },
  };
}

export default async function PublicWirePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getWire(id);
  if (!post) notFound();

  return (
    <AuroraBackground fullHeight>
      <div className="min-h-screen px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-xl">
          <WireBackButton />
          <Link href="/dashboard?subtab=wire" className="inline-flex items-center gap-2 mb-5">
            <img src="/steinz-logo-64.png" alt="" className="w-7 h-7" />
            <span className="text-white font-semibold">The Wire</span>
            <span className="text-white/40 text-sm">· Naka Labs</span>
          </Link>

          <PublicWire post={post} />
          <WireComments postId={post.id} />
          <OpenInAppCta />

          <p className="text-center text-xs text-white/40 mt-4">
            Join The Wire, the SocialFi feed on Naka Labs. Real prices, real calls, real signal.
          </p>
        </div>
      </div>
    </AuroraBackground>
  );
}
