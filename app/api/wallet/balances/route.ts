import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenBalances, getEthBalance } from '@/lib/services/alchemy';
import { getSolanaWalletTokens } from '@/lib/services/alchemy-solana';

/**
 * GET /api/wallet/balances?address=<0x|solana>&chain=<ethereum|solana|polygon|bsc|base|arbitrum|optimism|avalanche>
 *
 * Real token auto-detection — replaces the previous mis-named
 * /api/token-scanner which is a security scanner not a balance lister.
 * EVM path: Alchemy getTokenBalances + native ETH balance.
 * Solana: getSolanaWalletTokens (Helius-backed).
 *
 * Cached 60s via Next revalidate to keep RPC cost down.
 */

const Q = z.object({
  address: z.string().min(8).max(128),
  chain: z.string().min(2).max(32).default('ethereum'),
});

interface TokenRow {
  contract_address: string | null;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  balance: string;
  balance_ui: number | null;
  logo_url?: string | null;
  is_native?: boolean;
}

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    address: req.nextUrl.searchParams.get('address'),
    chain: req.nextUrl.searchParams.get('chain') ?? 'ethereum',
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { address, chain } = parsed.data;

  try {
    if (chain === 'solana') {
      const tokens = await getSolanaWalletTokens(address);
      const rows: TokenRow[] = tokens.map((t) => ({
        contract_address: t.mint,
        symbol: t.symbol ?? null,
        name: t.name ?? null,
        decimals: t.decimals ?? null,
        balance: String(t.amount ?? '0'),
        balance_ui: typeof t.uiAmount === 'number' ? t.uiAmount : null,
        logo_url: (t as { logoUrl?: string | null }).logoUrl ?? null,
      }));
      return NextResponse.json({ chain, address, tokens: rows });
    }

    // EVM path
    const [nativeRaw, balances] = await Promise.all([
      getEthBalance(address, chain).catch(() => null),
      getTokenBalances(address, chain),
    ]);
    const rows: TokenRow[] = [];
    if (nativeRaw && typeof nativeRaw === 'object') {
      const wei = (nativeRaw as { wei?: string }).wei ?? null;
      const native = (nativeRaw as { native?: number }).native ?? null;
      if (wei !== null || native !== null) {
        rows.push({
          contract_address: null,
          symbol: chain === 'bsc' ? 'BNB' : chain === 'polygon' ? 'MATIC' : chain === 'avalanche' ? 'AVAX' : 'ETH',
          name: chain === 'bsc' ? 'BNB' : chain === 'polygon' ? 'Polygon' : chain === 'avalanche' ? 'Avalanche' : 'Ether',
          decimals: 18,
          balance: wei ?? '0',
          balance_ui: typeof native === 'number' ? native : null,
          is_native: true,
        });
      }
    }
    for (const b of balances) {
      const decimals = b.decimals ?? 18;
      const ui = b.tokenBalance ? Number(BigInt(b.tokenBalance)) / 10 ** decimals : null;
      rows.push({
        contract_address: b.contractAddress,
        symbol: b.symbol ?? null,
        name: b.name ?? null,
        decimals,
        balance: b.tokenBalance ?? '0',
        balance_ui: ui,
        logo_url: b.logo ?? null,
      });
    }
    return NextResponse.json({ chain, address, tokens: rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Balance fetch failed' }, { status: 500 });
  }
}
