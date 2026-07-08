import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Unified transaction history for the signed-in user.
 *
 * Merges the three REAL on-platform sources, richest-first:
 *   1. `transactions`      — authoritative labeled ledger: real `usd_value`,
 *                            gas/platform fees, token logos, explorer_url.
 *   2. `swap_logs`         — raw swap executions (no USD trade value stored,
 *                            only fee_usd) for swaps not mirrored into (1).
 *   3. `sniper_executions` — snipe fills (buy_amount_usd, entry price).
 *
 * De-duplicated by tx_hash so a swap present in both `transactions` and
 * `swap_logs` is counted once, keeping the richer `transactions` row. USD /
 * fee fields are null (→ UI renders "—") when the source genuinely has no
 * value — never a fabricated $0.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPLORER_BASE: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  bsc: 'https://bscscan.com/tx/',
  avalanche: 'https://snowtrace.io/tx/',
  solana: 'https://solscan.io/tx/',
};

type TxStatus = 'pending' | 'confirmed' | 'failed';

function toStatus(raw: string | null | undefined): TxStatus {
  if (raw === 'failed' || raw === 'error') return 'failed';
  if (raw === 'confirmed' || raw === 'completed' || raw === 'success') return 'confirmed';
  return 'pending';
}

function explorerUrl(chain: string, hash: string | null | undefined, stored?: string | null): string | null {
  if (stored) return stored;
  if (!hash) return null;
  const base = EXPLORER_BASE[chain.toLowerCase()];
  return base ? `${base}${hash}` : null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface UnifiedTx {
  id: string;
  source: 'transactions' | 'swap_logs' | 'sniper_executions';
  type: 'swap' | 'snipe';
  fromToken?: string | null;
  toToken?: string | null;
  tokenSymbol?: string | null;
  fromLogo?: string | null;
  toLogo?: string | null;
  fromAmount?: string | null;
  toAmount?: string | null;
  amountUsd: number | null;
  feeUsd: number | null;
  gasFeeUsd: number | null;
  chain: string;
  status: TxStatus;
  txHash?: string | null;
  explorerUrl: string | null;
  createdAt: string;
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

export async function GET(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ transactions: [], error: 'unauthorized' }, { status: 401 });
  }

  const chainFilter = req.nextUrl.searchParams.get('chain');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 250);

  const admin = getSupabaseAdmin();

  // Read the three real sources in parallel. Each is independently fault-tolerant
  // so one table erroring never blanks the whole history.
  const [ledgerRes, swapRes, sniperRes] = await Promise.allSettled([
    (() => {
      let q = admin
        .from('transactions')
        .select('id, tx_hash, chain, type, from_token_symbol, to_token_symbol, from_token_logo, to_token_logo, from_amount, to_amount, usd_value, platform_fee_usd, gas_fee_usd, status, explorer_url, timestamp')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (chainFilter) q = q.eq('chain', chainFilter);
      return q;
    })(),
    admin.from('swap_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit),
    admin.from('sniper_executions').select('*').eq('user_id', user.id).order('executed_at', { ascending: false }).limit(limit),
  ]);

  const out: UnifiedTx[] = [];
  const seenHashes = new Set<string>();

  // 1. Authoritative ledger (richest — real USD, fees, logos).
  if (ledgerRes.status === 'fulfilled' && ledgerRes.value.data) {
    for (const r of ledgerRes.value.data as Record<string, unknown>[]) {
      const chain = String(r.chain ?? 'ethereum');
      const hash = (r.tx_hash as string | null) ?? null;
      if (hash) seenHashes.add(hash.toLowerCase());
      const gas = num(r.gas_fee_usd);
      const platform = num(r.platform_fee_usd);
      const feeUsd = gas === null && platform === null ? null : (gas ?? 0) + (platform ?? 0);
      out.push({
        id: `tx-${r.id}`,
        source: 'transactions',
        type: 'swap',
        fromToken: (r.from_token_symbol as string | null) ?? null,
        toToken: (r.to_token_symbol as string | null) ?? null,
        fromLogo: (r.from_token_logo as string | null) ?? null,
        toLogo: (r.to_token_logo as string | null) ?? null,
        fromAmount: r.from_amount != null ? String(r.from_amount) : null,
        toAmount: r.to_amount != null ? String(r.to_amount) : null,
        amountUsd: num(r.usd_value),
        feeUsd,
        gasFeeUsd: gas,
        chain,
        status: toStatus(r.status as string | null),
        txHash: hash,
        explorerUrl: explorerUrl(chain, hash, r.explorer_url as string | null),
        createdAt: String(r.timestamp),
      });
    }
  }

  // 2. swap_logs — only swaps NOT already represented in the ledger.
  if (swapRes.status === 'fulfilled' && swapRes.value.data) {
    for (const s of swapRes.value.data as Record<string, unknown>[]) {
      const hash = (s.tx_hash as string | null) ?? null;
      if (hash && seenHashes.has(hash.toLowerCase())) continue;
      if (hash) seenHashes.add(hash.toLowerCase());
      const chain = String(s.chain ?? 'ethereum');
      out.push({
        id: `swap-${s.id}`,
        source: 'swap_logs',
        type: 'swap',
        fromToken: (s.token_in as string | null) ?? null,
        toToken: (s.token_out as string | null) ?? null,
        fromAmount: s.amount_in != null ? String(s.amount_in) : null,
        toAmount: s.amount_out != null ? String(s.amount_out) : null,
        // swap_logs stores no USD trade value — only fee_usd. Honest null.
        amountUsd: null,
        feeUsd: num(s.fee_usd),
        gasFeeUsd: null,
        chain,
        status: toStatus(s.status as string | null),
        txHash: hash,
        explorerUrl: explorerUrl(chain, hash),
        createdAt: String(s.created_at),
      });
    }
  }

  // 3. sniper_executions — snipe fills (distinct type, never deduped away).
  if (sniperRes.status === 'fulfilled' && sniperRes.value.data) {
    for (const e of sniperRes.value.data as Record<string, unknown>[]) {
      const chain = String(e.chain ?? 'ethereum');
      const hash = (e.tx_hash as string | null) ?? null;
      out.push({
        id: `snipe-${e.id}`,
        source: 'sniper_executions',
        type: 'snipe',
        tokenSymbol: (e.token_symbol as string | null) ?? null,
        amountUsd: num(e.buy_amount_usd),
        feeUsd: null,
        gasFeeUsd: null,
        chain,
        status: toStatus(e.status as string | null),
        txHash: hash,
        explorerUrl: explorerUrl(chain, hash),
        createdAt: String(e.executed_at),
      });
    }
  }

  out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const sourcesUp = {
    transactions: ledgerRes.status === 'fulfilled',
    swap_logs: swapRes.status === 'fulfilled',
    sniper_executions: sniperRes.status === 'fulfilled',
  };

  return NextResponse.json(
    { transactions: out.slice(0, limit), count: out.length, sources: sourcesUp },
    { headers: { 'Cache-Control': 'private, max-age=15' } },
  );
}
