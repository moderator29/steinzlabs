import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §5.6 Context Feed — insider_wallet card. Detects wallets that bought
 * a token BEFORE its first DEX listing tx (or first_seen_at in
 * token_metadata, when available). Insiders get logged to
 * dune_insider_wallets with negative lead_time_hours.
 *
 * Honest constraint: a wallet receiving the token in a private transfer
 * counts as "owning before listing" — that's the definition of insider
 * we use. False positives can happen with airdrops or team allocations;
 * confidence is left implicit (the lead_time_hours magnitude tells the
 * UI how confident to be).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RecentBuy {
  wallet_address: string | null;
  to_token_address: string | null;
  timestamp: string;
  chain: string | null;
  usd_value: number | null;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Pull recent buys to consider.
  const { data: buys } = await admin
    .from('transactions')
    .select('wallet_address, to_token_address, timestamp, chain, usd_value')
    .eq('status', 'success')
    .gte('timestamp', since)
    .not('to_token_address', 'is', null)
    .gt('usd_value', 100)
    .order('timestamp', { ascending: true })
    .limit(5000)
    .returns<RecentBuy[]>();
  if (!buys || buys.length === 0) return cronResponse('insider-wallet-detector', startedAt, { detected: 0 });

  // Group by (chain, token) and find the earliest tx per token across the
  // window. The "listing tx" reference is the earlier of:
  //   * token_metadata.first_seen_at (if known)
  //   * the global earliest transaction we've recorded for that token
  const tokenKeys = Array.from(new Set(buys.map((b) => `${b.chain}::${b.to_token_address}`)));
  const refByKey = new Map<string, number>();              // earliest tx ms per token
  for (const b of buys) {
    const key = `${b.chain}::${b.to_token_address}`;
    const ts = new Date(b.timestamp).getTime();
    if (!refByKey.has(key) || ts < refByKey.get(key)!) refByKey.set(key, ts);
  }
  // Patch with token_metadata.first_seen_at where available.
  const tokenAddrs = tokenKeys.map((k) => k.split('::')[1]);
  const { data: meta } = await admin
    .from('token_metadata')
    .select('chain, address, first_seen_at, deployed_at')
    .in('address', tokenAddrs);
  for (const m of (meta ?? []) as Array<{ chain: string; address: string; first_seen_at: string | null; deployed_at: string | null }>) {
    const listed = m.first_seen_at ?? m.deployed_at;
    if (!listed) continue;
    const key = `${m.chain}::${m.address}`;
    const ts = new Date(listed).getTime();
    if (!refByKey.has(key) || ts < refByKey.get(key)!) refByKey.set(key, ts);
  }

  // Now: a wallet's buy is "insider" if its timestamp <= ref - 60s for
  // the same (chain, token). 60s grace handles cron timing skew.
  const inserts: Array<Record<string, unknown>> = [];
  for (const b of buys) {
    if (!b.wallet_address || !b.to_token_address || !b.chain) continue;
    const key = `${b.chain}::${b.to_token_address}`;
    const ref = refByKey.get(key);
    if (!ref) continue;
    const ts = new Date(b.timestamp).getTime();
    if (ts > ref - 60_000) continue;
    inserts.push({
      wallet_address: b.wallet_address,
      token_address: b.to_token_address,
      chain: b.chain,
      bought_at: b.timestamp,
      listed_at: new Date(ref).toISOString(),
      lead_time_hours: (ts - ref) / 3_600_000,
      buy_usd: b.usd_value ?? null,
    });
  }
  if (inserts.length === 0) return cronResponse('insider-wallet-detector', startedAt, { detected: 0 });

  const { error } = await admin
    .from('dune_insider_wallets')
    .upsert(inserts, { onConflict: 'wallet_address,token_address,chain', ignoreDuplicates: true });
  if (error) {
    Sentry.captureException(error, { tags: { cron: 'insider-wallet-detector' } });
    return cronResponse('insider-wallet-detector', startedAt, { error: error.message });
  }
  return cronResponse('insider-wallet-detector', startedAt, { detected: inserts.length });
}
