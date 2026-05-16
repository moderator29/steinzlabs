import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
import { buildClustersFromActivity } from '@/lib/clusters/orchestrator';
import type { ActivityRow } from '@/lib/clusters/detection';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

// Phase 8 — on-demand cluster analysis.
// Paste a wallet address: we pull its recent activity + all activity that touches
// it, then run the full 5-detector pipeline and return candidate clusters (with
// AI narrative). If persist=true and the cluster meets quality bars, we write
// edges/members so it appears in the directory.

export const runtime = 'nodejs';

export const POST = withTierGate('pro', async (request: NextRequest) => {
  let body: { address?: string; chain?: string; persist?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  // CLAUDE.md: normalize per chain (Solana case-sensitive). Falling back
  // to the trimmed input if normalize returns null preserves exact-match
  // queries against whale_activity rows that may not be EVM-style.
  const chain = body.chain || 'ethereum';
  const rawAddress = (body.address || '').trim();
  const address = normalizeAddress(rawAddress, chain) ?? rawAddress;
  const persist = !!body.persist;
  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  try {
    // Pull recent activity involving this address (as whale OR counterparty).
    const { data: selfActivity } = await supabase
      .from('whale_activity')
      .select('*')
      .eq('whale_address', address)
      .eq('chain', chain)
      .order('timestamp', { ascending: false })
      .limit(300);

    const { data: counterActivity } = await supabase
      .from('whale_activity')
      .select('*')
      .eq('counterparty', address)
      .eq('chain', chain)
      .order('timestamp', { ascending: false })
      .limit(300);

    // Grab neighbours' recent activity too — gives behavioral detector something to chew on.
    const neighbours = new Set<string>();
    for (const row of [...(selfActivity ?? []), ...(counterActivity ?? [])]) {
      if (row.counterparty) {
        const n = normalizeAddress(String(row.counterparty), chain) ?? String(row.counterparty);
        neighbours.add(n);
      }
      if (row.whale_address) {
        const n = normalizeAddress(String(row.whale_address), chain) ?? String(row.whale_address);
        neighbours.add(n);
      }
    }
    neighbours.delete(address);

    const neighbourList = Array.from(neighbours).slice(0, 40);
    let neighbourActivity: any[] = [];
    if (neighbourList.length > 0) {
      const { data } = await supabase
        .from('whale_activity')
        .select('*')
        .in('whale_address', neighbourList)
        .eq('chain', chain)
        .order('timestamp', { ascending: false })
        .limit(600);
      neighbourActivity = data ?? [];
    }

    const rows: ActivityRow[] = [
      ...(selfActivity ?? []),
      ...(counterActivity ?? []),
      ...neighbourActivity,
    ] as ActivityRow[];

    if (rows.length < 6) {
      return NextResponse.json({
        clusters: [],
        note: 'Insufficient on-chain activity for this address — try again after more whale_activity ingestion, or pick a more active wallet.',
      });
    }

    const clusters = await buildClustersFromActivity(rows, { minClusterSize: 3, persist });

    // Filter to clusters that include the requested address.
    const mine = clusters.filter((c) => c.members.includes(address));
    return NextResponse.json({
      clusters: mine.length > 0 ? mine : clusters.slice(0, 10),
      scanned_rows: rows.length,
      persist,
    });
  } catch (err) {
    console.error('[api/clusters/analyze]', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
});
