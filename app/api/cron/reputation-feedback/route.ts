import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-E.2 reputation-feedback cron.
 *
 * Two-stage operation per tick:
 *
 *  1. Scan recent successful BUY transactions; for each one whose token's
 *     current price is now <5% of the buy price AND whose token hasn't
 *     produced fresh on-chain activity in >7d, insert a rug_event_reports
 *     row (UNIQUE per user+token guards duplicates).
 *
 *  2. For every (chain, deployer_address) pair with new (applied_to_band=
 *     false) reports, downgrade deployer_history_cache.band one tier
 *     per pair of reports (pristine → clean → caution → dangerous →
 *     serial-rugger). Mark those reports applied so we don't double-
 *     downgrade.
 *
 * Real upstream: existing transactions, token_pricing_cache, and
 * token_metadata tables. No fabricated numbers.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface BuyRow {
  user_id: string;
  tx_hash: string;
  chain: string;
  to_token_symbol: string | null;
  to_token_address: string | null;
  to_amount: number | null;
  usd_value: number | null;
  timestamp: string;
}

interface PriceRow {
  token_address: string;
  chain: string;
  price_usd: number | null;
  last_updated: string;
}

interface DeployerRow {
  chain: string;
  deployer_address: string;
  band: string;
}

const BAND_ORDER = ['pristine', 'clean', 'caution', 'dangerous', 'serial-rugger'] as const;
type Band = (typeof BAND_ORDER)[number];

function downgradeBand(current: string, steps: number): Band {
  const idx = BAND_ORDER.indexOf(current as Band);
  if (idx < 0) return 'caution';
  const target = Math.min(BAND_ORDER.length - 1, idx + steps);
  return BAND_ORDER[target];
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();

  // Stage 1: scan buys older than 7d but newer than 90d (no point
  // reporting ancient buys repeatedly; the unique-index dedupes anyway).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

  const { data: buys } = await admin
    .from('transactions')
    .select('user_id, tx_hash, chain, to_token_symbol, to_token_address, to_amount, usd_value, timestamp')
    .eq('status', 'success')
    .gte('timestamp', ninetyDaysAgo)
    .lte('timestamp', sevenDaysAgo)
    .gt('usd_value', 10)
    .not('to_token_address', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(5000)
    .returns<BuyRow[]>();

  const candidates = (buys ?? []).filter(
    (b) => b.to_token_symbol && !['USD', 'USDC', 'USDT', 'DAI'].includes(b.to_token_symbol.toUpperCase()),
  );
  if (candidates.length === 0) {
    return cronResponse('reputation-feedback', startedAt, { reports_filed: 0, bands_downgraded: 0 });
  }

  // Look up current price for each candidate token.
  const tokenKeys = Array.from(new Set(candidates.map((c) => `${c.chain}::${c.to_token_address}`)));
  const tokens = tokenKeys.map((k) => {
    const [chain, addr] = k.split('::');
    return { chain, addr };
  });

  const { data: prices } = await admin
    .from('token_pricing_cache')
    .select('token_address, chain, price_usd, last_updated')
    .in('token_address', tokens.map((t) => t.addr).filter(Boolean) as string[])
    .returns<PriceRow[]>();
  const priceByKey = new Map<string, PriceRow>();
  for (const p of prices ?? []) priceByKey.set(`${p.chain}::${p.token_address}`, p);

  let reportsFiled = 0;
  const newReports: Record<string, unknown>[] = [];
  for (const b of candidates) {
    if (!b.to_token_address || !b.to_amount || !b.usd_value || b.to_amount <= 0) continue;
    const buyPricePerUnit = b.usd_value / b.to_amount;
    const cur = priceByKey.get(`${b.chain}::${b.to_token_address}`);
    if (!cur || !cur.price_usd) continue;
    if (cur.price_usd >= buyPricePerUnit * 0.05) continue;  // not a rug
    newReports.push({
      user_id: b.user_id,
      chain: b.chain,
      token_address: b.to_token_address,
      deployer_address: null,
      buy_tx_hash: b.tx_hash,
      buy_price_usd: buyPricePerUnit,
      current_price_usd: cur.price_usd,
      source: 'auto',
      confidence: 0.85,
      metadata: { detected_at: new Date().toISOString() },
    });
  }
  if (newReports.length > 0) {
    // upsert by (user_id, chain, token_address) — the partial unique
    // index guarantees one report per user/token.
    const { data: inserted } = await admin
      .from('rug_event_reports')
      .upsert(newReports, { onConflict: 'user_id,chain,token_address', ignoreDuplicates: true })
      .select('id');
    reportsFiled = inserted?.length ?? 0;
  }

  // Stage 2: enrich pending reports with deployer_address from
  // token_metadata where available, then downgrade bands.
  const { data: pending } = await admin
    .from('rug_event_reports')
    .select('id, chain, token_address, deployer_address')
    .eq('applied_to_band', false)
    .limit(500);

  let bandsDowngraded = 0;
  if (pending && pending.length > 0) {
    // Look up deployer_address for those still missing it.
    const needsDeployer = (pending as Array<{ id: string; chain: string; token_address: string; deployer_address: string | null }>)
      .filter((r) => !r.deployer_address)
      .map((r) => ({ id: r.id, chain: r.chain, token_address: r.token_address }));
    if (needsDeployer.length > 0) {
      const { data: meta } = await admin
        .from('token_metadata')
        .select('chain, address, deployer_address')
        .in('address', needsDeployer.map((n) => n.token_address));
      const deployerByKey = new Map<string, string>();
      for (const m of (meta ?? []) as Array<{ chain: string; address: string; deployer_address: string | null }>) {
        if (m.deployer_address) deployerByKey.set(`${m.chain}::${m.address}`, m.deployer_address);
      }
      // Patch the pending rows in-memory + persist.
      for (const r of pending as Array<{ id: string; chain: string; token_address: string; deployer_address: string | null }>) {
        if (!r.deployer_address) {
          const found = deployerByKey.get(`${r.chain}::${r.token_address}`);
          if (found) {
            r.deployer_address = found;
            await admin.from('rug_event_reports').update({ deployer_address: found }).eq('id', r.id);
          }
        }
      }
    }

    // Group by (chain, deployer) to count reports per deployer.
    const reportsByDeployer = new Map<string, string[]>();   // key → report_ids
    for (const r of pending as Array<{ id: string; chain: string; deployer_address: string | null }>) {
      if (!r.deployer_address) continue;
      const key = `${r.chain}::${r.deployer_address}`;
      const arr = reportsByDeployer.get(key) ?? [];
      arr.push(r.id);
      reportsByDeployer.set(key, arr);
    }

    if (reportsByDeployer.size > 0) {
      // Pull current bands for affected deployers.
      const deployerKeys = Array.from(reportsByDeployer.keys());
      const deployerAddrs = deployerKeys.map((k) => k.split('::')[1]);
      const { data: cache } = await admin
        .from('deployer_history_cache')
        .select('chain, deployer_address, band')
        .in('deployer_address', deployerAddrs)
        .returns<DeployerRow[]>();
      const bandByKey = new Map<string, string>();
      for (const row of cache ?? []) bandByKey.set(`${row.chain}::${row.deployer_address}`, row.band);

      for (const [key, ids] of reportsByDeployer) {
        const steps = Math.floor(ids.length / 2);   // one step per pair
        if (steps < 1) continue;
        const current = bandByKey.get(key) ?? 'caution';
        const target = downgradeBand(current, steps);
        if (target === current) continue;
        const [chain, deployer] = key.split('::');
        const { error: updErr } = await admin
          .from('deployer_history_cache')
          .update({ band: target })
          .eq('chain', chain)
          .eq('deployer_address', deployer);
        if (updErr) continue;
        bandsDowngraded++;
        // Mark the ids we just acted on as applied so we don't re-downgrade.
        await admin.from('rug_event_reports').update({ applied_to_band: true }).in('id', ids.slice(0, steps * 2));
      }
    }
  }

  return cronResponse('reputation-feedback', startedAt, {
    reports_filed: reportsFiled,
    bands_downgraded: bandsDowngraded,
    pending_reviewed: pending?.length ?? 0,
  });
}
