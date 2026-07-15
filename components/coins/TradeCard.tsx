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
import type { Coin } from '@/lib/coins/types';
import { compactUsd, coinPrice } from '@/lib/coins/format';

const NATIVE: Record<string, { symbol: string; decimals: number }> = {
  solana: { symbol: 'SOL', decimals: 9 },
  ethereum: { symbol: 'ETH', decimals: 18 },
  bsc: { symbol: 'BNB', decimals: 18 },
};

const USD_PRESETS = [10, 25, 50, 100];
const PCT_PRESETS = [25, 50, 100];
const SLIPPAGE_BPS = 150;

type Side = 'buy' | 'sell';

export function TradeCard({ coin, livePrice, liveMcap }: { coin: Coin; livePrice: number | null; liveMcap: number | null }) {
  const { address } = useWallet();
  const native = NATIVE[coin.chain];
  const [side, setSide] = useState<Side>('buy');
  const [usd, setUsd] = useState<number>(25);
  const [pct, setPct] = useState<number>(50);
  const [nativePriceUsd, setNativePriceUsd] = useState<number | null>(null);
  const [myTokens, setMyTokens] = useState<number>(0);
  const [done, setDone] = useState(false);
  const { quote, loading, executing, error, txHash, getQuote, executeSwap, reset, unlockRequest, resolveUnlock, cancelUnlock } = useSwapExecution();
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

  const buildParams = useCallback(() => {
    if (!address || !native) return null;
    if (side === 'buy') {
      if (!nativeAmount || nativeAmount <= 0) return null;
      return { chain: coin.chain, inputToken: native.symbol, outputToken: coin.tokenAddress, inputAmount: nativeAmount.toFixed(9), inputDecimals: native.decimals, userAddress: address, slippageBps: SLIPPAGE_BPS };
    }
    if (!canSell || sellAmount <= 0) return null;
    return { chain: coin.chain, inputToken: coin.tokenAddress, outputToken: native.symbol, inputAmount: String(sellAmount), inputDecimals: coin.decimals ?? 18, userAddress: address, slippageBps: SLIPPAGE_BPS };
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

  // Record the settled trade into our coin feed once broadcast confirms.
  useEffect(() => {
    if (!txHash) return;
    const receivedCoin = side === 'buy' && quote ? parseFloat(quote.amountOut) || 0 : 0;
    const tokenAmount = side === 'buy' ? receivedCoin : sellAmount;
    const usdAmount = side === 'buy' ? usd : (price != null ? sellAmount * price : 0);
    setDone(true);
    void fetch('/api/coins/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: coin.chain, address: coin.tokenAddress, symbol: coin.symbol, side,
        usdAmount, tokenAmount, priceUsd: price, marketCapUsd: liveMcap ?? coin.marketCapUsd, txHash,
      }),
    }).catch(() => { /* best-effort */ });
    window.dispatchEvent(new Event('steinz:balance-changed'));
  }, [txHash]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {side === 'buy' ? `${(parseFloat(quote.amountOut) || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${coin.symbol}` : `~${native ? native.symbol : ''}`}
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
        className={`w-full rounded-xl py-3 text-[15px] font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-45 ${side === 'buy' ? '' : ''}`}
        style={{ background: side === 'buy' ? 'linear-gradient(135deg,#12b981,#0e9f6e)' : 'linear-gradient(135deg,#f43f5e,#e11d48)' }}
      >
        {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4" /> : null}
        {done ? 'Done' : executing ? 'Confirm in wallet' : side === 'buy' ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`}
      </button>

      <p className="text-[11px] text-white/35 text-center mt-2">Signed by your own wallet. Non-custodial. 0.5% fee.</p>

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
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
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
