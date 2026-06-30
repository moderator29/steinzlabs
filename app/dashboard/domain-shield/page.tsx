'use client';

import { useState } from 'react';
import {
  Globe, Search, AlertTriangle, CheckCircle,
  XCircle, Shield, Loader2, Clock, Info, Brain, HelpCircle, Calendar, ShieldCheck,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

type Verdict = 'SAFE' | 'SUSPICIOUS' | 'PHISHING' | 'UNKNOWN';
type SourceStatus = 'clean' | 'flagged' | 'allowlisted' | 'info' | 'unknown';

interface DomainSource {
  id: string;
  label: string;
  available: boolean;
  status: SourceStatus;
  detail: string;
}

interface ScanResult {
  url: string;
  host: string;
  verdict: Verdict;
  safetyScore: number | null;
  signals: string[];
  sources: DomainSource[];
  registeredAt: string | null;
  domainAgeDays: number | null;
  aiSummary: string | null;
  scannedAt: string;
}

const VERDICT_CONFIG: Record<Verdict, {
  color: string;
  border: string;
  bg: string;
  icon: typeof CheckCircle;
  label: string;
  description: string;
}> = {
  SAFE: {
    color: '#10B981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle,
    label: 'Safe',
    description: 'No threats found across the available sources.',
  },
  SUSPICIOUS: {
    color: '#F59E0B',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: AlertTriangle,
    label: 'Suspicious',
    description: 'Some risk signals detected. Exercise caution.',
  },
  PHISHING: {
    color: '#EF4444',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: XCircle,
    label: 'Phishing',
    description: 'Flagged as a known threat. Do not interact with it.',
  },
  UNKNOWN: {
    color: '#94A3B8',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    icon: HelpCircle,
    label: 'Unknown',
    description: 'No data from available sources. Verify independently.',
  },
};

const SOURCE_STATUS_CONFIG: Record<SourceStatus, { color: string; label: string; Icon: typeof CheckCircle }> = {
  clean: { color: '#10B981', label: 'Clean', Icon: CheckCircle },
  flagged: { color: '#EF4444', label: 'Flagged', Icon: XCircle },
  allowlisted: { color: '#10B981', label: 'Allowlisted', Icon: ShieldCheck },
  info: { color: '#8B7CFF', label: 'Info', Icon: Info },
  unknown: { color: '#94A3B8', label: 'No data', Icon: HelpCircle },
};

const EXAMPLES = ['uniswap.org', 'app.aave.com', 'metamask.io'];

export default function DomainShieldPage() {
  const [input, setInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    const url = input.trim();
    if (!url) return;
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/security/domain-shield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Scan failed');
        return;
      }
      setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const config = result ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <AuroraBackground fullHeight className="text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#060A12]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF] to-[#8B7CFF] rounded-xl flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold">Domain Shield</h1>
            <p className="text-[10px] text-gray-500">Multi-source phishing detection and domain verification</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Hero / Info */}
        <TiltCard className="nl-fade-up">
          <div className="nl-glass rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0066FF]/15 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4.5 h-4.5 text-[#0066FF]" />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Enter any URL or domain to verify it against live threat intelligence, the community
              phishing blocklist, and its registration history before you connect a wallet or sign a transaction.
              Every signal shown traces to a real source.
            </p>
          </div>
        </TiltCard>

        {/* Input */}
        <div className="flex items-center gap-2 nl-fade-up">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Enter URL or domain (e.g. uniswap.org)"
              className="w-full nl-glass rounded-xl ps-9 pe-4 py-2.5 text-xs placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/40"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || !input.trim()}
            className="nl-btn-neon px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Check
          </button>
        </div>

        {/* Examples */}
        {!result && !scanning && (
          <div className="flex items-center gap-2 flex-wrap nl-fade-up">
            <span className="text-[10px] text-gray-600">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="text-[10px] text-[#8B7CFF]/70 hover:text-[#8B7CFF] font-mono px-2 py-1 rounded bg-[#8B7CFF]/5 hover:bg-[#8B7CFF]/10 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Scanning State */}
        {scanning && (
          <div className="text-center py-12 nl-fade-up">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#0066FF]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0066FF] animate-spin" />
              <Globe className="w-6 h-6 text-[#0066FF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Checking sources...</p>
            <p className="text-[10px] text-gray-600 mt-1">Threat intelligence · community blocklist · registration history</p>
          </div>
        )}

        {/* Error */}
        {error && !scanning && (
          <div className="nl-glass rounded-2xl p-4 border border-red-500/20 text-center nl-fade-up">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && config && !scanning && (
          <>
            {/* Verdict Card */}
            <TiltCard className="nl-fade-up">
              <div className={`nl-glass rounded-2xl p-5 border ${config.border} ${config.bg}`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}>
                    <config.icon className="w-7 h-7" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-lg font-bold" style={{ color: config.color }}>{config.label}</span>
                      {result.safetyScore !== null ? (
                        <span className="text-xs text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded-lg">
                          Safety score {result.safetyScore} of 100
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded-lg">
                          No score available
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate font-mono">{result.host || result.url}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{config.description}</p>
                  </div>
                </div>

                {/* Safety score bar — drawn ONLY from the real computed score */}
                {result.safetyScore !== null && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-500">Computed safety score</span>
                      <span className="font-semibold" style={{ color: config.color }}>{result.safetyScore} of 100</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${result.safetyScore}%`, backgroundColor: config.color }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TiltCard>

            {/* Unknown honest state */}
            {result.verdict === 'UNKNOWN' && (
              <div className="nl-glass rounded-2xl p-4 border border-slate-500/20 nl-fade-up">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-300">Unknown · no data from available sources</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      None of the threat sources returned data for this domain. This is not a clean
                      verdict. Verify the URL independently before connecting your wallet.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sources — transparent per-source breakdown */}
            <div className="nl-glass rounded-2xl p-4 nl-fade-up">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8B7CFF]" />
                Source breakdown
              </h3>
              <div className="space-y-2">
                {result.sources.map((src) => {
                  const sc = SOURCE_STATUS_CONFIG[src.status];
                  return (
                    <div key={src.id} className="flex items-start gap-2.5 py-1">
                      <sc.Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: sc.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-200">{src.label}</span>
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ color: sc.color, backgroundColor: `${sc.color}1A` }}>
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{src.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Domain age — real RDAP data */}
            {result.domainAgeDays !== null && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#0066FF]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-200">
                      {result.domainAgeDays === 1 ? '1 day old' : `${result.domainAgeDays} days old`}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Registered{' '}
                      {result.registeredAt
                        ? new Date(result.registeredAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'date unavailable'}
                      {result.domainAgeDays < 30 ? ' · very new domains carry elevated risk' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Signals — real signals only */}
            {result.signals.length > 0 && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Risk signals
                </h3>
                <div className="space-y-2">
                  {result.signals.map((signal, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      <span className="text-xs text-gray-300">{signal}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clean result */}
            {result.signals.length === 0 && result.verdict === 'SAFE' && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">No risk signals reported</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">No source flagged this domain. Always confirm the exact URL before signing.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Grounded AI summary — qualitative only, no fabricated numbers */}
            {result.aiSummary && (
              <div className="nl-glass rounded-2xl p-4 border border-[#8B7CFF]/20 nl-fade-up">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-[#8B7CFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-[#8B7CFF]" />
                  </div>
                  <span className="font-bold text-sm">AI summary</span>
                  <span className="ms-auto text-[9px] text-gray-500 uppercase tracking-wider">grounded in the signals above</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{result.aiSummary}</p>
              </div>
            )}

            {/* Safety reminders — static educational guidance, not data */}
            <div className="nl-glass rounded-2xl p-4 nl-fade-up">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0066FF]" />
                Safety reminders
              </h3>
              <div className="space-y-2">
                {[
                  'Always verify the exact URL before connecting your wallet',
                  'Legitimate platforms never ask for your seed phrase',
                  'Check SSL certificate validity in your browser',
                  'Bookmark official sites to avoid search engine spoofing',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0066FF]/60 mt-1.5 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamp */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-600">
              <Clock className="w-3 h-3" />
              Scanned at {new Date(result.scannedAt).toLocaleTimeString()}
            </div>

            {/* Scan again */}
            <button
              onClick={() => { setResult(null); setInput(''); }}
              className="w-full nl-glass nl-glass--interactive py-2.5 rounded-xl text-xs text-gray-400 hover:text-white transition-all"
            >
              Scan another domain
            </button>
          </>
        )}

        {/* Empty State */}
        {!result && !scanning && !error && (
          <div className="text-center py-10 nl-fade-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0066FF]/10 flex items-center justify-center">
              <Globe className="w-8 h-8 text-[#0066FF]/60" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">Enter a URL to check</h3>
            <p className="text-[11px] text-gray-600 mt-1.5 max-w-[260px] mx-auto">
              Instantly verify any website before connecting your wallet or entering credentials
            </p>
          </div>
        )}
      </div>
    </AuroraBackground>
  );
}
