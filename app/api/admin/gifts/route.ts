import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

/**
 * Wire gifts — tipping stats + recent activity.
 *
 * GET /api/admin/gifts
 *
 * Reads wire_gifts (id, sender_id, recipient_id, chain, token_symbol, amount,
 * amount_usd, tx_hash, status, created_at) and a profiles lookup for the
 * sender/recipient handles. Aggregates volume by chain and by status. All
 * zeros are honest when no gifts have been sent.
 */

interface RecentGift {
  id: string;
  sender_id: string | null;
  recipient_id: string | null;
  chain: string | null;
  token_symbol: string | null;
  amount: number;
  amount_usd: number;
  tx_hash: string | null;
  status: string | null;
  created_at: string;
  sender: string | null;
  recipient: string | null;
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const sb = getSupabaseAdmin();

    // Pull every gift's aggregatable fields. The gift ledger is small relative
    // to trade logs, so a single scan is cheaper than several count queries.
    const { data: allGifts } = await sb
      .from('wire_gifts')
      .select('chain, amount_usd, status')
      .limit(100000);

    let totalUsd = 0;
    const byChain = new Map<string, { count: number; volume: number }>();
    const byStatus = new Map<string, number>();
    for (const g of allGifts ?? []) {
      const r = g as { chain?: string; amount_usd?: number | string; status?: string };
      const usd = Number(r.amount_usd) || 0;
      totalUsd += usd;
      const chain = r.chain || 'unknown';
      const c = byChain.get(chain) || { count: 0, volume: 0 };
      c.count += 1;
      c.volume += usd;
      byChain.set(chain, c);
      const status = r.status || 'unknown';
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
    }

    // Recent feed.
    const { data: recentRows } = await sb
      .from('wire_gifts')
      .select('id, sender_id, recipient_id, chain, token_symbol, amount, amount_usd, tx_hash, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    const ids = Array.from(new Set(
      (recentRows ?? []).flatMap((r) => [
        (r as { sender_id?: string }).sender_id,
        (r as { recipient_id?: string }).recipient_id,
      ]).filter(Boolean) as string[],
    ));
    const { data: profiles } = ids.length
      ? await sb.from('profiles').select('id, username, display_name').in('id', ids)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username || p.display_name || null]));

    const recent: RecentGift[] = (recentRows ?? []).map((r) => {
      const g = r as Record<string, unknown>;
      return {
        id: g.id as string,
        sender_id: (g.sender_id as string) ?? null,
        recipient_id: (g.recipient_id as string) ?? null,
        chain: (g.chain as string) ?? null,
        token_symbol: (g.token_symbol as string) ?? null,
        amount: Number(g.amount) || 0,
        amount_usd: Number(g.amount_usd) || 0,
        tx_hash: (g.tx_hash as string) ?? null,
        status: (g.status as string) ?? null,
        created_at: g.created_at as string,
        sender: g.sender_id ? nameById.get(g.sender_id as string) ?? null : null,
        recipient: g.recipient_id ? nameById.get(g.recipient_id as string) ?? null : null,
      };
    });

    return NextResponse.json({
      stats: {
        total_gifts: allGifts?.length ?? 0,
        total_usd: totalUsd,
      },
      byChain: Array.from(byChain.entries())
        .map(([chain, v]) => ({ chain, count: v.count, volume: v.volume }))
        .sort((a, b) => b.volume - a.volume),
      byStatus: Array.from(byStatus.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      recent,
    });
  } catch (err) {
    console.error('[admin/gifts GET] Failed:', err);
    return NextResponse.json({ stats: { total_gifts: 0, total_usd: 0 }, byChain: [], byStatus: [], recent: [] });
  }
}
