import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

/**
 * Feed / Wire moderation + stats.
 *
 * GET    /api/admin/feed  — headline counts, active posters and the top posts
 *                            by engagement (likes + reposts + gifts + replies).
 * DELETE /api/admin/feed  — soft-delete a post (sets wire_posts.deleted_at).
 *
 * Reads: wire_posts (id, author_id, body, media_url, like_count, repost_count,
 * reply_count, gift_count, gift_total_usd, created_at, deleted_at), plus a
 * profiles lookup for author display. There is no wire-post-level reports
 * table, so `postReportsSupported` is reported honestly as false.
 */

interface TopPost {
  id: string;
  author_id: string | null;
  body: string | null;
  like_count: number;
  repost_count: number;
  reply_count: number;
  gift_count: number;
  gift_total_usd: number;
  engagement: number;
  created_at: string;
  deleted_at: string | null;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const sb = getSupabaseAdmin();
    const now = Date.now();
    const day = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [totalRes, liveRes, deletedRes, day24Res, week7Res] = await Promise.all([
      sb.from('wire_posts').select('*', { count: 'exact', head: true }),
      sb.from('wire_posts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      sb.from('wire_posts').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      sb.from('wire_posts').select('*', { count: 'exact', head: true }).gte('created_at', day),
      sb.from('wire_posts').select('*', { count: 'exact', head: true }).gte('created_at', week),
    ]);

    // Active posters (distinct authors in the last 7 days).
    const { data: recentAuthors } = await sb
      .from('wire_posts')
      .select('author_id')
      .gte('created_at', week)
      .limit(20000);
    const activePosters = new Set<string>();
    for (const r of recentAuthors ?? []) {
      const a = (r as { author_id?: string }).author_id;
      if (a) activePosters.add(a);
    }

    // Top posts by engagement — pull a recent window and rank in memory so the
    // score can combine four counters that no single index sorts by.
    const { data: postRows } = await sb
      .from('wire_posts')
      .select('id, author_id, body, like_count, repost_count, reply_count, gift_count, gift_total_usd, created_at, deleted_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    const ranked: TopPost[] = (postRows ?? [])
      .map((p) => {
        const r = p as Record<string, unknown>;
        const like = Number(r.like_count) || 0;
        const repost = Number(r.repost_count) || 0;
        const reply = Number(r.reply_count) || 0;
        const gift = Number(r.gift_count) || 0;
        return {
          id: r.id as string,
          author_id: (r.author_id as string) ?? null,
          body: (r.body as string) ?? null,
          like_count: like,
          repost_count: repost,
          reply_count: reply,
          gift_count: gift,
          gift_total_usd: Number(r.gift_total_usd) || 0,
          engagement: like + repost + gift + reply,
          created_at: r.created_at as string,
          deleted_at: (r.deleted_at as string) ?? null,
          author: null,
        };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 15);

    const authorIds = Array.from(new Set(ranked.map((p) => p.author_id).filter(Boolean) as string[]));
    if (authorIds.length) {
      const { data: profiles } = await sb
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      for (const post of ranked) {
        const prof = post.author_id ? byId.get(post.author_id) : null;
        post.author = prof
          ? { username: prof.username, display_name: prof.display_name, avatar_url: prof.avatar_url }
          : null;
      }
    }

    return NextResponse.json({
      stats: {
        total_posts: totalRes.count ?? 0,
        live_posts: liveRes.count ?? 0,
        deleted_posts: deletedRes.count ?? 0,
        posts_24h: day24Res.count ?? 0,
        posts_7d: week7Res.count ?? 0,
        active_posters_7d: activePosters.size,
      },
      topPosts: ranked,
      // No wire-post-level reports table exists; user_reports targets accounts,
      // not posts. Surfaced honestly so the UI never implies a queue it can't fill.
      postReportsSupported: false,
    });
  } catch (err) {
    console.error('[admin/feed GET] Failed:', err);
    return NextResponse.json({
      stats: { total_posts: 0, live_posts: 0, deleted_posts: 0, posts_24h: 0, posts_7d: 0, active_posters_7d: 0 },
      topPosts: [],
      postReportsSupported: false,
    });
  }
}

export async function DELETE(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  let body: { post_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const postId = body.post_id;
  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'post_id required' }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from('wire_posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', postId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void logAdminAction({
      adminId,
      action: 'social_moderation',
      details: { kind: 'wire_post_delete', post_id: postId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/feed DELETE] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
