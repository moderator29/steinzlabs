import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenBalances, getTokenMetadata, getEthBalance } from '@/lib/services/alchemy';
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
    // getTokenBalances returns only contractAddress + raw tokenBalance (no
    // decimals/symbol/name), so decimals must be read from token metadata —
    // defaulting to 18 mis-scales USDC (6), WBTC (8), etc. by orders of
    // magnitude. Only non-zero balances need enrichment (a zero balance is
    // zero at any scale), which bounds the metadata fan-out to real holdings.
    const enriched = await Promise.all(balances.map(async (b) => {
      const raw = b.tokenBalance ?? '0';
      // Hex or decimal string; zero if it parses to 0. Avoid BigInt literals so
      // we stay within the project's compile target.
      const rawNum = Number(raw);
      const isZero = !Number.isFinite(rawNum) ? false : rawNum === 0;
      const meta = isZero ? null : await getTokenMetadata(b.contractAddress, chain).catch(() => null);
      const decimals = typeof meta?.decimals === 'number' ? meta.decimals : (b.decimals ?? 18);
      const ui = isZero ? 0 : Number(raw) / 10 ** decimals;
      return {
        contract_address: b.contractAddress,
        symbol: meta?.symbol ?? b.symbol ?? null,
        name: meta?.name ?? b.name ?? null,
        decimals,
        balance: raw,
        balance_ui: ui,
        logo_url: meta?.logo ?? b.logo ?? null,
      } satisfies TokenRow;
    }));
    rows.push(...enriched);
    return NextResponse.json({ chain, address, tokens: rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Balance fetch failed' }, { status: 500 });
  }
}
