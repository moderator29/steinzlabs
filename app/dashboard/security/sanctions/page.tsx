'use client';

import { useState } from 'react';
import { Gavel, Search, Loader2, ShieldCheck, ShieldAlert, HelpCircle, ExternalLink } from 'lucide-react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

interface OfacResult {
  address: string;
  sanctioned: boolean;
  identifications: Array<{ category?: string; name?: string; description?: string }>;
  source: 'chainalysis' | 'cache' | 'unavailable';
}

const SOURCE_LABEL: Record<OfacResult['source'], string> = {
  chainalysis: 'Chainalysis OFAC list (live)',
  cache: 'Chainalysis OFAC list (cached)',
  unavailable: 'Upstream unavailable',
};

const EXAMPLES = [
  { label: 'Tornado Cash router', value: '0x722122dF12D4e14e13Ac3b6895a86e84145b6967' },
];

export default function SanctionsPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OfacResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    const address = input.trim();
    if (!address) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/security/ofac-check?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Check failed');
        return;
      }
      setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraBackground fullHeight className="text-white">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 nl-fade-up">
          <Gavel className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
          <h2 className="text-sm font-bold">OFAC Sanctions Check</h2>
        </div>

        <TiltCard className="nl-fade-up">
          <div className="nl-glass rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0066FF]/15 flex items-center justify-center flex-shrink-0">
              <Gavel className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Screen any wallet or contract against the live Chainalysis OFAC sanctioned-address
              list before you send, receive, or counterparty-trade. The same check gates the
              relayer and swap-execute paths. Every result traces to the real list.
            </p>
          </div>
        </TiltCard>

        <div className="flex items-center gap-2 nl-fade-up">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" aria-hidden="true" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="Wallet or contract address (EVM or Solana)"
              className="w-full nl-glass rounded-xl ps-9 pe-4 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/40"
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={loading || !input.trim()}
            className="nl-btn-neon px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Check
          </button>
        </div>

        {!result && !loading && !error && (
          <div className="flex items-center gap-2 flex-wrap nl-fade-up">
            <span className="text-[10px] text-gray-600">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.value}
                onClick={() => setInput(ex.value)}
                className="text-[10px] text-[#8B7CFF]/70 hover:text-[#8B7CFF] font-mono px-2 py-1 rounded bg-[#8B7CFF]/5 hover:bg-[#8B7CFF]/10 transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="nl-glass rounded-2xl flex items-center justify-center gap-2 py-12 text-xs text-gray-400 nl-fade-up">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Screening against the OFAC list...
          </div>
        )}

        {error && !loading && (
          <div className="nl-glass rounded-2xl border border-red-500/20 p-4 text-center text-xs text-red-400 nl-fade-up">
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            <TiltCard className="nl-fade-up">
              <div className={`nl-glass rounded-2xl p-5 border ${
                result.source === 'unavailable' ? 'border-slate-500/30 bg-slate-500/5'
                  : result.sanctioned ? 'border-red-500/40 bg-red-500/5'
                  : 'border-emerald-500/30 bg-emerald-500/5'
              }`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
                    backgroundColor: result.source === 'unavailable' ? 'rgba(148,163,184,.12)' : result.sanctioned ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
                  }}>
                    {result.source === 'unavailable'
                      ? <HelpCircle className="w-7 h-7 text-slate-400" aria-hidden="true" />
                      : result.sanctioned
                      ? <ShieldAlert className="w-7 h-7 text-red-400" aria-hidden="true" />
                      : <ShieldCheck className="w-7 h-7 text-emerald-400" aria-hidden="true" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-lg font-bold ${
                      result.source === 'unavailable' ? 'text-slate-300' : result.sanctioned ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {result.source === 'unavailable' ? 'No verdict' : result.sanctioned ? 'Sanctioned' : 'Not sanctioned'}
                    </span>
                    <p className="text-xs text-gray-400 truncate font-mono mt-0.5">{result.address}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {result.source === 'unavailable'
                        ? 'The OFAC source did not respond. Treat as unverified and re-check before transacting.'
                        : result.sanctioned
                        ? 'This address appears on the OFAC sanctioned list. Do not transact with it.'
                        : 'This address is not on the OFAC sanctioned list as of this check.'}
                    </p>
                  </div>
                </div>
              </div>
            </TiltCard>

            <div className="nl-glass rounded-2xl p-4 nl-fade-up">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Source</span>
                <span className="text-xs text-gray-300">{SOURCE_LABEL[result.source]}</span>
              </div>
            </div>

            {result.identifications.length > 0 && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" aria-hidden="true" />
                  Sanction identifications
                </h3>
                <div className="space-y-2">
                  {result.identifications.map((id, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-xl p-3">
                      {id.name && <p className="text-xs font-semibold text-gray-200">{id.name}</p>}
                      {id.category && <p className="text-[10px] uppercase tracking-wider text-red-400 mt-0.5">{id.category}</p>}
                      {id.description && <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{id.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a
              href="https://www.treasury.gov/ofac/downloads/sdnlist.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[10px] text-[#0066FF] hover:underline"
            >
              About the OFAC SDN list <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </>
        )}
      </div>
    </AuroraBackground>
  );
}
