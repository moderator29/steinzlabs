import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * OV2: "What changed since last login" digest.
 *
 * Looks up the user's prior last_login_at (the value before today's
 * session refreshed it), counts new alerts and watchlist movers in the
 * window, and returns a small payload the dashboard banner renders.
 *
 * Returns null fields when the user has no prior login on record so the
 * banner can stay hidden instead of saying "0 things changed".
 */

export const runtime = 'nodejs';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

export async function GET(_req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  // The dashboard updates last_login_at on visit, so the value sitting
  // in the profiles row right now IS the start of the new session. We
  // need the PREVIOUS value — best available is the second-most-recent
  // login_activity row.
  const { data: logins } = await admin
    .from('login_activity')
    .select('occurred_at')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false })
    .limit(2);
  const previousLoginAt = logins && logins.length >= 2 ? (logins[1] as { occurred_at: string }).occurred_at : null;
  if (!previousLoginAt) {
    return NextResponse.json({ previousLoginAt: null, newAlerts: null, watchlistMovers: null });
  }

  // Alerts that triggered since the prior login.
  const { count: newAlertCount } = await admin
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('triggered', true)
    .gt('triggered_at', previousLoginAt);

  // Watchlist movers: tokens on the user's watchlist whose 24h change
  // exceeded ±10% inside the window. We snapshot via the existing
  // market_stats_snapshot table if present; otherwise return 0.
  let watchlistMovers = 0;
  try {
    const { data: watchlist } = await admin
      .from('watchlist')
      .select('token_id')
      .eq('user_id', user.id);
    const ids = (watchlist ?? []).map((w: { token_id: string | null }) => w.token_id).filter((s): s is string => Boolean(s));
    if (ids.length > 0) {
      const { data: moverRows } = await admin
        .from('market_stats_snapshot')
        .select('token_id, price_change_24h, snapshot_at')
        .in('token_id', ids)
        .gt('snapshot_at', previousLoginAt)
        .order('snapshot_at', { ascending: false });
      const seen = new Set<string>();
      for (const r of (moverRows ?? []) as Array<{ token_id: string; price_change_24h: number | null }>) {
        if (seen.has(r.token_id)) continue;
        seen.add(r.token_id);
        if (typeof r.price_change_24h === 'number' && Math.abs(r.price_change_24h) >= 10) {
          watchlistMovers += 1;
        }
      }
    }
  } catch { /* table absent on this project — degrade silently */ }

  return NextResponse.json({
    previousLoginAt,
    newAlerts: newAlertCount ?? 0,
    watchlistMovers,
  });
}
