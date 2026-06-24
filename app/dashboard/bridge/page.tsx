'use client';

/**
 * §3 P1-C.3 — Bridge UI. Every cross-chain surface on the platform routes
 * through LiFi (locked per §0.5). This page is the user-facing wrapper
 * around the existing /api/bridge/* routes.
 *
 * Flow:
 *   1. User picks fromChain, toChain, fromToken, amount, toToken.
 *   2. POST /api/bridge/quote → indicative LiFi route.
 *   3. User clicks Bridge → switch wallet to source chain, sign the
 *      LiFi transactionRequest, broadcast.
 *   4. POST /api/bridge/execute records the bridge in pending_trades
 *      (source_reason='bridge'), so the user has it in history.
 *   5. Poll /api/bridge/status/[txHash] every 10s until DONE or FAILED.
 *
 * Server never signs; the client signs. Same non-custodial pattern the
 * relayer uses for swaps. window.ethereum is supplied by the existing
 * wallet shim in the app, so no new global declaration is needed here.
 */

import { useState } from 'react';
// PERF8: ethers (~275KB minified) is dynamically imported inside the
// quote/execute handlers so it stays out of the bridge page initial
// chunk and only loads when the user actually clicks a button.
import type { Eip1193Provider } from 'ethers';
import { ArrowLeftRight, ChevronDown, Loader2, ExternalLink } from 'lucide-react';

interface ChainOption {
  key: string;
  chainId: number;
  label: string;
  nativeSymbol: string;
}

const CHAINS: ChainOption[] = [
  { key: 'ethereum', chainId: 1,     label: 'Ethereum', nativeSymbol: 'ETH' },
  { key: 'base',     chainId: 8453,  label: 'Base',     nativeSymbol: 'ETH' },
  { key: 'arbitrum', chainId: 42161, label: 'Arbitrum', nativeSymbol: 'ETH' },
  { key: 'polygon',  chainId: 137,   label: 'Polygon',  nativeSymbol: 'MATIC' },
  { key: 'optimism', chainId: 10,    label: 'Optimism', nativeSymbol: 'ETH' },
  { key: 'bsc',      chainId: 56,    label: 'BSC',      nativeSymbol: 'BNB' },
];

const NATIVE_ADDR = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

interface LifiQuote {
  id?: string;
  tool?: string;
  toolDetails?: { name?: string };
  estimate?: {
    fromAmount?: string;
    toAmount?: string;
    toAmountMin?: string;
    executionDuration?: number;
  };
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    chainId?: number;
    gasPrice?: string;
    gasLimit?: string;
  };
}

interface StatusResponse {
  status?: string;
  substatus?: string;
  substatusMessage?: string;
  bridgeExplorerLink?: string;
  receiving?: { txHash?: string };
}

export default function BridgePage() {
  const [fromChain, setFromChain] = useState<ChainOption>(CHAINS[0]);
  const [toChain, setToChain] = useState<ChainOption>(CHAINS[1]);
  const [fromToken, setFromToken] = useState<string>(NATIVE_ADDR);
  const [toToken, setToToken] = useState<string>(NATIVE_ADDR);
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<LifiQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  async function fetchQuote() {
    setError(null);
    setQuote(null);
    setStatus(null);
    setTxHash(null);
    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount');
      return;
    }
    const eth = (typeof window !== 'undefined' ? window.ethereum : undefined);
    if (!eth) {
      setError('No EVM wallet detected. Install MetaMask or a compatible wallet.');
      return;
    }
    setQuoting(true);
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const fromAddress = accounts[0];
      const { parseUnits } = await import('ethers');
      const fromAmountBaseUnits = parseUnits(amount, 18).toString();

      const res = await fetch('/api/bridge/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromChain: fromChain.chainId,
          toChain: toChain.chainId,
          fromToken,
          toToken,
          fromAmount: fromAmountBaseUnits,
          fromAddress,
          slippage: 0.005,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'No route');
        return;
      }
      setQuote(json.quote as LifiQuote);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote failed');
    } finally {
      setQuoting(false);
    }
  }

  async function executeBridge() {
    if (!quote?.transactionRequest?.data) return;
    const eth = (typeof window !== 'undefined' ? window.ethereum : undefined);
    if (!eth) return;
    setError(null);
    setExecuting(true);
    try {
      const targetHex = `0x${fromChain.chainId.toString(16)}`;
      const currentHex = (await eth.request({ method: 'eth_chainId' })) as string;
      if (currentHex.toLowerCase() !== targetHex.toLowerCase()) {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetHex }],
        });
      }

      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider(eth as unknown as Eip1193Provider);
      const signer = await provider.getSigner();
      const fromAddress = await signer.getAddress();

      const txResponse = await signer.sendTransaction({
        to: quote.transactionRequest.to,
        data: quote.transactionRequest.data,
        value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : BigInt(0),
        gasLimit: quote.transactionRequest.gasLimit ? BigInt(quote.transactionRequest.gasLimit) : undefined,
      });

      setTxHash(txResponse.hash);

      void fetch('/api/bridge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteToolName: quote.tool ?? quote.toolDetails?.name,
          srcTxHash: txResponse.hash,
          fromChain: fromChain.key,
          toChain: toChain.key,
          fromToken,
          toToken,
          fromAmount: quote.estimate?.fromAmount ?? '0',
          expectedToAmount: quote.estimate?.toAmount,
          fromAddress,
          toAddress: fromAddress,
        }),
      });

      pollStatus(txResponse.hash, quote.tool ?? quote.toolDetails?.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bridge failed');
    } finally {
      setExecuting(false);
    }
  }

  function pollStatus(hash: string, bridge?: string) {
    const params = new URLSearchParams();
    if (bridge) params.set('bridge', bridge);
    params.set('fromChain', String(fromChain.chainId));
    params.set('toChain', String(toChain.chainId));

    const tick = async () => {
      try {
        const res = await fetch(`/api/bridge/status/${hash}?${params}`);
        if (!res.ok) return;
        const json = (await res.json()) as StatusResponse;
        setStatus(json);
        if (json.status !== 'DONE' && json.status !== 'FAILED') {
          setTimeout(tick, 10_000);
        }
      } catch {
        setTimeout(tick, 15_000);
      }
    };
    tick();
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 text-white">
      <div className="flex items-center gap-2 mb-6">
        <ArrowLeftRight className="w-5 h-5 text-[#0066FF]" />
        <h1 className="text-2xl font-bold">Bridge</h1>
        <span className="text-[10px] uppercase px-2 py-0.5 bg-white/[0.06] rounded text-slate-400">LiFi</span>
      </div>

      <div className="rounded-2xl bg-[#0F172A]/80 border border-white/10 p-5 space-y-4">
        <ChainPicker label="From" value={fromChain} onChange={setFromChain} />
        <TokenField label="Token (from)" value={fromToken} onChange={setFromToken} placeholder="0x... or 0xEeeE...EeeE for native" />
        <AmountField value={amount} onChange={setAmount} nativeSymbol={fromChain.nativeSymbol} />
        <ChainPicker label="To" value={toChain} onChange={setToChain} />
        <TokenField label="Token (to)" value={toToken} onChange={setToToken} placeholder="0x... or 0xEeeE...EeeE for native" />

        <button
          onClick={fetchQuote}
          disabled={quoting || executing}
          className="w-full py-3 rounded-xl bg-[#0066FF] hover:bg-[#0066FF]/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold flex items-center justify-center gap-2"
        >
          {quoting ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching route…</> : 'Get route'}
        </button>

        {error && <div className="text-xs text-[#EF4444] bg-[#EF4444]/10 rounded-lg px-3 py-2">{error}</div>}

        {quote && (
          <div className="rounded-xl bg-black/30 border border-white/[0.06] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Route</span>
              <span className="font-semibold">{quote.toolDetails?.name ?? quote.tool ?? 'LiFi'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">You receive (min)</span>
              <span className="font-mono">{quote.estimate?.toAmountMin ?? quote.estimate?.toAmount ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Est. duration</span>
              <span>{quote.estimate?.executionDuration ? `${Math.round(quote.estimate.executionDuration)}s` : '—'}</span>
            </div>
            <button
              onClick={executeBridge}
              disabled={executing}
              className="w-full mt-2 py-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-50 text-sm font-bold flex items-center justify-center gap-2"
            >
              {executing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sign in wallet…</> : 'Bridge now'}
            </button>
          </div>
        )}

        {txHash && (
          <div className="rounded-xl bg-black/30 border border-white/[0.06] p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Source tx</span>
              <span className="font-mono truncate max-w-[60%]">{txHash}</span>
            </div>
            {status && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className={
                    status.status === 'DONE' ? 'text-[#10B981] font-semibold'
                    : status.status === 'FAILED' ? 'text-[#EF4444] font-semibold'
                    : 'text-amber-300'
                  }>{status.status ?? 'PENDING'}</span>
                </div>
                {status.substatusMessage && (
                  <div className="text-[11px] text-slate-400 leading-relaxed">{status.substatusMessage}</div>
                )}
                {status.receiving?.txHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Dest tx</span>
                    <span className="font-mono truncate max-w-[60%]">{status.receiving.txHash}</span>
                  </div>
                )}
                {status.bridgeExplorerLink && (
                  <a
                    href={status.bridgeExplorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#0066FF] hover:underline text-[11px]"
                  >
                    Bridge explorer <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChainPicker({ label, value, onChange }: { label: string; value: ChainOption; onChange: (v: ChainOption) => void }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-slate-500 block mb-1">{label}</label>
      <div className="relative">
        <select
          value={value.key}
          onChange={(e) => {
            const next = CHAINS.find((c) => c.key === e.target.value);
            if (next) onChange(next);
          }}
          className="w-full appearance-none bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-sm font-semibold focus:outline-none focus:border-[#0066FF]"
        >
          {CHAINS.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function TokenField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-slate-500 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0066FF]"
      />
    </div>
  );
}

function AmountField({ value, onChange, nativeSymbol }: { value: string; onChange: (v: string) => void; nativeSymbol: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-slate-500 block mb-1">Amount</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0"
          className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 pr-16 text-sm font-mono focus:outline-none focus:border-[#0066FF]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase text-slate-500">{nativeSymbol}</span>
      </div>
    </div>
  );
}
