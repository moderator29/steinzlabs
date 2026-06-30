import 'server-only';
import { NextResponse } from 'next/server';
import { buildEvmWalletIntelligence } from '@/lib/services/evm-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Chains we aggregate across. The primary wallet-intelligence call already
// warms the cache for whichever chain the user is viewing, so that one is a
// cache hit here and only the rest hit the network.
const AGGREGATE_CHAINS = ['ethereum', 'base', 'arbitrum', 'polygon', 'avalanche', 'bsc'];

interface ChainBalance {
  chain: string;
  chainName: string;
  nativeSymbol: string;
  totalBalanceUsd: number;
  tokenCount: number;
  txCount: number;
  dataSource: 'alchemy' | 'zerion';
}

function isEvm(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Multi-chain aggregate balance for an EVM address. Fans out the real wallet
 * intelligence pipeline across every supported EVM chain in parallel and sums
 * the priced balances into one net-worth figure plus a per-chain breakdown.
 * Each chain is best-effort (allSettled) so one slow RPC can't sink the whole
 * view, and chains with no balance are dropped rather than shown as zero noise.
 * Returns only real, priced data — never fabricated holdings.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    if (!address || !isEvm(address)) {
      return NextResponse.json({ error: 'EVM address required' }, { status: 400 });
    }

    const settled = await Promise.allSettled(
      AGGREGATE_CHAINS.map(chain => buildEvmWalletIntelligence(address, chain)),
    );

    const breakdown: ChainBalance[] = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status !== 'fulfilled') continue;
      const intel = r.value;
      const bal = intel.totalBalanceUSD ?? 0;
      // Skip chains the wallet has never touched / holds nothing priced on.
      if (bal <= 0 && intel.txCount === 0) continue;
      breakdown.push({
        chain: AGGREGATE_CHAINS[i],
        chainName: intel.chainName,
        nativeSymbol: intel.nativeSymbol,
        totalBalanceUsd: bal,
        tokenCount: intel.tokens.filter(t => (t.valueUSD ?? 0) > 0).length,
        txCount: intel.txCount,
        dataSource: intel.dataSource,
      });
    }

    breakdown.sort((a, b) => b.totalBalanceUsd - a.totalBalanceUsd);
    const totalUsd = breakdown.reduce((s, c) => s + c.totalBalanceUsd, 0);

    return NextResponse.json(
      {
        address,
        totalUsd,
        chainsWithBalance: breakdown.filter(c => c.totalBalanceUsd > 0).length,
        chainsScanned: AGGREGATE_CHAINS.length,
        breakdown,
      },
      { headers: { 'Cache-Control': 'public, max-age=30' } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to aggregate balances';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
