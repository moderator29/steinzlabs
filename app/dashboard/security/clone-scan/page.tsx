'use client';

import { useState } from 'react';
import {
  Fingerprint, Search, Loader2, ShieldCheck, ShieldAlert, HelpCircle,
  Copy, GitFork, FlaskConical, History,
} from 'lucide-react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

interface BytecodeResult {
  chain: string;
  address: string;
  match: 'exact' | 'similar' | 'none' | 'unsupported_chain' | 'no_code';
  confidence: number;
  category?: string;
  matchedAddress?: string;
  bytecodeLength?: number;
  jaccard?: number;
}

interface TriangulationVerdict {
  honeypot: boolean;
  sourcesVoted: number;
  sourcesAgreed: number;
  confidence: 'high' | 'medium' | 'low';
  honeypotSources: string[];
  safeSources: string[];
}
interface TriangulationResult {
  chain: string;
  token: string;
  refreshed: string[];
  verdict: TriangulationVerdict;
}

interface DeployerResult {
  available: boolean;
  reason?: string;
  deployer?: string;
  trustScore?: number;
  band?: 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger';
  totalDeployed?: number;
  rugged?: number;
  active?: number;
}

const CHAINS = [
  { slug: 'ethereum', label: 'Ethereum' },
  { slug: 'bsc', label: 'BSC' },
  { slug: 'base', label: 'Base' },
  { slug: 'arbitrum', label: 'Arbitrum' },
  { slug: 'polygon', label: 'Polygon' },
  { slug: 'optimism', label: 'Optimism' },
];

const MATCH_CONFIG: Record<BytecodeResult['match'], { color: string; label: string; Icon: typeof ShieldCheck; detail: string }> = {
  exact: { color: '#EF4444', label: 'Exact rug-pattern match', Icon: ShieldAlert, detail: 'Runtime bytecode is byte-identical to a known malicious contract.' },
  similar: { color: '#F59E0B', label: 'Similar to known rug', Icon: ShieldAlert, detail: 'Bytecode is highly similar to a flagged contract.' },
  none: { color: '#10B981', label: 'No known-rug match', Icon: ShieldCheck, detail: 'Bytecode did not match any signature in the rug database.' },
  no_code: { color: '#94A3B8', label: 'No contract code', Icon: HelpCircle, detail: 'No runtime bytecode at this address (EOA or self-destructed).' },
  unsupported_chain: { color: '#94A3B8', label: 'Chain unsupported', Icon: HelpCircle, detail: 'Bytecode scanning is not available for this chain.' },
};

const BAND_COLOR: Record<NonNullable<DeployerResult['band']>, string> = {
  pristine: '#10B981',
  clean: '#10B981',
  caution: '#F59E0B',
  dangerous: '#F97316',
  'serial-rugger': '#EF4444',
};

export default function CloneScanPage() {
  const [input, setInput] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bytecode, setBytecode] = useState<BytecodeResult | null>(null);
  const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);
  const [deployer, setDeployer] = useState<DeployerResult | null>(null);

  const handleScan = async () => {
    const address = input.trim();
    if (!address) return;
    setLoading(true);
    setError(null);
    setBytecode(null);
    setTriangulation(null);
    setDeployer(null);

    try {
      const [bRes, tRes, dRes] = await Promise.allSettled([
        fetch(`/api/security/bytecode-scan?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`),
        fetch(`/api/security/triangulation?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(address)}`),
        fetch(`/api/security/deployer-history?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(address)}`),
      ]);

      let any = false;
      if (bRes.status === 'fulfilled' && bRes.value.ok) { setBytecode(await bRes.value.json()); any = true; }
      if (tRes.status === 'fulfilled' && tRes.value.ok) { setTriangulation(await tRes.value.json()); any = true; }
      if (dRes.status === 'fulfilled' && dRes.value.ok) { setDeployer(await dRes.value.json()); any = true; }

      if (!any) setError('No security source returned data for this address on the selected chain.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const matchCfg = bytecode ? MATCH_CONFIG[bytecode.match] : null;

  return (
    <AuroraBackground fullHeight className="text-white">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 nl-fade-up">
          <Fingerprint className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
          <h2 className="text-sm font-bold">Clone &amp; Honeypot Scan</h2>
        </div>

        <TiltCard className="nl-fade-up">
          <div className="nl-glass rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0066FF]/15 flex items-center justify-center flex-shrink-0">
              <Fingerprint className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Three real checks on one contract. Bytecode similarity against a known-rug
              signature database, multi-source honeypot triangulation across GoPlus, Honeypot.is,
              de.fi and RugCheck, and the deployer&apos;s on-chain rug history. Sources that have no
              data return an honest empty state.
            </p>
          </div>
        </TiltCard>

        <div className="flex flex-wrap gap-1.5 nl-fade-up">
          {CHAINS.map((c) => (
            <button
              key={c.slug}
              onClick={() => setChain(c.slug)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-colors ${
                chain === c.slug
                  ? 'bg-[#0066FF]/15 border-[#0066FF]/40 text-white'
                  : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 nl-fade-up">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" aria-hidden="true" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Token or contract address (0x...)"
              className="w-full nl-glass rounded-xl ps-9 pe-4 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/40"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={loading || !input.trim()}
            className="nl-btn-neon px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Scan
          </button>
        </div>

        {loading && (
          <div className="nl-glass rounded-2xl flex items-center justify-center gap-2 py-12 text-xs text-gray-400 nl-fade-up">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Running bytecode, triangulation and deployer checks...
          </div>
        )}

        {error && !loading && (
          <div className="nl-glass rounded-2xl border border-red-500/20 p-4 text-center text-xs text-red-400 nl-fade-up">
            {error}
          </div>
        )}

        {/* Bytecode / clone */}
        {bytecode && matchCfg && !loading && (
          <TiltCard className="nl-fade-up">
            <div className="nl-glass rounded-2xl p-4 border" style={{ borderColor: `${matchCfg.color}40` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${matchCfg.color}1A` }}>
                  <GitFork className="w-5 h-5" style={{ color: matchCfg.color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: matchCfg.color }}>{matchCfg.label}</span>
                    {(bytecode.match === 'exact' || bytecode.match === 'similar') && (
                      <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded-lg text-gray-300">
                        {bytecode.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{matchCfg.detail}</p>
                </div>
              </div>
              {(bytecode.category || bytecode.matchedAddress || typeof bytecode.jaccard === 'number') && (
                <div className="mt-3 space-y-1.5 text-[11px]">
                  {bytecode.category && (
                    <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="text-gray-300">{bytecode.category}</span></div>
                  )}
                  {typeof bytecode.jaccard === 'number' && (
                    <div className="flex justify-between"><span className="text-gray-500">Jaccard similarity</span><span className="text-gray-300 font-mono">{bytecode.jaccard.toFixed(3)}</span></div>
                  )}
                  {bytecode.matchedAddress && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-500">Matched contract</span>
                      <button onClick={() => navigator.clipboard.writeText(bytecode.matchedAddress!)} className="font-mono text-gray-300 hover:text-white flex items-center gap-1">
                        {bytecode.matchedAddress.slice(0, 6)}...{bytecode.matchedAddress.slice(-4)}
                        <Copy className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TiltCard>
        )}

        {/* Honeypot triangulation */}
        {triangulation && !loading && (() => {
          const v = triangulation.verdict;
          const noData = v.sourcesVoted === 0;
          return (
            <div className={`nl-glass rounded-2xl p-4 border nl-fade-up ${
              noData ? 'border-slate-500/30'
                : v.honeypot ? 'border-red-500/40'
                : 'border-emerald-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4 text-[#8B7CFF]" aria-hidden="true" />
                <h3 className="font-bold text-sm">Honeypot triangulation</h3>
                <span className={`ms-auto text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-lg ${
                  noData ? 'text-slate-400 bg-slate-500/10'
                    : v.honeypot ? 'text-red-400 bg-red-500/10'
                    : 'text-emerald-400 bg-emerald-500/10'
                }`}>
                  {noData ? 'No data' : v.honeypot ? 'Honeypot' : 'Safe'}
                </span>
              </div>
              {noData ? (
                <p className="text-[11px] text-gray-500">No source voted on this token. Treat as unverified.</p>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {v.sourcesAgreed} of {v.sourcesVoted} sources agreed · {v.confidence} confidence
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {v.honeypotSources.map((s) => (
                      <div key={`hp-${s}`} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                        <span className="text-[11px] text-gray-400">{s}</span>
                        <span className="text-[10px] font-semibold text-red-400">Honeypot</span>
                      </div>
                    ))}
                    {v.safeSources.map((s) => (
                      <div key={`safe-${s}`} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                        <span className="text-[11px] text-gray-400">{s}</span>
                        <span className="text-[10px] font-semibold text-emerald-400">Safe</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Deployer history */}
        {deployer && !loading && (
          <div className="nl-glass rounded-2xl p-4 nl-fade-up">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
              <h3 className="font-bold text-sm">Deployer history</h3>
              {deployer.available && deployer.band && (
                <span className="ms-auto text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-lg" style={{ color: BAND_COLOR[deployer.band], backgroundColor: `${BAND_COLOR[deployer.band]}1A` }}>
                  {deployer.band.replace(/-/g, ' ')}
                </span>
              )}
            </div>
            {deployer.available ? (
              <>
                {typeof deployer.trustScore === 'number' && (
                  <p className="text-[11px] text-gray-500 mb-2">Deployer trust score {deployer.trustScore}/100</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.03] rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-gray-500">Deployed</p>
                    <p className="text-sm font-bold">{deployer.totalDeployed ?? 0}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-gray-500">Dead</p>
                    <p className="text-sm font-bold text-red-400">{deployer.rugged ?? 0}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-gray-500">Active</p>
                    <p className="text-sm font-bold text-emerald-400">{deployer.active ?? 0}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-gray-500">{deployer.reason || 'No deployer history available for this chain.'}</p>
            )}
          </div>
        )}
      </div>
    </AuroraBackground>
  );
}
