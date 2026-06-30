import 'server-only';
import {
  getEvmWalletBuys, getEvmWalletSells,
  getSolanaWalletBuys, getSolanaWalletSells,
  isBitqueryEnabled,
} from '@/lib/services/bitquery';
import { computeWalletPnl, type WalletTrade, type WalletPnlResult } from './pnlAdapter';

/**
 * Build a wallet's realized PnL from its real DEX trade history (Bitquery
 * DEXTrades — each trade's AmountInUSD is the value AT TRADE TIME, so cost basis
 * is real, never fabricated from current prices). Returns null when Bitquery is
 * disabled or the wallet has no priced trades in the window. Fails closed.
 */
export async function buildWalletRealizedPnl(
  chain: string,
  address: string,
  sinceIso: string,
): Promise<WalletPnlResult | null> {
  if (!isBitqueryEnabled() || !address || !sinceIso) return null;
  const isSol = chain.toLowerCase() === 'solana';
  try {
    const [buys, sells] = await Promise.all([
      isSol ? getSolanaWalletBuys(address, sinceIso, 25) : getEvmWalletBuys(chain, address, sinceIso, 25),
      isSol ? getSolanaWalletSells(address, sinceIso, 25) : getEvmWalletSells(chain, address, sinceIso, 25),
    ]);

    const trades: WalletTrade[] = [];
    const add = (rows: typeof buys, side: 'buy' | 'sell') => {
      for (const b of rows) {
        if (b.valueUsd == null || !(b.amount > 0)) continue;
        const ts = Math.floor(new Date(b.timestamp).getTime() / 1000);
        if (!Number.isFinite(ts)) continue;
        trades.push({ token: b.tokenMint, tokenSymbol: b.tokenSymbol, side, amount: b.amount, valueUsd: b.valueUsd, timestamp: ts });
      }
    };
    add(buys, 'buy');
    add(sells, 'sell');
    if (trades.length === 0) return null;

    return computeWalletPnl(trades);
  } catch {
    return null;
  }
}
