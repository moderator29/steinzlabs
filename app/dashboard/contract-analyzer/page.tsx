'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Code, Search, AlertTriangle, CheckCircle, XCircle,
  Loader2, Info, ChevronDown, ChevronUp, Brain, ThumbsUp, ThumbsDown,
  TrendingUp, TrendingDown, ExternalLink, Clock, Rocket, Twitter, Send, Globe,
  ShieldCheck, ShieldAlert, FlaskConical, ScanLine, HelpCircle, GitCompareArrows,
  Copy, Check, RefreshCw
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { isEvmAddress, isSolanaAddress } from '@/lib/utils/addressNormalize';
import { RelatedTokensPanels } from '@/components/security/RelatedTokensPanels';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { contractAnalyzerHowItWorks } from '@/lib/howItWorks/content/contract-analyzer';

interface Socials { twitter?: string; telegram?: string; website?: string }
interface Launchpad { id: string; label: string }

type SourceVerdict = 'honeypot' | 'sellable' | 'unknown' | 'unavailable';

interface HoneypotVerdict {
  conclusion: 'honeypot' | 'likely_safe' | 'caution' | 'unknown';
  summary: string;
  conflict: boolean;
  sources: {
    static: {
      available: boolean;
      verdict: SourceVerdict;
      buyTax?: string | null;
      sellTax?: string | null;
    };
    simulation: {
      available: boolean;
      applicable: boolean;
      verdict: SourceVerdict;
      reason?: string | null;
      buyTax?: string | null;
      sellTax?: string | null;
      transferTax?: string | null;
      flags?: string[];
    };
  };
}

interface AnalysisResult {
  found?: boolean;
  reason?: string;
  tooEarly?: boolean;
  securityUnavailable?: boolean;
  age?: string | null;
  ageMs?: number | null;
  launchpad?: Launchpad | null;
  socials?: Socials | null;
  creatorAddress?: string | null;
  earlyFlags?: string[];
  address: string;
  chain: string;
  overallScore: number;
  verdict: string;
  verdictColor: string;
  riskFlags: string[];
  tokenSecurity: {
    isHoneypot: boolean;
    buyTax: string;
    sellTax: string;
    isOpenSource: boolean;
    isMintable: boolean;
    isProxy: boolean;
    hasHiddenOwner: boolean;
    canTakeBackOwnership: boolean;
    ownerCanChangeBalance: boolean;
    selfDestruct: boolean;
    externalCall: boolean;
    cannotBuy: boolean;
    cannotSellAll: boolean;
    holderCount: number;
    ownerAddress: string;
    creatorAddress: string;
    checks: { label: string; status: string }[];
  } | null;
  addressIntel: {
    riskLevel: string;
    riskScore: number;
    isBlacklisted: boolean;
    isMalicious: boolean;
    isPhishing: boolean;
    isMixer: boolean;
    labels: string[];
  } | null;
  honeypotVerdict?: HoneypotVerdict | null;
  dexData?: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
    fdv: number;
    marketCap: number;
    imageUrl?: string;
    symbol?: string;
    name?: string;
    url?: string;
  } | null;
  analyzedAt: string;
  aiAnalysis?: string;
}

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'bsc', label: 'BSC' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'avalanche', label: 'Avalanche' },
  { id: 'solana', label: 'Solana' },
];

function isValidForChain(addr: string, chain: string): boolean {
  const a = addr.trim();
  if (!a) return false;
  if (chain === 'solana') return isSolanaAddress(a);
  return isEvmAddress(a);
}

const VERDICT_STYLE: Record<SourceVerdict, { label: string; color: string; Icon: typeof ShieldCheck }> = {
  honeypot: { label: 'Cannot sell', color: '#EF4444', Icon: ShieldAlert },
  sellable: { label: 'Sellable', color: '#10B981', Icon: ShieldCheck },
  unknown: { label: 'Inconclusive', color: '#F59E0B', Icon: HelpCircle },
  unavailable: { label: 'No data', color: '#94A3B8', Icon: HelpCircle },
};

const CONCLUSION_STYLE: Record<HoneypotVerdict['conclusion'], { label: string; color: string }> = {
  honeypot: { label: 'Honeypot', color: '#EF4444' },
  likely_safe: { label: 'Likely sellable', color: '#10B981' },
  caution: { label: 'Caution', color: '#F59E0B' },
  unknown: { label: 'Unknown', color: '#94A3B8' },
};

/**
 * Dual-source honeypot panel. Shows the GoPlus static verdict and the
 * Honeypot.is live-simulation verdict side by side, plus one reconciled
 * conclusion. Honest empty states per source; never collapses to one flag.
 */
function HoneypotVerdictPanel({ data }: { data: HoneypotVerdict }) {
  const { static: stat, simulation: sim } = data.sources;
  const concl = CONCLUSION_STYLE[data.conclusion];

  const renderSource = (
    title: string,
    sub: string,
    Badge: typeof ScanLine,
    verdict: SourceVerdict,
    available: boolean,
    rows: { label: string; value: string | null | undefined }[],
    note?: string | null,
  ) => {
    const vs = VERDICT_STYLE[verdict];
    return (
      <div className="flex-1 min-w-0 bg-white/[0.03] rounded-xl p-3 border border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-200 leading-tight">{title}</p>
            <p className="text-[9px] text-gray-500 leading-tight">{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <vs.Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: vs.color }} />
          <span className="text-xs font-bold" style={{ color: vs.color }}>
            {available || verdict === 'honeypot' ? vs.label : 'No data'}
          </span>
        </div>
        {(available || verdict === 'honeypot') && rows.some((r) => r.value) && (
          <div className="grid grid-cols-2 gap-1.5">
            {rows.filter((r) => r.value).map((r) => (
              <div key={r.label}>
                <p className="text-[8px] text-gray-500 uppercase tracking-wide">{r.label}</p>
                <p className="text-[11px] font-mono font-semibold text-gray-200">{r.value}</p>
              </div>
            ))}
          </div>
        )}
        {note && <p className="text-[9px] text-gray-500 mt-2 leading-snug">{note}</p>}
      </div>
    );
  };

  return (
    <div
      className="nl-glass rounded-2xl p-4 nl-fade-up"
      style={{
        boxShadow: data.conflict
          ? '0 0 0 1px rgba(245,158,11,.45), 0 0 18px rgba(245,158,11,.2)'
          : `0 0 0 1px ${concl.color}55, 0 0 18px ${concl.color}25`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${concl.color}20` }}>
          <FlaskConical className="w-4 h-4" style={{ color: concl.color }} />
        </div>
        <span className="font-bold text-sm">Honeypot Verdict</span>
        <span
          className="ms-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider"
          style={{ color: concl.color, backgroundColor: `${concl.color}15`, borderColor: `${concl.color}40` }}
        >
          {concl.label}
        </span>
      </div>

      {data.conflict && (
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
          <GitCompareArrows className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0" />
          <span className="text-[10px] font-semibold text-[#F59E0B]">Sources disagree</span>
        </div>
      )}

      <div className="flex gap-2 mb-3 flex-col sm:flex-row">
        {renderSource(
          'Static Analysis',
          'Bytecode and permission flags',
          ScanLine,
          stat.verdict,
          stat.available,
          [
            { label: 'Buy tax', value: stat.buyTax },
            { label: 'Sell tax', value: stat.sellTax },
          ],
        )}
        {renderSource(
          'Live Simulation',
          sim.applicable ? 'Real buy plus sell on chain' : 'EVM only',
          FlaskConical,
          sim.verdict,
          sim.available,
          [
            { label: 'Buy tax', value: sim.buyTax },
            { label: 'Sell tax', value: sim.sellTax },
            { label: 'Transfer tax', value: sim.transferTax },
          ],
          !sim.available ? sim.reason : null,
        )}
      </div>

      <p className="text-[11px] text-gray-300 leading-relaxed">{data.summary}</p>

      {sim.flags && sim.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {sim.flags.map((f) => (
            <span key={f} className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ContractAnalyzerInner() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChecks, setShowChecks] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const autoRanRef = useRef(false);

  const trimmedInput = input.trim();
  const inputIsValid = isValidForChain(trimmedInput, chain);
  // Only warn once the string is long enough to plausibly be a full address.
  const showFormatHint = trimmedInput.length >= 12 && !inputIsValid;

  /** Auto-detect the network from a pasted address so users never have to
   *  guess: base58 → Solana, 0x… → keep the current EVM chain (or Ethereum). */
  const handleInputChange = (value: string) => {
    setInput(value);
    const a = value.trim();
    if (isSolanaAddress(a) && chain !== 'solana') setChain('solana');
    else if (isEvmAddress(a) && chain === 'solana') setChain('ethereum');
  };

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — ignore.
    }
  };

  const runAnalysis = useCallback(async (addr: string, ch: string) => {
    if (!addr.trim()) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setShowChecks(false);
    setAiFeedback(null);

    try {
      const res = await fetch('/api/security/contract-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr.trim(), chain: ch }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Analysis failed'); return; }
      setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleAnalyze = () => {
    if (!isValidForChain(input.trim(), chain)) return;
    void runAnalysis(input, chain);
  };

  // Auto-populate + auto-run from ?address=&chain= (e.g. the sniper "DNA" button).
  useEffect(() => {
    if (autoRanRef.current) return;
    const addrParam = (searchParams.get('address') || '').trim();
    const chainParam = (searchParams.get('chain') || '').trim().toLowerCase();
    if (!addrParam) return;
    autoRanRef.current = true;
    const resolvedChain = CHAINS.some((c) => c.id === chainParam)
      ? chainParam
      : isSolanaAddress(addrParam) ? 'solana' : 'ethereum';
    setInput(addrParam);
    setChain(resolvedChain);
    if (isValidForChain(addrParam, resolvedChain)) {
      void runAnalysis(addrParam, resolvedChain);
    }
  }, [searchParams, runAnalysis]);

  const getStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  };

  return (
    <div className="min-h-screen text-white pb-20">
      <div className="sticky top-0 z-40 nl-glass backdrop-blur-2xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14 max-w-2xl mx-auto">
          <BackButton />
          <div className="w-8 h-8 bg-gradient-to-br from-[#1E90FF] to-[#0066FF] rounded-xl flex items-center justify-center flex-shrink-0">
            <Code className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-heading font-bold truncate">Contract Analyzer</h1>
            <p className="text-[10px] text-gray-500 truncate">Deep contract security analysis and rug detection</p>
          </div>
          <HowItWorksButton content={contractAnalyzerHowItWorks} className="ms-auto shrink-0" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Scan panel — network, address input, and action in one glass card */}
        <div className="nl-glass rounded-2xl p-4 space-y-3.5" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.35), 0 0 16px rgba(0,102,255,.15)' }}>
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#0066FF] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Analyze any smart contract or token address for honeypot risk, dangerous permissions, high taxes, and malicious patterns. EVM tokens get a second opinion from a live buy plus sell simulation.
            </p>
          </div>

          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Network</p>
            <div className="flex gap-1.5 flex-wrap">
              {CHAINS.map((c) => (
                <button key={c.id} onClick={() => setChain(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${chain === c.id ? 'bg-[#0066FF]/10 border-[#0066FF]/30 text-blue-300' : 'nl-button--ghost text-gray-500 hover:text-gray-300'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Contract address</p>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder={chain === 'solana' ? 'Solana token address' : 'Contract or token address (0x...)'}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/50 transition-colors"
              />
              <button onClick={handleAnalyze} disabled={analyzing || !inputIsValid}
                className="nl-btn-neon px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Analyze
              </button>
            </div>
            {showFormatHint && (
              <p className="text-[10px] text-amber-400/90 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {chain === 'solana'
                  ? 'This does not look like a valid Solana (base58) address.'
                  : `This does not look like a valid 0x address for ${CHAINS.find((c) => c.id === chain)?.label ?? chain}.`}
              </p>
            )}
          </div>
        </div>

        {analyzing && (
          <div className="text-center py-12">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#0066FF]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0066FF] animate-spin" />
              <Code className="w-6 h-6 text-[#0066FF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Analyzing contract...</p>
            <p className="text-[10px] text-gray-600 mt-1">Running honeypot detection, security checks, and risk analysis</p>
          </div>
        )}

        {error && !analyzing && (
          <div className="nl-glass nl-glass--crimson rounded-2xl p-5 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
            <p className="text-[11px] text-gray-500 mt-1.5 max-w-[300px] mx-auto">
              The analysis did not complete, so no results are shown. Check the address and network, then try again.
            </p>
            {inputIsValid && (
              <button onClick={() => void runAnalysis(input, chain)}
                className="mt-3.5 nl-btn-neon px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Retry scan
              </button>
            )}
          </div>
        )}

        {/* INVALID / UNKNOWN contract — clear no-data state, no fake report */}
        {result && !analyzing && result.found === false && (
          <div className="nl-glass rounded-2xl p-6 text-center" style={{ boxShadow: '0 0 0 1px rgba(148,163,184,.25)' }}>
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <XCircle className="w-7 h-7 text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-gray-300">No data: not a valid/known contract on <span className="capitalize">{result.chain}</span>.</p>
            <p className="text-[11px] text-gray-600 mt-2 max-w-[280px] mx-auto">
              We could not find on-chain, security, or market data for this address from any source. Double-check the address and the selected chain.
            </p>
            <p className="text-[10px] text-gray-700 font-mono mt-3 break-all">{result.address}</p>
            <button onClick={() => { setResult(null); setInput(''); }}
              className="mt-4 nl-btn-neon py-2 px-4 rounded-xl text-xs text-gray-400 hover:text-white transition-all">
              Try another address
            </button>
          </div>
        )}

        {/* TOO EARLY — token just launched, limited data so far */}
        {result && !analyzing && result.found !== false && result.tooEarly && (
          <>
            <div className="nl-glass rounded-2xl p-4 bg-gradient-to-br from-[#F59E0B]/5 to-transparent" style={{ boxShadow: '0 0 0 1px rgba(245,158,11,.4), 0 0 16px rgba(245,158,11,.18)' }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center flex-shrink-0">
                  <Rocket className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#F59E0B]">Too early: this coin just launched</p>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    Limited data so far. Honeypot simulation, holder distribution, and reliable market metrics need a tradable pool and a little time to populate.
                  </p>
                </div>
              </div>
            </div>

            {/* The light context we actually have */}
            <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="grid grid-cols-2 gap-2">
                {result.age && (
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Age</p>
                    <p className="text-xs font-bold">{result.age}</p>
                  </div>
                )}
                {result.launchpad && (
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500 flex items-center gap-1"><Rocket className="w-3 h-3" /> Launchpad</p>
                    <p className="text-xs font-bold">{result.launchpad.label}</p>
                  </div>
                )}
                {result.dexData && result.dexData.liquidity > 0 && (
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Liquidity</p>
                    <p className="text-xs font-bold font-mono">${result.dexData.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                )}
                {result.creatorAddress && (
                  <div className="bg-white/[0.03] rounded-xl p-2.5 col-span-2">
                    <p className="text-[9px] text-gray-500">Creator</p>
                    <p className="text-[11px] font-mono text-gray-300 break-all">{result.creatorAddress}</p>
                  </div>
                )}
              </div>

              {result.socials && (result.socials.twitter || result.socials.telegram || result.socials.website) && (
                <div className="flex items-center gap-2 mt-3">
                  {result.socials.twitter && <a href={result.socials.twitter} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Twitter className="w-3.5 h-3.5" /></a>}
                  {result.socials.telegram && <a href={result.socials.telegram} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Send className="w-3.5 h-3.5" /></a>}
                  {result.socials.website && <a href={result.socials.website} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Globe className="w-3.5 h-3.5" /></a>}
                </div>
              )}

              {result.earlyFlags && result.earlyFlags.length > 0 && (
                <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Early flags</p>
                  {result.earlyFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[12px] text-gray-300">{flag}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live simulation can already prove sellability pre-market */}
            {result.honeypotVerdict && result.honeypotVerdict.sources.simulation.available && (
              <HoneypotVerdictPanel data={result.honeypotVerdict} />
            )}

            <button onClick={() => { setResult(null); setInput(''); }}
              className="w-full nl-btn-neon py-2.5 rounded-xl text-xs text-gray-400 hover:text-white transition-all">
              Analyze another contract
            </button>
          </>
        )}

        {/* SECURITY UNAVAILABLE — token is tradable but no security source
            returned data. We do NOT show a score/verdict: an absent scan is
            honest-unknown, never a fake SAFE. */}
        {result && !analyzing && result.found !== false && !result.tooEarly && result.securityUnavailable && (
          <>
            <div className="nl-glass rounded-2xl p-6 text-center" style={{ boxShadow: '0 0 0 1px rgba(148,163,184,.3)' }}>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                <HelpCircle className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-200">Security data unavailable</p>
              <p className="text-[11px] text-gray-500 mt-2 max-w-[300px] mx-auto leading-relaxed">
                This token is tradable, but no contract security source (GoPlus / address intelligence) returned data for it right now. We will not show a safety score we cannot back with a real scan. Re-check shortly, or verify the contract on a block explorer before interacting.
              </p>
              <p className="text-[10px] text-gray-700 font-mono mt-3 break-all">{result.address}</p>
            </div>

            {result.dexData && result.dexData.liquidity > 0 && (
              <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Liquidity</p>
                    <p className="text-xs font-bold font-mono">${result.dexData.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  {result.age && (
                    <div className="bg-white/[0.03] rounded-xl p-2.5">
                      <p className="text-[9px] text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Age</p>
                      <p className="text-xs font-bold">{result.age}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Only a genuinely-run live simulation is surfaced here. */}
            {result.honeypotVerdict && result.honeypotVerdict.sources.simulation.available && (
              <HoneypotVerdictPanel data={result.honeypotVerdict} />
            )}

            <button onClick={() => { setResult(null); setInput(''); }}
              className="w-full nl-btn-neon py-2.5 rounded-xl text-xs text-gray-400 hover:text-white transition-all">
              Analyze another contract
            </button>
          </>
        )}

        {result && !analyzing && result.found !== false && !result.tooEarly && !result.securityUnavailable && (
          <>
            {/* Token Header with DexScreener data */}
            {result.dexData && (
              <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                <div className="flex items-center gap-3 mb-3">
                  {result.dexData.imageUrl ? (
                    <img src={result.dexData.imageUrl} alt={result.dexData.symbol} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-10 h-10 bg-[#0066FF]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Code className="w-5 h-5 text-[#0066FF]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{result.dexData.name || result.dexData.symbol || 'Token'}</span>
                      {result.dexData.symbol && <span className="text-[10px] text-gray-500 font-mono">{result.dexData.symbol}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono font-bold">
                        ${result.dexData.price < 0.01 ? result.dexData.price.toFixed(8) : result.dexData.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                      <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${result.dexData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {result.dexData.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {result.dexData.priceChange24h >= 0 ? '+' : ''}{result.dexData.priceChange24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  {result.dexData.url && (
                    <a href={result.dexData.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#0066FF] flex items-center gap-1 hover:underline flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.03] rounded-xl p-2">
                    <p className="text-[9px] text-gray-500">MCap</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.marketCap > 1e6 ? (result.dexData.marketCap / 1e6).toFixed(2) + 'M' : result.dexData.marketCap > 1000 ? (result.dexData.marketCap / 1000).toFixed(1) + 'K' : result.dexData.marketCap.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2">
                    <p className="text-[9px] text-gray-500">Volume 24h</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.volume24h > 1e6 ? (result.dexData.volume24h / 1e6).toFixed(2) + 'M' : result.dexData.volume24h > 1000 ? (result.dexData.volume24h / 1000).toFixed(1) + 'K' : result.dexData.volume24h.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2">
                    <p className="text-[9px] text-gray-500">Liquidity</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.liquidity > 1e6 ? (result.dexData.liquidity / 1e6).toFixed(2) + 'M' : result.dexData.liquidity > 1000 ? (result.dexData.liquidity / 1000).toFixed(1) + 'K' : result.dexData.liquidity.toFixed(0)}
                    </p>
                  </div>
                </div>
                {/* Launchpad + age + socials */}
                {(result.launchpad || result.age || (result.socials && (result.socials.twitter || result.socials.telegram || result.socials.website))) && (
                  <div className="flex items-center flex-wrap gap-2 mt-3">
                    {result.launchpad && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0066FF]/10 text-blue-300 border border-[#0066FF]/20 flex items-center gap-1">
                        <Rocket className="w-3 h-3" /> {result.launchpad.label}
                      </span>
                    )}
                    {result.age && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {result.age}
                      </span>
                    )}
                    {result.socials?.twitter && <a href={result.socials.twitter} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Twitter className="w-3.5 h-3.5" /></a>}
                    {result.socials?.telegram && <a href={result.socials.telegram} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Send className="w-3.5 h-3.5" /></a>}
                    {result.socials?.website && <a href={result.socials.website} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Globe className="w-3.5 h-3.5" /></a>}
                  </div>
                )}
              </div>
            )}

            {/* Score Card */}
            <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#1a2235" strokeWidth="6" />
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke={result.verdictColor}
                      strokeWidth="6"
                      strokeDasharray={`${(result.overallScore / 100) * (2 * Math.PI * 32)} ${2 * Math.PI * 32}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold" style={{ color: result.verdictColor }}>{result.overallScore}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold mb-0.5" style={{ color: result.verdictColor }}>{result.verdict}</div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] text-gray-400 font-mono">{result.address.slice(0, 8)}...{result.address.slice(-6)}</p>
                    <button onClick={() => void copyAddress(result.address)} aria-label="Copy contract address"
                      className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors">
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    <span className="capitalize">{result.chain}</span> network
                    <span className="mx-1.5 text-gray-700">|</span>
                    Scanned {new Date(result.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {/* Color-coded score bar */}
                  <div className="mt-2">
                    <div className="w-full h-2 rounded-full bg-[#1a2235] overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{
                          width: `${result.overallScore}%`,
                          background: `linear-gradient(to right, #EF4444, #F59E0B, #10B981)`,
                          clipPath: `inset(0 ${100 - result.overallScore}% 0 0)`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                      <span>0</span><span>50</span><span>100</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Honest data-coverage strip: which real sources actually responded */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5">Data sources</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Static analysis', ok: !!result.tokenSecurity },
                    { label: 'Live simulation', ok: !!result.honeypotVerdict?.sources.simulation.available },
                    { label: 'Market data', ok: !!result.dexData },
                    { label: 'Address intel', ok: !!result.addressIntel },
                  ].map((src) => (
                    <span key={src.label}
                      className={`text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${src.ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/[0.03] text-gray-600 border-white/10'}`}>
                      {src.ok ? <Check className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                      {src.label}{!src.ok && ': no data'}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Dual-source honeypot reconciliation (GoPlus + Honeypot.is) */}
            {result.honeypotVerdict && <HoneypotVerdictPanel data={result.honeypotVerdict} />}

            {/* Risk Flags */}
            {result.riskFlags.length > 0 && (
              <div className="nl-glass nl-glass--crimson rounded-2xl p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Risk Flags ({result.riskFlags.length})
                </h3>
                <div className="space-y-2">
                  {result.riskFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[12px] text-gray-300">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Token Security Details */}
            {result.tokenSecurity && (
              <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                <h3 className="font-bold text-sm mb-3">Token Security Details</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Honeypot</p>
                    <p className={`text-xs font-bold ${result.tokenSecurity.isHoneypot ? 'text-red-400' : 'text-emerald-400'}`}>
                      {result.tokenSecurity.isHoneypot ? 'Detected' : 'None'}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Buy Tax</p>
                    <p className="text-xs font-bold">{result.tokenSecurity.buyTax}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Sell Tax</p>
                    <p className="text-xs font-bold">{result.tokenSecurity.sellTax}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Holders</p>
                    <p className="text-xs font-bold">{result.tokenSecurity.holderCount.toLocaleString()}</p>
                  </div>
                </div>

                <button onClick={() => setShowChecks(!showChecks)}
                  className="w-full flex items-center justify-between py-2 text-xs text-gray-400 hover:text-white transition-colors">
                  <span>Full Security Checklist</span>
                  {showChecks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showChecks && (
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    {result.tokenSecurity.checks.map((check, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className="text-[11px] text-gray-400">{check.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Address Intel */}
            {result.addressIntel && result.addressIntel.labels.length > 0 && (
              <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                <h3 className="font-bold text-sm mb-3">Intelligence Flags</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: result.addressIntel.riskLevel === 'SAFE' ? '#10B98115' : result.addressIntel.riskLevel === 'CRITICAL' ? '#EF444415' : '#F59E0B15',
                      color: result.addressIntel.riskLevel === 'SAFE' ? '#10B981' : result.addressIntel.riskLevel === 'CRITICAL' ? '#EF4444' : '#F59E0B',
                    }}>
                    {result.addressIntel.riskLevel}
                  </span>
                  <span className="text-[10px] text-gray-500">Intelligence Risk Score: {result.addressIntel.riskScore}/100</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.addressIntel.labels.map((label) => (
                    <span key={label} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{label}</span>
                  ))}
                </div>
              </div>
            )}

            {result.riskFlags.length === 0 && (
              <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(16,185,129,.4), 0 0 16px rgba(16,185,129,.18)' }}>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">No major risks detected</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Contract passed all security checks. Always do your own research.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Security Assessment Summary */}
            <div className="nl-glass rounded-2xl p-4 bg-gradient-to-br from-[#0066FF]/5 to-transparent" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-[#0066FF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-[#0066FF]" />
                </div>
                <span className="font-bold text-sm">Security Assessment Summary</span>
                <span className={`ms-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                  result.overallScore >= 80
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                    : result.overallScore >= 55
                    ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                    : result.overallScore >= 35
                    ? 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30'
                    : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                }`}>
                  {result.overallScore >= 80 ? 'LOW RISK' : result.overallScore >= 55 ? 'MEDIUM RISK' : result.overallScore >= 35 ? 'HIGH RISK' : 'CRITICAL'}
                </span>
              </div>

              {/* Written summary paragraph — real AI if available */}
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                {result.aiAnalysis ? (
                  <div className="space-y-1.5">
                    {result.aiAnalysis.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className={`text-xs leading-relaxed ${
                        line.startsWith('ASSESSMENT:') ? 'text-gray-300 font-medium' :
                        line.startsWith('KEY RISKS:') ? 'text-amber-400 font-semibold mt-1' :
                        line.startsWith('VERDICT:') ? 'text-white font-bold mt-1' :
                        line.startsWith('•') || line.startsWith('-') ? 'text-gray-400 ps-2' :
                        'text-gray-300'
                      }`}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {result.overallScore >= 80
                      ? `Contract scored ${result.overallScore}/100 — ${result.riskFlags.length === 0 ? 'no risk flags detected' : `${result.riskFlags.length} minor flag(s) noted`}. Appears safe for interaction, though DYOR always applies.`
                      : result.overallScore >= 55
                      ? `Contract scored ${result.overallScore}/100 with ${result.riskFlags.length} risk flag(s). ${result.tokenSecurity?.isHoneypot ? 'Honeypot pattern identified. ' : ''}Exercise caution before interacting.`
                      : result.overallScore >= 35
                      ? `Significant issues — score ${result.overallScore}/100. ${result.riskFlags.slice(0, 2).join('. ')}. High caution advised.`
                      : `CRITICAL RISK (${result.overallScore}/100): ${result.riskFlags.slice(0, 3).join('. ')}. Do not interact.`
                    }
                  </p>
                )}
              </div>

              {/* Risk breakdown bars */}
              {result.tokenSecurity && (
                <div className="mb-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Risk Breakdown</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Honeypot Risk', value: result.tokenSecurity.isHoneypot ? 100 : 0, color: result.tokenSecurity.isHoneypot ? '#EF4444' : '#10B981' },
                      { label: 'Ownership Risk', value: (result.tokenSecurity.hasHiddenOwner ? 40 : 0) + (result.tokenSecurity.canTakeBackOwnership ? 35 : 0) + (result.tokenSecurity.ownerCanChangeBalance ? 25 : 0), color: (result.tokenSecurity.hasHiddenOwner || result.tokenSecurity.canTakeBackOwnership || result.tokenSecurity.ownerCanChangeBalance) ? '#F59E0B' : '#10B981' },
                      { label: 'Contract Security', value: Math.max(0, 100 - result.overallScore), color: result.overallScore >= 70 ? '#10B981' : result.overallScore >= 45 ? '#F59E0B' : '#EF4444' },
                      { label: 'Tax Exposure', value: Math.min(100, (parseFloat(result.tokenSecurity.buyTax) || 0) + (parseFloat(result.tokenSecurity.sellTax) || 0)), color: ((parseFloat(result.tokenSecurity.buyTax) || 0) + (parseFloat(result.tokenSecurity.sellTax) || 0)) > 15 ? '#EF4444' : ((parseFloat(result.tokenSecurity.buyTax) || 0) + (parseFloat(result.tokenSecurity.sellTax) || 0)) > 5 ? '#F59E0B' : '#10B981' },
                    ].map((bar) => (
                      <div key={bar.label}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-400">{bar.label}</span>
                          <span className="font-semibold" style={{ color: bar.color }}>{bar.value}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${bar.value}%`, backgroundColor: bar.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <p className="text-[10px] text-gray-600">Was this assessment helpful?</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAiFeedback(prev => prev === 'up' ? null : 'up')}
                    className={`p-1.5 rounded-lg transition-colors ${aiFeedback === 'up' ? 'text-[#10B981] bg-[#10B981]/10' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAiFeedback(prev => prev === 'down' ? null : 'down')}
                    className={`p-1.5 rounded-lg transition-colors ${aiFeedback === 'down' ? 'text-[#EF4444] bg-[#EF4444]/10' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* MEVX-parity: similar tokens (shared ticker) + related wallets
                (creator/owner/top holders). Read-only, real provider data. */}
            <RelatedTokensPanels
              address={result.address}
              chain={result.chain}
              symbol={result.dexData?.symbol || undefined}
            />

            <button onClick={() => { setResult(null); setInput(''); }}
              className="w-full nl-btn-neon py-2.5 rounded-xl text-xs text-gray-400 hover:text-white transition-all">
              Analyze another contract
            </button>
          </>
        )}

        {!result && !analyzing && !error && (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0066FF]/10 flex items-center justify-center">
              <Code className="w-8 h-8 text-[#0066FF]/60" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">Enter a contract address to analyze</h3>
            <p className="text-[11px] text-gray-600 mt-1.5 max-w-[260px] mx-auto">
              Detect honeypots, rug pulls, dangerous permissions, and contract risks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContractAnalyzerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#0066FF]" />
      </div>
    }>
      <ContractAnalyzerInner />
    </Suspense>
  );
}
