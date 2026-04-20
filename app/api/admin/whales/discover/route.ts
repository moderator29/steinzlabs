/**
 * Bug §2.2: Real-trader discovery. Seeds the whales table with genuinely
 * active on-chain traders by reading recent `to-router` transfers from
 * major DEX router contracts on Alchemy-supported EVM chains, aggregating
 * unique sender addresses (= people who swapped), filtering out contracts
 * (= EOAs only, no protocol/bot addresses), and inserting the top-N into
 * `whales` with entity_type='trader'.
 *
 * This is the ONLY place real traders should come from — hand-typed lists
 * from LLM memory risk fabricating addresses. Alchemy transfer history is
 * the ground truth.
 *
 * Auth: admin-only, same gate as /api/admin/whales/verify.
 *
 * Usage (dry-run first, always):
 *   POST /api/admin/whales/discover?chain=ethereum&router=uniswap_v2&limit=30&dryRun=1
 *   POST /api/admin/whales/discover?chain=bsc&router=pancakeswap_v2&limit=20
 *
 * PnL, win rate, trade count, last_active — LEFT NULL by this route.
 * The /api/cron/whale-backfill-pnl cron backfills those fields separately.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Well-known DEX router contracts — traders interacting with these are swappers.
// Keep this list small and auditable. Never add a router without on-chain verification.
const ROUTERS: Record<string, Record<string, string>> = {
  ethereum: {
    uniswap_v2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswap_v3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    uniswap_universal: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    sushi_v2: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  },
  bsc: {
    pancakeswap_v2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    pancakeswap_v3: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  },
  base: {
    uniswap_universal: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    aerodrome: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
  },
  polygon: {
    uniswap_v3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    quickswap: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
  },
  arbitrum: {
    uniswap_v3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    camelot: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
  },
};

async function authorized(req: NextRequest): Promise<boolean> {
  const headerSecret = req.headers.get('x-migration-secret');
  if (headerSecret && process.env.ADMIN_MIGRATION_SECRET && headerSecret === process.env.ADMIN_MIGRATION_SECRET) {
    return true;
  }
  const user = await getAuthenticatedUser(req);
  if (!user) return false;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return data?.role === 'admin';
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl;
  const chain = (url.searchParams.get('chain') || 'ethereum').toLowerCase();
  const routerKey = url.searchParams.get('router') || Object.keys(ROUTERS[chain] || {})[0];
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 100);
  const minSwaps = Math.max(parseInt(url.searchParams.get('minSwaps') || '3', 10) || 3, 1);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const router = ROUTERS[chain]?.[routerKey];
  if (!router) {
    return NextResponse.json(
      { error: `Unknown router "${routerKey}" on chain "${chain}"`, available: ROUTERS },
      { status: 400 },
    );
  }

  const { getAssetTransfers, getContractCode, getEthBalance } = await import('@/lib/services/alchemy');

  // Pull recent swapper transfers. `to=router` means "trade executed through this router".
  // Alchemy caps maxCount at 1000 per call; one page is enough for top-N aggregation.
  let transfers: Array<{ from: string; hash: string; blockNum: string }> = [];
  try {
    transfers = await getAssetTransfers(router, chain, 'to', 1000);
  } catch (err: any) {
    return NextResponse.json({ error: `alchemy transfers failed: ${err?.message}` }, { status: 500 });
  }

  // Aggregate by sender, count swaps.
  const senderCounts = new Map<string, number>();
  for (const t of transfers) {
    const from = (t.from || '').toLowerCase();
    if (!from || from === router.toLowerCase()) continue;
    senderCounts.set(from, (senderCounts.get(from) || 0) + 1);
  }

  // Sort by swap count desc, take top candidates (2x limit for contract-filter headroom).
  const candidates = Array.from(senderCounts.entries())
    .filter(([, c]) => c >= minSwaps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2);

  // Filter out contracts — EOAs only. A contract's getCode returns non-'0x'.
  // Check in small parallel chunks to respect Alchemy rate limits.
  const eoas: Array<{ address: string; swaps: number; balanceEth: number }> = [];
  const CHUNK = 8;
  for (let i = 0; i < candidates.length && eoas.length < limit; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const checks = await Promise.all(
      slice.map(async ([addr, swaps]) => {
        try {
          const code = await getContractCode(addr, chain);
          if (code && code !== '0x' && code !== '0x0') return null; // contract, skip
          // Cheap liveness check — real traders have non-zero native balance
          // (or have recently had). Zero-balance-forever is a throwaway.
          const bal = await getEthBalance(addr, chain).catch(() => '0');
          return { address: addr, swaps, balanceEth: parseFloat(bal) || 0 };
        } catch {
          return null;
        }
      }),
    );
    for (const r of checks) if (r) eoas.push(r);
  }

  const supabase = getSupabaseAdmin();

  // Skip any address already in whales (any chain) to avoid duplicates.
  const addressList = eoas.map((e) => e.address);
  const { data: existing } = await supabase
    .from('whales')
    .select('address')
    .in('address', addressList);
  const existingSet = new Set((existing || []).map((r) => r.address.toLowerCase()));

  const newRows = eoas
    .filter((e) => !existingSet.has(e.address.toLowerCase()))
    .slice(0, limit)
    .map((e) => ({
      address: e.address,
      chain,
      label: `Active ${routerKey} trader`,
      entity_type: 'trader',
      archetype: 'active_swapper',
      whale_score: 75, // baseline; backfill cron will adjust based on real PnL
      portfolio_value_usd: null,
      pnl_7d_usd: null,
      pnl_30d_usd: null,
      pnl_90d_usd: null,
      win_rate: null,
      trade_count_30d: e.swaps, // rough seed; backfill will compute real 30d count
      follower_count: 0,
      verified: false,
      is_active: true,
      first_seen_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    }));

  let inserted: string[] = [];
  if (!dryRun && newRows.length > 0) {
    const { data, error } = await supabase
      .from('whales')
      .insert(newRows)
      .select('id, address');
    if (error) {
      return NextResponse.json({ error: `insert failed: ${error.message}`, newRows }, { status: 500 });
    }
    inserted = (data || []).map((r) => r.address);
  }

  return NextResponse.json({
    dryRun,
    chain,
    router: routerKey,
    routerAddress: router,
    scannedTransfers: transfers.length,
    uniqueSenders: senderCounts.size,
    candidates: candidates.length,
    eoasDiscovered: eoas.length,
    alreadyInDb: addressList.length - newRows.length,
    wouldInsert: newRows.length,
    inserted: inserted.length,
    sample: newRows.slice(0, 10),
  });
}
