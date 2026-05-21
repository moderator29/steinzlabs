import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * §3 P2-A.2 — drawing-tool persistence. The user_chart_drawings table
 * already exists from 2026_session5b1_batch1; this endpoint exposes
 * read/write so the chart's drawing toolbar can persist per (token, chain).
 *
 * GET  ?chain=ethereum&token=0x... → { drawings: [...] }
 * PUT  body { chain, token, drawings: [...] }  → { ok: true }
 *
 * RLS already enforces user_id = auth.uid(), so we don't need the admin
 * client here — the user's own client session is sufficient.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DrawingShape {
  type: string;
  points: Array<{ time: number; price: number }>;
  color?: string;
  thickness?: number;
  label?: string;
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

export async function GET(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const chain = req.nextUrl.searchParams.get('chain');
  const token = req.nextUrl.searchParams.get('token');
  if (!chain || !token) return NextResponse.json({ error: 'chain and token required' }, { status: 400 });

  const { data } = await sb
    .from('user_chart_drawings')
    .select('drawings,updated_at')
    .eq('user_id', user.id)
    .eq('chain', chain)
    .eq('token_address', token)
    .maybeSingle();

  return NextResponse.json({
    drawings: (data?.drawings as DrawingShape[] | null) ?? [],
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { chain?: string; token?: string; drawings?: DrawingShape[] };
  if (!body.chain || !body.token || !Array.isArray(body.drawings)) {
    return NextResponse.json({ error: 'chain, token, drawings[] required' }, { status: 400 });
  }
  if (body.drawings.length > 500) {
    return NextResponse.json({ error: 'Too many drawings (max 500)' }, { status: 400 });
  }

  const { error } = await sb
    .from('user_chart_drawings')
    .upsert({
      user_id: user.id,
      chain: body.chain,
      token_address: body.token,
      drawings: body.drawings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token_address,chain' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
