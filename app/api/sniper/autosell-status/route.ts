import 'server-only';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

interface MonitoredPosition {
  id: string;
  token_address: string;
  token_symbol: string | null;
  chain: string | null;
  entry_price_usd: number | null;
  peak_price_usd: number | null;
  executed_at: string;
}

interface TriggeredStop {
  id: string;
  token_address: string;
  token_symbol: string | null;
  chain: string | null;
  pnl_usd: number | null;
  sell_dispatched_at: string | null;
  sell_tx_hash: string | null;
  realized_at: string | null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getSupabaseAdmin();
  try {
    const monitoredQ = db
      .from('sniper_executions')
      .select('id, token_address, token_symbol, chain, entry_price_usd, peak_price_usd, executed_at')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'executing'])
      .is('realized_at', null)
      .order('executed_at', { ascending: false })
      .limit(50);

    const triggeredQ = db
      .from('sniper_executions')
      .select('id, token_address, token_symbol, chain, pnl_usd, sell_dispatched_at, sell_tx_hash, realized_at')
      .eq('user_id', userId)
      .not('sell_dispatched_at', 'is', null)
      .order('sell_dispatched_at', { ascending: false })
      .limit(10);

    const [monitored, triggered] = await Promise.all([monitoredQ, triggeredQ]);

    return NextResponse.json({
      monitoring_active_count: monitored.data?.length ?? 0,
      monitored: (monitored.data ?? []) as MonitoredPosition[],
      stops_triggered: (triggered.data ?? []) as TriggeredStop[],
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'sniper/autosell-status' } });
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
