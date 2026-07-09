import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

/**
 * Robinhood Chain — supported-chain status + gifting activity.
 *
 * GET /api/admin/robinhood-chain
 *
 * Robinhood Chain (canonical id 'robinhood', mainnet chain id 4663) is a
 * first-class supported chain. This surfaces any wire_gifts on chain='robinhood'
 * (count + USD volume + recent), and honestly reports zero activity when none.
 */

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const sb = getSupabaseAdmin();

    const { data: gifts } = await sb
      .from('wire_gifts')
      .select('id, sender_id, recipient_id, token_symbol, amount, amount_usd, tx_hash, status, created_at')
      .eq('chain', 'robinhood')
      .order('created_at', { ascending: false })
      .limit(2000);

    const rows = gifts ?? [];
    let volume = 0;
    for (const g of rows) volume += Number((g as { amount_usd?: number }).amount_usd) || 0;

    const ids = Array.from(new Set(
      rows.flatMap((r) => [
        (r as { sender_id?: string }).sender_id,
        (r as { recipient_id?: string }).recipient_id,
      ]).filter(Boolean) as string[],
    ));
    const { data: profiles } = ids.length
      ? await sb.from('profiles').select('id, username, display_name').in('id', ids)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username || p.display_name || null]));

    return NextResponse.json({
      chain: { id: 'robinhood', label: 'Robinhood Chain', short: 'HOOD', chainId: 4663, color: '#00C805' },
      stats: { gift_count: rows.length, volume_usd: volume },
      recent: rows.slice(0, 25).map((r) => {
        const g = r as Record<string, unknown>;
        return {
          id: g.id as string,
          token_symbol: (g.token_symbol as string) ?? null,
          amount: Number(g.amount) || 0,
          amount_usd: Number(g.amount_usd) || 0,
          tx_hash: (g.tx_hash as string) ?? null,
          status: (g.status as string) ?? null,
          created_at: g.created_at as string,
          sender: g.sender_id ? nameById.get(g.sender_id as string) ?? null : null,
          recipient: g.recipient_id ? nameById.get(g.recipient_id as string) ?? null : null,
        };
      }),
    });
  } catch (err) {
    console.error('[admin/robinhood-chain GET] Failed:', err);
    return NextResponse.json({
      chain: { id: 'robinhood', label: 'Robinhood Chain', short: 'HOOD', chainId: 4663, color: '#00C805' },
      stats: { gift_count: 0, volume_usd: 0 },
      recent: [],
    });
  }
}
