import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PriceAlertInput } from '@/lib/market/types';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ alerts: [] });
  const db = getSupabaseAdmin();
  const { data } = await db.from('price_alerts').select('*').eq('user_id', userId).eq('is_triggered', false);
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PriceAlertInput & { userId: string };
    const { userId, ...alert } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const db = getSupabaseAdmin();
    const { data, error } = await db.from('price_alerts').insert({
      user_id: userId,
      token_id: alert.token_id,
      token_symbol: alert.token_symbol,
      target_price: alert.target_price,
      direction: alert.direction,
      notify_email: alert.notify_email,
      is_triggered: false,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ alert: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getSupabaseAdmin();
  await db.from('price_alerts').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
