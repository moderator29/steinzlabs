import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Sandwich Forensics — how much MEV was extracted FROM a wallet's own swaps.
// Real data from mev_events (ZeroMEV, Ethereum, 30d rolling). Honest empty when
// a wallet has no recorded MEV loss (that's good news, not missing data).
export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get('address') || '').trim().toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'valid EVM address required' }, { status: 400 });
  }
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('mev_events')
      .select('tx_hash, block_number, mev_type, loss_usd, block_time')
      .eq('victim_address', address)
      .order('loss_usd', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });

    const events = (data ?? []) as Array<{ tx_hash: string; block_number: number; mev_type: string; loss_usd: number; block_time: string }>;
    const totalLossUsd = events.reduce((s, e) => s + Number(e.loss_usd || 0), 0);
    const sandwichCount = events.filter((e) => e.mev_type === 'sandwich').length;
    const frontrunCount = events.filter((e) => e.mev_type === 'frontrun').length;

    return NextResponse.json({
      address,
      chain: 'ethereum',
      source: 'zeromev',
      windowDays: 30,
      totalLossUsd: Math.round(totalLossUsd),
      eventCount: events.length,
      sandwichCount,
      frontrunCount,
      worstLossUsd: events.length ? Math.round(Number(events[0].loss_usd)) : 0,
      events: events.slice(0, 25),
    }, { headers: { 'Cache-Control': 'private, max-age=120' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 502 });
  }
}
