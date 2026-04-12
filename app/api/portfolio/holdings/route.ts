import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSolanaWalletTokens, getSolanaSOLBalance } from '@/lib/services/helius';
import { getEthBalance, getTokenBalances, getTokenMetadata } from '@/lib/services/alchemy';

interface Holding {
  address: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
}

async function getSolanaHoldings(wallet: string): Promise<Holding[]> {
  const [tokens, solBalance] = await Promise.all([
    getSolanaWalletTokens(wallet).catch(() => []),
    getSolanaSOLBalance(wallet).catch(() => 0),
  ]);

  const result: Holding[] = [
    { address: 'native', symbol: 'SOL', name: 'Solana', balance: solBalance, decimals: 9 },
  ];

  for (const t of tokens) {
    if ((t.uiAmount ?? 0) > 0) {
      result.push({
        address: t.mint,
        symbol: t.mint.slice(0, 6),
        name: 'SPL Token',
        balance: t.uiAmount ?? 0,
        decimals: t.decimals ?? 0,
      });
    }
  }

  return result;
}

async function getEVMHoldings(wallet: string, chain: string): Promise<Holding[]> {
  try {
    const [nativeBalStr, rawBalances] = await Promise.all([
      getEthBalance(wallet, chain).catch(() => '0'),
      getTokenBalances(wallet, chain).catch(() => []),
    ]);

    const nativeBalance = parseFloat(nativeBalStr);
    const nativeSym = chain === 'polygon' ? 'MATIC' : chain === 'avalanche' ? 'AVAX' : chain === 'bsc' ? 'BNB' : 'ETH';
    const result: Holding[] = [
      { address: 'native', symbol: nativeSym, name: nativeSym, balance: nativeBalance, decimals: 18 },
    ];

    const nonZero = rawBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0').slice(0, 20);
    const metaResults = await Promise.allSettled(
      nonZero.map(async b => {
        const meta = await getTokenMetadata(b.contractAddress, chain);
        const decimals = meta.decimals ?? 18;
        const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
        if (balance <= 0) return null;
        return { address: b.contractAddress, symbol: meta.symbol || 'UNKNOWN', name: meta.name || 'Unknown', balance, decimals } as Holding;
      })
    );

    for (const r of metaResults) {
      if (r.status === 'fulfilled' && r.value !== null) result.push(r.value);
    }

    return result;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const chain = (request.nextUrl.searchParams.get('chain') || 'solana').toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet parameter required' }, { status: 400 });
  }

  try {
    const holdings = chain === 'solana'
      ? await getSolanaHoldings(wallet)
      : await getEVMHoldings(wallet, chain);

    return NextResponse.json({ holdings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get holdings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
