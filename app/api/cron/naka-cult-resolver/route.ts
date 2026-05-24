import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCron, cronResponse, logCronExecution, withCronErrorReporting } from '@/app/api/cron/_shared';

/**
 * Daily NAKA on-chain tier resolver.
 *
 * Owner spec (HANDOFF + auto-memory):
 *   NAKA token  : 0x6967b9a8c0b14849CFE8f9E5732B401433fD2898 (Ethereum mainnet)
 *   Threshold   : 1,227,000 NAKA (18 decimals)
 *   Action      : sweep all wallets we know about; upsert profiles.tier
 *                 to 'naka_cult' for any user holding >= threshold; revert
 *                 to 'free' (or last paid tier) for any user whose balance
 *                 dropped below.
 *
 * Without this cron, wallet-auth users (no email tier, no Stripe row) have
 * profiles.tier=NULL and the NakaCult gate always denies them — the
 * "NakaCult wallet flow doesn't work" bug owner reported.
 *
 * Sweeps in batches via Alchemy alchemy_getTokenBalances on a multicall
 * grouping of up to 100 addresses per request (Alchemy free-tier limit).
 *
 * Wired in vercel.json schedule (owner action: add cron entry after merge).
 * Runs daily at 03:13 UTC by convention so it doesn't collide with the
 * whale-backfill-pnl cron (03:00 UTC).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5min budget

const NAKA_TOKEN = (process.env.NEXT_PUBLIC_NAKA_TOKEN_ADDRESS ?? '0x6967b9a8c0b14849CFE8f9E5732B401433fD2898').toLowerCase();
const NAKA_DECIMALS = 18;
const THRESHOLD_NAKA = BigInt(process.env.NAKA_CULT_THRESHOLD ?? '1227000');
// threshold in raw units (18-decimal multiplier)
const THRESHOLD_RAW = THRESHOLD_NAKA * (BigInt(10) ** BigInt(NAKA_DECIMALS));

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? '';
const ALCHEMY_URL = ALCHEMY_KEY
  ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : '';

interface BalanceResult { address: string; balanceRaw: bigint }

async function getNakaBalances(addresses: string[]): Promise<BalanceResult[]> {
  if (!ALCHEMY_URL || addresses.length === 0) return [];
  // Alchemy doesn't accept N addresses in one call for alchemy_getTokenBalances;
  // we make one call per address but pipeline them with Promise.allSettled.
  const results = await Promise.allSettled(
    addresses.map(async (addr) => {
      const res = await fetch(ALCHEMY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [addr, [NAKA_TOKEN]],
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`alchemy ${res.status}`);
      const json = await res.json() as {
        result?: { tokenBalances?: Array<{ tokenBalance: string | null }> };
      };
      const raw = json.result?.tokenBalances?.[0]?.tokenBalance ?? '0x0';
      return { address: addr, balanceRaw: BigInt(raw) } as BalanceResult;
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<BalanceResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}

interface WalletRow {
  user_id: string;
  address: string;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  return await withCronErrorReporting('naka-cult-resolver', startedAt, async () => {
    const supabase = getSupabaseAdmin();

    // Collect every (user_id, evm_address) tuple from the wallet identity
    // tables. We use user_wallets_v2 (JSONB) per CLAUDE.md schema gotchas.
    const { data: walletsV2 } = await supabase
      .from('user_wallets_v2')
      .select('user_id, wallets, default_address');

    const rows: WalletRow[] = [];
    for (const row of walletsV2 ?? []) {
      const wallets = (row as { user_id: string; wallets: unknown }).wallets;
      const userId = (row as { user_id: string }).user_id;
      if (!Array.isArray(wallets)) continue;
      for (const w of wallets as Array<{ address?: string; chain?: string }>) {
        if (!w?.address || typeof w.address !== 'string') continue;
        // Only EVM-shaped (0x...40 hex). NAKA is ETH mainnet only.
        if (!/^0x[a-fA-F0-9]{40}$/.test(w.address)) continue;
        rows.push({ user_id: userId, address: w.address.toLowerCase() });
      }
    }

    if (rows.length === 0) {
      await logCronExecution('naka-cult-resolver', 'success', Date.now() - startedAt, undefined, 0);
      return cronResponse('naka-cult-resolver', startedAt, { wallets: 0, qualified: 0 });
    }

    // Dedupe addresses (one user may have multiple wallet rows)
    const uniqueAddrs = Array.from(new Set(rows.map((r) => r.address)));

    // Chunk into batches of 50 to stay under Alchemy free-tier rate limits
    const CHUNK = 50;
    const balances: BalanceResult[] = [];
    for (let i = 0; i < uniqueAddrs.length; i += CHUNK) {
      const batch = uniqueAddrs.slice(i, i + CHUNK);
      const chunkResults = await getNakaBalances(batch);
      balances.push(...chunkResults);
    }

    // Build per-user TOTAL balance (sum across all their wallets), then
    // decide tier. A user with two wallets that each hold half-threshold
    // still qualifies — matches the owner's "multi-wallet aggregation"
    // intent from the audit.
    const balanceByAddr = new Map(balances.map((b) => [b.address, b.balanceRaw]));
    const totalByUser = new Map<string, bigint>();
    const ZERO = BigInt(0);
    for (const r of rows) {
      const bal = balanceByAddr.get(r.address) ?? ZERO;
      totalByUser.set(r.user_id, (totalByUser.get(r.user_id) ?? ZERO) + bal);
    }

    let qualified = 0;
    let revoked = 0;
    const nowIso = new Date().toISOString();

    for (const [userId, totalRaw] of totalByUser.entries()) {
      const meets = totalRaw >= THRESHOLD_RAW;
      // Read current tier so we only downgrade users who got their cult
      // tier from THIS resolver — paying tiers (mini/pro/max via Stripe)
      // must not be flipped to free by a balance drop.
      const { data: prof } = await supabase
        .from('profiles')
        .select('tier, tier_source')
        .eq('id', userId)
        .maybeSingle<{ tier: string | null; tier_source: string | null }>();

      const currentTier = prof?.tier ?? null;
      const tierSource = prof?.tier_source ?? null;

      if (meets) {
        if (currentTier !== 'naka_cult') {
          await supabase
            .from('profiles')
            .update({ tier: 'naka_cult', tier_source: 'naka_balance', tier_updated_at: nowIso })
            .eq('id', userId);
          qualified++;
        }
      } else if (currentTier === 'naka_cult' && tierSource === 'naka_balance') {
        // Only revoke cult tier if THIS resolver granted it.
        await supabase
          .from('profiles')
          .update({ tier: 'free', tier_source: null, tier_updated_at: nowIso })
          .eq('id', userId);
        revoked++;
      }
    }

    await logCronExecution(
      'naka-cult-resolver',
      'success',
      Date.now() - startedAt,
      undefined,
      qualified + revoked,
    );

    return cronResponse('naka-cult-resolver', startedAt, {
      wallets: uniqueAddrs.length,
      users: totalByUser.size,
      qualified,
      revoked,
    });
  });
}
