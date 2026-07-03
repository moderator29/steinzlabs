import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scoreUser } from '@/lib/reputation/scorer';
import { logCronExecution } from '../_shared';

/**
 * GET /api/cron/recompute-reputation
 *
 * Nightly Vercel cron. Hits every profile, runs the 5-component
 * scoreUser, upserts user_reputation. Authorized by CRON_SECRET
 * header so Vercel-cron can call it but random external traffic
 * cannot. Computes rank_overall + rank_followers as a post-pass
 * over the freshly-written success_rate values.
 *
 * Vercel cron config lives in vercel.json — schedule "0 5 * * *"
 * runs at 05:00 UTC daily.
 */

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // The daily dispatcher authenticates with `Authorization: Bearer <secret>`;
  // this route previously only accepted x-cron-secret/?secret, so it never
  // actually ran on schedule. Accept all three forms.
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const secret = bearer || req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const startedAt = Date.now();
  const sb = getSupabaseAdmin();
  const { data: users, error } = await sb.from('profiles').select('id');
  if (error) {
    await logCronExecution('recompute-reputation', 'failed', Date.now() - startedAt, error.message, 0);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (users ?? []).map((u) => u.id);
  let succeeded = 0;
  let failed = 0;

  // Batch in groups of 10 so we don't fire 1000+ concurrent fetches.
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    await Promise.all(batch.map(async (userId) => {
      try {
        const score = await scoreUser(userId);
        const upsertPayload = {
          user_id: userId,
          success_rate: score.success_rate,
          total_score: score.total_score,
          copy_trade_winrate: score.components.copy_trade_winrate,
          whale_pick_accuracy: score.components.whale_pick_accuracy,
          portfolio_perf_pct: score.components.portfolio_perf_pct,
          community_score: score.components.community_score ?? 0,
          activity_score: score.components.activity_score ?? 0,
          last_calculated_at: new Date().toISOString(),
        };
        await sb.from('user_reputation').upsert(upsertPayload, { onConflict: 'user_id' });
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }));
  }

  // Rank pass — order users by success_rate desc, assign rank_overall.
  // Skipped if 0 users were scored to avoid bulk-overwriting with NULLs.
  if (succeeded > 0) {
    const { data: ranks } = await sb
      .from('user_reputation')
      .select('user_id, success_rate')
      .order('success_rate', { ascending: false });
    if (ranks) {
      let i = 0;
      for (const r of ranks) {
        await sb.from('user_reputation').update({ rank_overall: ++i }).eq('user_id', r.user_id);
      }
    }
  }

  await logCronExecution('recompute-reputation', 'success', Date.now() - startedAt, undefined, succeeded);
  return NextResponse.json({ scanned: ids.length, succeeded, failed, ranked: succeeded > 0 });
}
