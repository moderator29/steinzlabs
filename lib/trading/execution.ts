import { jupiterAPI } from './jupiter';
import { TradeQuote, TradeExecution } from './types';
import { shadowGuardian } from '../security/shadowGuardian';
import { savePosition, getUserByWallet } from '../database/supabase';
import { calculateFee, recordRevenue } from '../revenue/feeSystem';
import { PLATFORM_FEE_BPS } from './swapLogging';

// 0x native-asset sentinel. When the buy side is native (e.g. buying ETH),
// 0x v2 rejects it as the fee token, so the fee is taken in the sell token.
const ZX_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
import { getTokenMetadata } from '../services/alchemy';
import { getTokenPairs } from '../services/dexscreener';
import { getEvmTokenDecimals } from '../sniper/priceFeed';

// Resolve a token's REAL decimals (native = 18; on-chain read with an 18
// fallback). The old code assumed 18 everywhere, which mis-scaled any
// non-18-decimal token (USDC = 6, WBTC = 8) by orders of magnitude in the
// amount sent to 0x, so copy-trading / DCA / limit orders of those tokens
// quoted and executed the wrong size.
async function resolveDec(chain: string, token: string): Promise<number> {
  if (!token || token.toLowerCase() === ZX_NATIVE) return 18;
  try { return await getEvmTokenDecimals(chain, token); } catch { return 18; }
}

// Human amount -> integer base-units string, precise at any decimals. String
// math avoids the float overflow of amount * 10**18 (imprecise above ~9).
function toBaseUnits(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  const [whole, frac = ''] = amount.toFixed(decimals).split('.');
  const digits = (whole + frac.padEnd(decimals, '0').slice(0, decimals)).replace(/^0+(?=\d)/, '');
  return digits || '0';
}

// Best-effort token symbol for the position/revenue records. Never blocks or
// fails the trade (this runs after execution succeeds); resolves the real
// symbol from Alchemy (EVM) then DexScreener (cross-chain incl. Solana), and
// falls back to a shortened address — an informative label, unlike the old
// hardcoded literal 'UNKNOWN'.
async function resolveTokenSymbol(address: string, chain: string): Promise<string> {
  try {
    const meta = await getTokenMetadata(address, chain).catch(() => null);
    if (meta?.symbol) return meta.symbol;
  } catch { /* fall through */ }
  try {
    const pairs = await getTokenPairs(address).catch(() => []);
    const sym = pairs.find((p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase())?.baseToken?.symbol
      ?? pairs[0]?.baseToken?.symbol;
    if (sym) return sym;
  } catch { /* fall through */ }
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

// 0x Protocol replaces 1inch for all EVM swaps
async function getZeroXQuote(
  chain: string,
  fromToken: string,
  toToken: string,
  amountWei: string,
  slippage: number,
  fromDecimals: number
): Promise<TradeQuote> {
  const CHAIN_IDS: Record<string, number> = {
    ethereum: 1, base: 8453, arbitrum: 42161, polygon: 137,
    avalanche: 43114, bsc: 56, optimism: 10,
  };
  const chainId = CHAIN_IDS[chain];
  if (!chainId) throw new Error(`Unsupported chain for 0x: ${chain}`);

  const apiKey = process.env.NEXT_PUBLIC_ZX_API_KEY || process.env.ZX_API_KEY || '';
  const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
  const feeBps = String(process.env.NEXT_PUBLIC_STEINZ_FEE_BPS || PLATFORM_FEE_BPS);

  const params = new URLSearchParams({
    chainId: String(chainId),
    sellToken: fromToken,
    buyToken: toToken,
    sellAmount: amountWei,
  });
  if (feeRecipient) {
    // 0x v2 monetization params (v1 feeRecipient/buyTokenPercentageFee are
    // silently ignored by the v2 endpoints, i.e. no fee was collected).
    params.set('swapFeeRecipient', feeRecipient);
    params.set('swapFeeBps', feeBps);
    params.set('swapFeeToken', toToken.toLowerCase() === ZX_NATIVE ? fromToken : toToken);
  }

  const res = await fetch(`https://api.0x.org/swap/allowance-holder/price?${params}`, {
    headers: { '0x-api-key': apiKey, '0x-version': 'v2' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`0x price failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const buyDecimals = await resolveDec(chain, toToken);
  const toAmountHuman = (parseInt(data.buyAmount || '0') / 10 ** buyDecimals).toString();

  return {
    fromToken,
    toToken,
    fromAmount: (parseInt(amountWei) / 10 ** fromDecimals).toString(),
    toAmount: toAmountHuman,
    // USD legs aren't in the 0x quote and we don't price them here — empty, not a
    // fabricated "0". priceImpact uses 0x's REAL estimatedPriceImpact (percent);
    // 0 only if 0x genuinely omits it.
    fromAmountUSD: '',
    toAmountUSD: '',
    priceImpact: data.estimatedPriceImpact != null ? Number(data.estimatedPriceImpact) : 0,
    route: [{ protocol: '0x', fromToken, toToken, portion: 100 }],
    gasEstimate: (parseInt(data.gas || '200000') * 20e9 / 1e18).toFixed(6),
    chain,
    slippage,
    validUntil: Date.now() + 30000,
  };
}

export async function getOptimalQuote(params: {
  fromToken: string;
  toToken: string;
  amount: number;
  chain: string;
  slippage?: number;
}): Promise<TradeQuote> {
  const { fromToken, toToken, amount, chain, slippage = 0.5 } = params;

  if (chain === 'solana') {
    return jupiterAPI.getQuote(fromToken, toToken, amount, slippage * 100);
  } else {
    const fromDecimals = await resolveDec(chain, fromToken);
    const amountWei = toBaseUnits(amount, fromDecimals);
    return getZeroXQuote(chain, fromToken, toToken, amountWei, slippage, fromDecimals);
  }
}

export async function executeTrade(params: {
  quote: TradeQuote;
  userWallet: string;
  userAddress: string;
  chain: string;
  signTransaction: any;
  autoExit?: boolean;
  followingEntity?: string;
}): Promise<TradeExecution> {
  const { quote, userWallet, userAddress, chain, signTransaction, autoExit, followingEntity } = params;

  try {

    const scan = await shadowGuardian.scanTrade(
      quote.toToken,
      parseFloat(quote.toAmount),
      userWallet
    );

    if (scan.blocked) {

      return {
        success: false,
        error: `BLOCKED: ${scan.message}`,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        timestamp: new Date().toISOString(),
      };
    }



    let execution: TradeExecution;

    if (chain === 'solana') {
      execution = await jupiterAPI.executeSwap(quote, userAddress, signTransaction);
    } else {
      // 0x swap execution — get firm quote then sign
      try {
        const CHAIN_IDS: Record<string, number> = {
          ethereum: 1, base: 8453, arbitrum: 42161, polygon: 137,
          avalanche: 43114, bsc: 56, optimism: 10,
        };
        const chainId = CHAIN_IDS[chain];
        if (!chainId) throw new Error(`Unsupported chain: ${chain}`);

        const apiKey = process.env.NEXT_PUBLIC_ZX_API_KEY || process.env.ZX_API_KEY || '';
        const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
        const feeBps = String(process.env.NEXT_PUBLIC_STEINZ_FEE_BPS || PLATFORM_FEE_BPS);
        const fromDecimals = await resolveDec(chain, quote.fromToken);
        const amountWei = toBaseUnits(parseFloat(quote.fromAmount), fromDecimals);

        const params = new URLSearchParams({
          chainId: String(chainId),
          sellToken: quote.fromToken,
          buyToken: quote.toToken,
          sellAmount: amountWei,
          taker: userAddress,
        });
        if (feeRecipient) {
          // 0x v2 monetization params (v1 params are ignored on v2 -> no fee).
          params.set('swapFeeRecipient', feeRecipient);
          params.set('swapFeeBps', feeBps);
          params.set('swapFeeToken', quote.toToken.toLowerCase() === ZX_NATIVE ? quote.fromToken : quote.toToken);
        }

        const quoteRes = await fetch(`https://api.0x.org/swap/allowance-holder/quote?${params}`, {
          headers: { '0x-api-key': apiKey, '0x-version': 'v2' },
        });
        if (!quoteRes.ok) throw new Error(`0x quote failed: ${quoteRes.status}`);
        const quoteData = await quoteRes.json();

        const txData = quoteData.transaction;
        const txHash = await signTransaction(txData);

        execution = {
          success: true,
          txHash,
          fromToken: quote.fromToken,
          toToken: quote.toToken,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          gasUsed: txData?.gas?.toString() || '0',
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const e = error as { message?: string };
        execution = {
          success: false,
          error: e.message || '0x swap execution failed',
          fromToken: quote.fromToken,
          toToken: quote.toToken,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          timestamp: new Date().toISOString(),
        };
      }
    }

    if (execution.success && userWallet) {
      const user = await getUserByWallet(userWallet);
      if (user) {
        const tradeType = followingEntity ? 'COPY_TRADE' as const : 'SWAP' as const;
        const fee = calculateFee(parseFloat(quote.fromAmount), tradeType, chain);
        const toSymbol = await resolveTokenSymbol(quote.toToken, chain);

        await savePosition({
          userId: user.id,
          tokenAddress: quote.toToken,
          tokenSymbol: toSymbol,
          chain,
          entryPrice: parseFloat(quote.fromAmount) / parseFloat(quote.toAmount),
          amount: parseFloat(quote.toAmount),
          valueUsd: parseFloat(quote.toAmountUSD || '0'),
          autoExitEnabled: autoExit,
          followingEntity,
        });

        await recordRevenue({
          userId: user.id,
          tradeType,
          tokenAddress: quote.toToken,
          tokenSymbol: toSymbol,
          chain,
          tradeAmount: quote.fromAmount,
          feeAmount: fee.feeAmount,
          feeBps: fee.feeBps,
          txHash: execution.txHash || '',
        });


      }
    }

    return execution;
  } catch (error: any) {

    return {
      success: false,
      error: error.message || 'Trade execution failed',
      fromToken: quote.fromToken,
      toToken: quote.toToken,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      timestamp: new Date().toISOString(),
    };
  }
}
