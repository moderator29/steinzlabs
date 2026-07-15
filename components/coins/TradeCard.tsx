'use client';

/**
 * In-flow buy/sell card for a coin. Non-custodial: it quotes through the real
 * swap price route and signs + broadcasts through the shared wallet signer
 * (useSwapExecution), so every trade is signed by the user's own wallet and
 * carries the platform fee. The wallet is auto-detected (built-in or imported);
 * there is no connect-wallet popup. Real numbers only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, Wallet as WalletIcon } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { useSwapExecution } from '@/lib/hooks/useSwapExecution';
import { getBuiltinWalletAddress } from '@/lib/wallet/builtinWallet';
import { FundButton } from './FundButton';
import type { Coin } from '@/lib/coins/types';
import { compactUsd, coinPrice } from '@/lib/coins/format';

const PLATFORM_FEE_BPS = Number(process.env.NEXT_PUBLIC_STEINZ_FEE_BPS) || 50;

const NATIVE: Record<string, { symbol: string; decimals: number }> = {
  solana: { symbol: 'SOL', decimals: 9 },
  ethereum: { symbol: 'ETH', decimals: 18 },
  bsc: { symbol: 'BNB', decimals: 18 },
};

const USD_PRESETS = [10, 25, 50, 100];
const PCT_PRESETS = [25, 50, 100];
const SLIPPAGE_BPS = 150;

type Side = 'buy' | 'sell';

export function TradeCard({ coin, livePrice, liveMcap, initialBuyUsd }: { coin: Coin; livePrice: number | null; liveMcap: number | null; initialBuyUsd?: number | null }) {
  const { address, balance } = useWallet();
  const native = NATIVE[coin.chain];
  const [side, setSide] = useState<Side>('buy');
  const [usd, setUsd] = useState<number>(initialBuyUsd && initialBuyUsd > 0 ? Math.round(initialBuyUsd) : 25);
  const [pct, setPct] = useState<number>(50);
  const [nativePriceUsd, setNativePriceUsd] = useState<number | null>(null);
  const [myTokens, setMyTokens] = useState<number>(0);
  const [done, setDone] = useState(false);
  const { quote, loading, executing, error, txHash, executedOutRaw, getQuote, executeSwap, reset, unlockRequest, resolveUnlock, cancelUnlock } = useSwapExecution();
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const price = livePrice ?? coin.priceUsd;

  // Native price (real, from the swap price route) so we can offer USD amounts.
  useEffect(() => {
    if (!native || !address) return;
    let alive = true;
    (async () => {
      try {
        const p = new URLSearchParams({ chain: coin.chain, from: native.symbol, to: 'USDC', amount: '1', taker: address, fromDecimals: String(native.decimals) });
        const r = await fetch(`/api/swap/price?${p.toString()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const v = typeof j?.toAmount === 'number' ? j.toAmount : Number(j?.toAmount);
        if (alive && Number.isFinite(v) && v > 0) setNativePriceUsd(v);
      } catch { /* leave null, fall back to native units */ }
    })();
    return () => { alive = false; };
  }, [coin.chain, native, address]);

  // My net position of this coin from Naka trades (for selling).
  useEffect(() => {
    if (!address) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/coins/trade?open=1', { cache: 'no-store' });
        const j = await r.json();
        const pos = (j.positions as Array<{ tokenKey: string; chain: string; netTokens: number }> | undefined)?.find((p) => p.chain === coin.chain && p.tokenKey === coin.tokenKey);
        if (alive) setMyTokens(pos?.netTokens ?? 0);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [address, coin.chain, coin.tokenKey, txHash]);

  const nativeAmount = nativePriceUsd && nativePriceUsd > 0 ? usd / nativePriceUsd : null;
  const sellAmount = myTokens > 0 ? (myTokens * pct) / 100 : 0;
  const canSell = coin.decimals != null && myTokens > 0;

  // Buying a memecoin with fiat is a two-step reality: a card on-ramp delivers
  // NATIVE (SOL/ETH/BNB) to the wallet, then that native is swapped to the coin.
  // So we check whether the user already holds enough native on THIS coin's
  // chain to cover the selected buy; if not, we surface a "Top up with card"
  // that funds exactly this chain, after which the same one-tap buy works.
  const nativeSym = native?.symbol;
  const nativeBalance = nativeSym ? (balance?.tokens?.[nativeSym] ?? 0) : 0;
  const nativeBalanceUsd = nativePriceUsd != null ? nativeBalance * nativePriceUsd : null;
  // A small headroom for gas so a top-up covers the swap fee too.
  const needsTopUp = side === 'buy' && (nativeBalanceUsd == null ? (balance?.totalUsd ?? 0) <= 0 : nativeBalanceUsd < usd * 1.02);

  const buildParams = useCallback(() => {
    if (!address || !native) return null;
    // Force the built-in Naka wallet to sign with itself rather than an external
    // wallet that may also be present in the browser.
    const walletKind = getBuiltinWalletAddress() === address ? ('builtin' as const) : undefined;
    if (side === 'buy') {
      if (!nativeAmount || nativeAmount <= 0) return null;
      return { chain: coin.chain, inputToken: native.symbol, outputToken: coin.tokenAddress, inputAmount: nativeAmount.toFixed(9), inputDecimals: native.decimals, userAddress: address, slippageBps: SLIPPAGE_BPS, walletKind };
    }
    // Never guess decimals for a sell: without them we cannot size base units.
    if (!canSell || sellAmount <= 0 || coin.decimals == null) return null;
    return { chain: coin.chain, inputToken: coin.tokenAddress, outputToken: native.symbol, inputAmount: String(sellAmount), inputDecimals: coin.decimals, userAddress: address, slippageBps: SLIPPAGE_BPS, walletKind };
  }, [address, native, side, nativeAmount, canSell, sellAmount, coin]);

  // Debounced live quote as the amount changes.
  useEffect(() => {
    reset(); setDone(false);
    const params = buildParams();
    if (!params) return;
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => void getQuote(params), 350);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
  }, [buildParams, getQuote, reset]);

  const submit = async () => {
    const params = buildParams();
    if (!params) return;
    await executeSwap(params);
  };

  // Record the settled trade into our coin feed once broadcast confirms. We use
  // the EXECUTED quote's output amount (not the display estimate) so recorded
  // holdings and PnL match the on-chain fill.
  useEffect(() => {
    if (!txHash) return;
    const pow = (d: number) => Math.pow(10, d);
    setDone(true);
    (async () => {
      let priceForRecord = price;
      // BUY: tokens received = executed output / coin decimals; cost = USD paid.
      // SELL: native received = executed output / native decimals; proceeds in USD.
      let tokenAmount: number;
      let usdForRecord: number;
      if (side === 'buy') {
        const received = executedOutRaw && coin.decimals != null
          ? Number(executedOutRaw) / pow(coin.decimals)
          : (quote ? parseFloat(quote.amountOut) || 0 : 0);
        tokenAmount = received;
        usdForRecord = usd; // what the user actually paid
      } else {
        tokenAmount = sellAmount;
        const nativeReceived = executedOutRaw && native ? Number(executedOutRaw) / pow(native.decimals) : null;
        usdForRecord = nativeReceived != null && nativePriceUsd ? nativeReceived * nativePriceUsd : (price != null ? sellAmount * price : 0);
        if (usdForRecord <= 0) {
          try {
            const r = await fetch(`/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/price`, { cache: 'no-store' });
            const j = await r.json();
            if (j?.priceUsd != null) { priceForRecord = Number(j.priceUsd); usdForRecord = sellAmount * priceForRecord; }
          } catch { /* leave as-is */ }
        }
      }
      if (usdForRecord <= 0 || tokenAmount <= 0) return;
      await fetch('/api/coins/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: coin.chain, address: coin.tokenAddress, symbol: coin.symbol, side,
          usdAmount: usdForRecord, tokenAmount, priceUsd: priceForRecord, marketCapUsd: liveMcap ?? coin.marketCapUsd, txHash,
        }),
      }).catch(() => { /* best-effort */ });
    })();
    window.dispatchEvent(new Event('steinz:balance-changed'));
  }, [txHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only coins that have really graduated onto a DEX (a real pool with real
  // liquidity) are tradable here. This blocks bonding-curve and fake tokens.
  if (!coin.isGraduated) {
    return (
      <div className="nl-glass rounded-2xl p-4 text-center">
        <div className="text-[14px] font-semibold text-white">Not tradable yet</div>
        <p className="text-[12px] text-white/50 mt-1">This coin has not graduated onto a DEX with real liquidity, so it cannot be traded on Naka yet.</p>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="nl-glass rounded-2xl p-4 text-center">
        <WalletIcon className="w-5 h-5 text-[#7FB2FF] mx-auto mb-2" />
        <div className="text-[14px] font-semibold text-white">Set up your wallet to trade</div>
        <p className="text-[12px] text-white/50 mt-1">Create or import a Naka wallet once, then buy any coin in a tap. Non-custodial, your keys never leave your device.</p>
        <Link href="/dashboard?tab=wallet" className="inline-flex mt-3 rounded-xl px-4 py-2 text-[13px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}>
          Set up wallet
        </Link>
      </div>
    );
  }

  return (
    <div className="nl-glass rounded-2xl p-4">
      {/* Buy / Sell segmented */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 mb-3">
        {(['buy', 'sell'] as Side[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`py-2 rounded-lg text-[13px] font-semibold capitalize transition-colors ${
              side === s
                ? s === 'buy' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {side === 'buy' ? (
        <>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {USD_PRESETS.map((v) => (
              <button key={v} type="button" onClick={() => setUsd(v)} className={`py-2 rounded-lg text-[13px] font-semibold border transition-colors ${usd === v ? 'bg-[#0066FF]/15 border-[#0066FF]/45 text-white' : 'bg-white/[0.03] border-white/10 text-white/60'}`}>
                ${v}
              </button>
            ))}
          </div>
          <div className="text-[12px] text-white/50 mb-3">
            {native ? (
              nativePriceUsd ? (
                <>Pay about {nativeAmount ? nativeAmount.toFixed(4) : '—'} {native.symbol} (${usd})</>
              ) : (
                <>Pay with {native.symbol}</>
              )
            ) : null}
          </div>
        </>
      ) : (
        <>
          {canSell ? (
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {PCT_PRESETS.map((v) => (
                <button key={v} type="button" onClick={() => setPct(v)} className={`py-2 rounded-lg text-[13px] font-semibold border transition-colors ${pct === v ? 'bg-[#0066FF]/15 border-[#0066FF]/45 text-white' : 'bg-white/[0.03] border-white/10 text-white/60'}`}>
                  {v}%
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-white/50 mb-3">
              {myTokens <= 0 ? 'No Naka position in this coin to sell yet.' : 'This coin cannot be sold here yet. Use Swap for full token support.'}
            </div>
          )}
        </>
      )}

      {/* Quote line */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 mb-3 text-[13px] min-h-[2.6rem] flex items-center justify-between">
        {loading ? (
          <span className="text-white/50 inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Getting best price</span>
        ) : quote ? (
          <>
            <span className="text-white/60">You receive</span>
            <span className="text-white font-semibold tabular-nums">
              {`${(parseFloat(quote.amountOut) || 0).toLocaleString('en-US', { maximumFractionDigits: side === 'buy' ? 4 : 6 })} ${side === 'buy' ? coin.symbol : (native?.symbol ?? '')}`}
            </span>
          </>
        ) : (
          <span className="text-white/40">Price at {coinPrice(price)} · {compactUsd(liveMcap ?? coin.marketCapUsd)} MC</span>
        )}
      </div>

      {error ? <div className="text-[12px] text-rose-400 mb-2">{error}</div> : null}

      <button
        type="button"
        onClick={submit}
        disabled={executing || loading || !buildParams()}
        className={`w-full rounded-xl py-3.5 text-[15px] font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-45 transition-transform active:scale-[0.99] ${side === 'buy' ? 'shadow-[0_12px_32px_-10px_rgba(16,185,129,.7)]' : 'shadow-[0_12px_32px_-10px_rgba(244,63,94,.7)]'}`}
        style={{ background: side === 'buy' ? 'linear-gradient(135deg,#14c48a,#0e9f6e)' : 'linear-gradient(135deg,#fb5170,#e11d48)' }}
      >
        {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4" /> : null}
        {done ? 'Done' : executing ? 'Confirm in wallet' : side === 'buy' ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`}
      </button>

      {side === 'buy' ? (
        needsTopUp ? (
          <div className="mt-2.5 rounded-xl bg-[#0066FF]/[0.08] border border-[#0066FF]/25 p-2.5">
            <div className="text-[12px] text-white/70 mb-2">
              {nativeBalanceUsd != null && nativeBalanceUsd > 0
                ? `Not enough ${nativeSym} for a $${usd} buy. Top up with a card, then buy ${coin.symbol} in a tap.`
                : `To buy ${coin.symbol} you need ${nativeSym ?? 'funds'} on ${coin.chain === 'solana' ? 'Solana' : coin.chain === 'bsc' ? 'BNB Chain' : 'Ethereum'}. Add it with a card in a tap.`}
            </div>
            <FundButton address={address} chain={coin.chain} label={`Top up ${nativeSym ?? ''} with card`} />
          </div>
        ) : (
          <div className="mt-2 flex justify-center">
            <FundButton
              address={address}
              chain={coin.chain}
              label={`Top up ${nativeSym ?? ''} with card`}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/45 hover:text-[#7FB2FF] transition-colors"
            />
          </div>
        )
      ) : null}

      <p className="text-[11px] text-white/35 text-center mt-2">Signed by your own wallet. Non-custodial. {(PLATFORM_FEE_BPS / 100).toString()}% fee.</p>

      {/* Built-in wallet unlock prompt surfaced by the signer. */}
      {unlockRequest ? (
        <UnlockModal onSubmit={resolveUnlock} onCancel={cancelUnlock} />
      ) : null}
    </div>
  );
}

function UnlockModal({ onSubmit, onCancel }: { onSubmit: (pw: string) => void; onCancel: () => void }) {
  const [pw, setPw] = useState('');
  return (
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Unlock wallet"
    >
      <div className="w-full max-w-sm nl-glass rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-white mb-1">Unlock wallet</div>
        <p className="text-[12px] text-white/50 mb-3">Enter your wallet password to sign this trade. It never leaves your device.</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && pw) onSubmit(pw); }}
          className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 text-white outline-none focus:border-[#0066FF]/50 mb-3"
          placeholder="Wallet password"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white/70 bg-white/[0.05] border border-white/10">Cancel</button>
          <button type="button" onClick={() => pw && onSubmit(pw)} className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}>Unlock</button>
        </div>
      </div>
    </div>
  );
}
