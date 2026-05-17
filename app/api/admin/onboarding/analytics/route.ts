import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/onboarding/analytics
 *
 * Funnel: per-card view count, click-through, skip-rate. Plus per-
 * variant rollup so A/B copy tests are evaluable. Last 30 days.
 */

export async function GET(req: NextRequest) {
  const adminId = await verifyAdminRequest(req);
  if (!adminId) return unauthorizedResponse();
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('onboarding_events')
    .select('event, card_index, variant, created_at')
    .gte('created_at', since)
    .limit(50000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byCard: Record<number, { viewed: number; next: number; skipClicked: number; skipConfirmed: number; completed: number }> = {};
  const byVariant: Record<string, { viewed: number; completed: number; skipConfirmed: number }> = { a: { viewed: 0, completed: 0, skipConfirmed: 0 }, b: { viewed: 0, completed: 0, skipConfirmed: 0 } };

  for (const e of data ?? []) {
    const idx = e.card_index ?? 0;
    if (!byCard[idx]) byCard[idx] = { viewed: 0, next: 0, skipClicked: 0, skipConfirmed: 0, completed: 0 };
    if (e.event === 'viewed') byCard[idx].viewed += 1;
    else if (e.event === 'clicked_next') byCard[idx].next += 1;
    else if (e.event === 'clicked_skip') byCard[idx].skipClicked += 1;
    else if (e.event === 'skip_confirmed') byCard[idx].skipConfirmed += 1;
    else if (e.event === 'completed') byCard[idx].completed += 1;

    const variant = (e.variant === 'a' || e.variant === 'b') ? e.variant : null;
    if (variant) {
      if (e.event === 'viewed') byVariant[variant].viewed += 1;
      else if (e.event === 'completed') byVariant[variant].completed += 1;
      else if (e.event === 'skip_confirmed') byVariant[variant].skipConfirmed += 1;
    }
  }

  const cardSummaries = Object.entries(byCard)
    .map(([k, v]) => ({ card_index: Number(k), ...v }))
    .sort((a, b) => a.card_index - b.card_index);

  return NextResponse.json({
    window_days: 30,
    cards: cardSummaries,
    variants: {
      a: { ...byVariant.a, completion_rate: byVariant.a.viewed > 0 ? byVariant.a.completed / byVariant.a.viewed : 0 },
      b: { ...byVariant.b, completion_rate: byVariant.b.viewed > 0 ? byVariant.b.completed / byVariant.b.viewed : 0 },
    },
  });
}
