import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { guardRoute } from '@/lib/api/guardRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-user VTX Sentinel CRUD backed by public.vtx_sentinels (RLS: owner-only).
 * A sentinel is an autonomous watch on a token or wallet; the vtx-sentinel cron
 * evaluates each one against live data and notifies on real change. This route
 * only manages the definitions — the intelligence lives in lib/sentinel.
 */

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* read-only in route handler */ },
      },
    },
  );
}

const isEvm = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);
const isSol = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);

const PostBody = z.object({
  targetType: z.enum(['token', 'wallet']),
  target: z.string().min(8).max(128),
  chain: z.enum(['solana', 'ethereum', 'base', 'bsc', 'arbitrum', 'polygon']),
  label: z.string().min(1).max(140).optional(),
});

const SELECT = 'id, target_type, target, chain, label, active, last_checked_at, last_snapshot, created_at';

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('vtx_sentinels')
    .select(SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sentinels: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await guardRoute(request, { rate: 'med' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PostBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
  const { targetType, chain, label } = parsed.data;
  const target = parsed.data.target.trim();

  if (!isEvm(target) && !isSol(target)) {
    return NextResponse.json({ error: 'Enter a valid token/wallet address (EVM 0x… or Solana).' }, { status: 400 });
  }
  const defaultLabel = `${targetType === 'token' ? 'Token' : 'Wallet'} ${target.slice(0, 6)}…${target.slice(-4)}`;

  const { data, error } = await supabase
    .from('vtx_sentinels')
    .upsert({
      user_id: user.id,
      target_type: targetType,
      target,
      chain,
      label: label || defaultLabel,
      active: true,
    }, { onConflict: 'user_id,target_type,target,chain' })
    .select(SELECT)
    .single();
  if (error) {
    // Unique-index conflict on a differently-cased target still means "already watching".
    if (error.code === '23505') return NextResponse.json({ error: 'You already have a sentinel on this target.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sentinel: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('vtx_sentinels').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
