import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { resolveAssetPrice } from '@/lib/cult/convictionPrice';

export const runtime = 'nodejs';

interface PostPayload {
  asset?: unknown;
  chain?: unknown;
  direction?: unknown;
  thesis?: unknown;
}

interface ConvictionRow {
  id: string;
  user_id: string;
  asset: string;
  chain: string | null;
  direction: string;
  thesis: string | null;
  status: string;
  score: number | null;
  created_at: string;
  resolved_at: string | null;
}

async function withAuthors(admin: ReturnType<typeof getSupabaseAdmin>, rows: ConvictionRow[]) {
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const names = new Map<string, { name: string; isChosen: boolean }>();
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, username, display_name, is_chosen')
      .in('id', ids);
    for (const p of profiles ?? []) {
      names.set(p.id as string, {
        name: (p.display_name as string) || (p.username as string) || 'Cultist',
        isChosen: !!p.is_chosen,
      });
    }
  }
  return rows.map((r) => ({ ...r, author: names.get(r.user_id) ?? { name: 'Cultist', isChosen: false } }));
}

/**
 * GET /api/cult/conviction — the board (recent calls) + the leaderboard
 * (top scored calls). Any cult member may read.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = getSupabaseAdmin();
  const [{ data: recent }, { data: top }] = await Promise.all([
    admin.from('cult_convictions')
      .select('id, user_id, asset, chain, direction, thesis, status, score, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(40),
    admin.from('cult_convictions')
      .select('id, user_id, asset, chain, direction, thesis, status, score, created_at, resolved_at')
      .eq('status', 'scored')
      // Exclude un-scored rows and force NULLS LAST: Postgres orders NULLs
      // FIRST on DESC by default, which would float any scored-but-null row to
      // the TOP of "Top convictions" above real high scores.
      .not('score', 'is', null)
      .order('score', { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  return NextResponse.json({
    board: await withAuthors(admin, (recent ?? []) as ConvictionRow[]),
    leaderboard: await withAuthors(admin, (top ?? []) as ConvictionRow[]),
  });
}

/**
 * POST /api/cult/conviction — post a conviction call. Rate-limited 3/30s.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const rl = await rateLimit(`cult:conviction:${access.userId}`, { interval: 30_000, maxRequests: 3 });
  if (!rl.success) return rateLimitResponse(rl);

  let payload: PostPayload;
  try {
    payload = (await req.json()) as PostPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const asset = typeof payload.asset === 'string' ? payload.asset.trim() : '';
  const chain = typeof payload.chain === 'string' ? payload.chain.trim().toLowerCase() : '';
  const direction = payload.direction === 'short' ? 'short' : 'long';
  const thesis = typeof payload.thesis === 'string' ? payload.thesis.trim() : '';

  if (!asset) return NextResponse.json({ error: 'asset_required' }, { status: 400 });
  if (asset.length > 40) return NextResponse.json({ error: 'asset_too_long' }, { status: 400 });
  if (thesis.length > 500) return NextResponse.json({ error: 'thesis_too_long' }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Capture an entry price so the scoring cron can grade this call. Best-effort:
  // an unresolvable asset still posts, it just won't auto-score. Calls become
  // eligible to score 7 days after posting.
  const resolved = await resolveAssetPrice(asset, chain || null);
  const RESOLVE_WINDOW_DAYS = 7;

  const { data, error } = await admin
    .from('cult_convictions')
    .insert({
      user_id: access.userId,
      asset,
      chain: chain || null,
      direction,
      thesis: thesis || null,
      entry_price_usd: resolved?.priceUsd ?? null,
      pair_ref: resolved?.pairRef ?? null,
      pair_chain: resolved?.pairChain ?? null,
      resolve_at: new Date(Date.now() + RESOLVE_WINDOW_DAYS * 86_400_000).toISOString(),
    })
    .select('id, asset, direction, status, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conviction: data, priced: !!resolved }, { status: 201 });
}
