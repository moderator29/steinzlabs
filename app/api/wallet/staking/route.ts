import { NextRequest, NextResponse } from 'next/server';
import { getSolanaStakeAccounts } from '@/lib/services/alchemy-solana';

export const runtime = 'nodejs';

// GET /api/wallet/staking?address=<solana address>
// Returns the wallet's REAL native-SOL stake accounts (read from chain) plus the
// current network staking yield (from getInflationRate). Honest empties: an
// address with no stake accounts returns an empty list, never a fabricated one.
// EVM liquid staking (Lido etc.) is already visible as tokens in holdings, so
// this endpoint is Solana-native-stake only.

const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
  || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

async function getNetworkApy(): Promise<number | null> {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getInflationRate', params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: { total?: number } };
    // Network staking yield ≈ total inflation directed to stakers. Real value
    // from the chain; validator commission (~5-8%) reduces the net a little.
    return typeof data.result?.total === 'number' ? data.result.total * 100 : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address') || '';
  if (!address || address.startsWith('0x')) {
    return NextResponse.json({ accounts: [], totalStakedSol: 0, networkApyPct: null, note: 'solana_address_required' });
  }
  try {
    const [accounts, networkApyPct] = await Promise.all([
      getSolanaStakeAccounts(address),
      getNetworkApy(),
    ]);
    const totalStakedSol = accounts.reduce((s, a) => s + a.stakedSol, 0);
    return NextResponse.json(
      { accounts, totalStakedSol, networkApyPct },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch {
    return NextResponse.json({ accounts: [], totalStakedSol: 0, networkApyPct: null, error: 'staking_lookup_failed' }, { status: 502 });
  }
}
