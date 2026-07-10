import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSpotOne } from '@/lib/predict/priceFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The Wire - inline mini-predictions.
 *
 * POST /api/wire/predictions
 *   Attach a call to a wire the caller OWNS. Body:
 *     { postId, symbol, direction: 'above'|'below', target, horizonSeconds }
 *
 *   The creator is always the session user (never trusted from the client). We
 *   verify the caller authored the post, snapshot the real spot price from the
 *   shared price feed as price_at_create (null when genuinely unavailable, never
 *   fabricated), and set resolves_at = now + horizon. The prediction opens in
 *   status 'open'; outcomes are resolved later by a cron, not here.
 *
 * One prediction per wire (post_id is unique) - a second attach is rejected.
 */

// Horizon bounds: 1 minute to 30 days.
const MIN_HORIZON = 60;
const MAX_HORIZON = 30 * 24 * 3600;

const CreateBody = z.object({
  postId: z.string().uuid(),
  symbol: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9]{0,9}$/, 'Invalid symbol')
    .transform((s) => s.toUpperCase()),
  direction: z.enum(['above', 'below']),
  target: z.number().finite().positive('Target must be positive'),
  horizonSeconds: z.number().int().min(MIN_HORIZON).max(MAX_HORIZON),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }
  const { postId, symbol, direction, target, horizonSeconds } = parsed.data;

  const sb = getSupabaseAdmin();

  // The caller must own the post, and it must be a live top-level wire.
  const { data: post, error: postErr } = await sb
    .from('wire_posts')
    .select('id, author_id, deleted_at')
    .eq('id', postId)
    .maybeSingle();
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post || post.deleted_at) return NextResponse.json({ error: 'Wire not found' }, { status: 404 });
  if (post.author_id !== user.id) {
    return NextResponse.json({ error: 'You can only attach a call to your own wire' }, { status: 403 });
  }

  // Snapshot the real spot price. Unavailable => null (never invented).
  let priceAtCreate: number | null = null;
  try {
    const spot = await getSpotOne(symbol);
    if (spot && typeof spot.price === 'number' && Number.isFinite(spot.price)) {
      priceAtCreate = spot.price;
    }
  } catch {
    priceAtCreate = null;
  }

  const resolvesAt = new Date(Date.now() + horizonSeconds * 1000).toISOString();

  const { data, error } = await sb
    .from('wire_predictions')
    .insert({
      post_id: postId,
      creator_id: user.id,
      symbol,
      direction,
      target,
      price_at_create: priceAtCreate,
      horizon_seconds: horizonSeconds,
      resolves_at: resolvesAt,
      status: 'open',
    })
    .select('*')
    .single();

  if (error) {
    // 23505 = unique_violation (a call is already attached to this wire).
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'This wire already has a call' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    prediction: {
      id: data.id,
      symbol: data.symbol,
      direction: data.direction,
      target: Number(data.target),
      priceAtCreate: data.price_at_create != null ? Number(data.price_at_create) : null,
      resolvesAt: data.resolves_at,
      status: data.status,
      agreeCount: data.agree_count ?? 0,
      agreed: false,
    },
  });
}
