import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PriceAlertInput } from '@/lib/market/types';

// price_alerts schema (live): id, user_id, token_id, token_symbol, price,
// direction, notify_email, triggered, triggered_at, created_at.
// TS-side names target_price / is_triggered are mapped at this boundary so
// callers keep their existing shape without us pretending the DB columns
// match.
type Row = {
  id: string;
  user_id: string;
  token_id: string;
  token_symbol: string;
  price: number;
  direction: 'above' | 'below';
  triggered: boolean;
  triggered_at: string | null;
  created_at: string;
  chain?: string | null;
};

function toApi(r: Row) {
  return {
    id: r.id,
    user_id: r.user_id,
    token_id: r.token_id,
    token_symbol: r.token_symbol,
    target_price: r.price,
    direction: r.direction,
    chain: r.chain ?? null,
    is_triggered: r.triggered,
    triggered_at: r.triggered_at ?? undefined,
    created_at: r.created_at,
  };
}

async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* no-op for route handler reads */ },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('triggered', false);
  return NextResponse.json({ alerts: (data ?? []).map((r) => toApi(r as Row)) });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const alert = (await req.json()) as PriceAlertInput;
    if (!alert?.token_id || typeof alert.target_price !== 'number') {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('price_alerts')
      .insert({
        user_id: userId,
        token_id: alert.token_id,
        token_symbol: alert.token_symbol,
        price: alert.target_price,
        direction: alert.direction,
        // Persist chain for EVM-address alerts so the monitor can resolve a
        // live price by chain+contract (memecoins aren't in the CG cache).
        chain: (alert as { chain?: string | null }).chain ?? null,
        triggered: false,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ alert: toApi(data as Row) });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getSupabaseAdmin();
  await db.from('price_alerts').delete().eq('id', id).eq('user_id', userId);
  return NextResponse.json({ success: true });
}
