'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Globe, Search, AlertTriangle, CheckCircle,
  XCircle, Shield, Loader2, Clock, Info, Brain, ThumbsUp, ThumbsDown, ShieldAlert
} from 'lucide-react';

interface ScanResult {
  url: string;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'PHISHING';
  confidenceScore: number;
  isPhishing: boolean;
  isMalicious: boolean;
  description: string;
  signals: string[];
  scannedAt: string;
}

const VERDICT_CONFIG = {
  SAFE: {
    color: '#10B981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle,
    label: 'Safe',
    description: 'No threats detected for this domain',
  },
  SUSPICIOUS: {
    color: '#F59E0B',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: AlertTriangle,
    label: 'Suspicious',
    description: 'Suspicious signals detected. Exercise caution.',
  },
  PHISHING: {
    color: '#EF4444',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: XCircle,
    label: 'Phishing',
    description: 'This domain is a known threat. Do not interact with it.',
  },
};

const EXAMPLES = [
  'uniswap.org',
  'app.aave.com',
  'metamask.io',
];

export default function DomainShieldPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<'up' | 'down' | null>(null);

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
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold">Domain Shield</h1>
            <p className="text-[10px] text-gray-500">Phishing detection and domain verification</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Banner */}
        <div className="bg-[#0A1EFF]/5 border border-[#0A1EFF]/20 rounded-2xl p-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#0A1EFF] mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Enter any URL or domain to instantly check if it is safe, suspicious, or a known phishing site.
            Protect yourself before connecting your wallet or signing transactions.
          </p>
        </div>

        {/* Input */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Enter URL or domain (e.g. uniswap.org)"
              className="w-full bg-[#0f1320] border border-[#1a1f2e] rounded-xl pl-9 pr-4 py-2.5 text-xs placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || !input.trim()}
            className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Check
          </button>
        </div>

        {/* Examples */}
        {!result && !scanning && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-600">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setInput(ex); }}
                className="text-[10px] text-[#0A1EFF]/60 hover:text-[#0A1EFF] font-mono px-2 py-1 rounded bg-[#0A1EFF]/5 hover:bg-[#0A1EFF]/10 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Scanning State */}
        {scanning && (
          <div className="text-center py-12">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#0A1EFF]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0A1EFF] animate-spin" />
              <Globe className="w-6 h-6 text-[#0A1EFF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Analyzing domain security...</p>
            <p className="text-[10px] text-gray-600 mt-1">Checking phishing databases and risk signals</p>
          </div>
        )}

        {/* Error */}
        {error && !scanning && (
          <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/20 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && config && !scanning && (
          <>
            {/* Verdict Card */}
            <div className={`rounded-2xl p-5 border ${config.border} ${config.bg}`}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}>
                  <config.icon className="w-7 h-7" style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold" style={{ color: config.color }}>{config.label}</span>
                    <span className="text-xs text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded-lg">
                      {result.confidenceScore}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate font-mono">{result.url}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{result.description}</p>
                </div>
              </div>
            </div>

            {/* Risk Signals */}
            {result.signals.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Risk Signals
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

            {/* Clean Result */}
            {result.signals.length === 0 && result.verdict === 'SAFE' && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">Domain appears legitimate</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">No phishing signals, suspicious patterns, or known threats detected.</p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Analysis Card */}
            <div className="bg-[#0A0E1A] rounded-2xl p-4 border border-[#0A1EFF]/20 bg-gradient-to-br from-[#0A1EFF]/5 to-transparent">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-[#0A1EFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-[#0A1EFF]" />
                </div>
                <span className="font-bold text-sm">AI Analysis</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                  result.verdict === 'SAFE'
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                    : result.verdict === 'SUSPICIOUS'
                    ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                    : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                }`}>
                  {result.verdict === 'SAFE' ? 'LOW RISK' : result.verdict === 'SUSPICIOUS' ? 'MEDIUM RISK' : 'HIGH RISK'}
                </span>
              </div>

              {/* AI risk assessment paragraph */}
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  {result.verdict === 'SAFE'
                    ? `Domain "${result.url}" has been analyzed with ${result.confidenceScore}% confidence and appears legitimate. No phishing signals, malicious patterns, or known threat indicators were detected. The domain follows expected patterns for authentic Web3 platforms. You may proceed, but always verify the exact URL before connecting your wallet or signing transactions.`
                    : result.verdict === 'SUSPICIOUS'
                    ? `Domain "${result.url}" shows suspicious characteristics with ${result.confidenceScore}% detection confidence. ${result.signals.length > 0 ? `Key signals: ${result.signals.slice(0, 2).join('; ')}.` : ''} This domain may be impersonating a legitimate platform or attempting to deceive users. Do not connect your wallet or enter credentials until you have independently verified this site.`
                    : `PHISHING ALERT: Domain "${result.url}" has been identified as a known threat with ${result.confidenceScore}% confidence. ${result.signals.length > 0 ? `Threat indicators: ${result.signals.slice(0, 2).join('; ')}.` : ''} This domain is actively attempting to steal credentials or drain wallets. Do not interact with this site under any circumstances. Report to the relevant blockchain community channels immediately.`
                  }
                </p>
              </div>

              {/* Warning level with color coding */}
              <div className="mb-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Threat Assessment</p>
                <div className="space-y-2">
                  {[
                    { label: 'Phishing Risk', value: result.isPhishing ? 95 : result.verdict === 'SUSPICIOUS' ? 45 : 5, color: result.isPhishing ? '#EF4444' : result.verdict === 'SUSPICIOUS' ? '#F59E0B' : '#10B981' },
                    { label: 'Malicious Content', value: result.isMalicious ? 90 : result.verdict === 'SUSPICIOUS' ? 30 : 5, color: result.isMalicious ? '#EF4444' : result.verdict === 'SUSPICIOUS' ? '#F59E0B' : '#10B981' },
                    { label: 'Confidence Score', value: result.confidenceScore, color: result.verdict === 'SAFE' ? '#10B981' : result.verdict === 'SUSPICIOUS' ? '#F59E0B' : '#EF4444' },
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

              {/* Recommendations based on verdict */}
              <div className="mb-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Recommended Actions</p>
                <div className="space-y-1.5">
                  {result.verdict === 'SAFE' ? (
                    <>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                        Verify exact URL matches the official bookmark
                      </div>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                        Confirm SSL certificate is valid before signing
                      </div>
                    </>
                  ) : result.verdict === 'SUSPICIOUS' ? (
                    <>
                      <div className="flex items-start gap-2 text-xs text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Do not connect your wallet to this domain
                      </div>
                      <div className="flex items-start gap-2 text-xs text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Cross-reference with official social media channels
                      </div>
                      <div className="flex items-start gap-2 text-xs text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Check for typosquatting — compare letter by letter
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Do not visit or interact with this domain
                      </div>
                      <div className="flex items-start gap-2 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        If you already connected, revoke approvals immediately
                      </div>
                      <div className="flex items-start gap-2 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Report to Google Safe Browsing and Web3 security communities
                      </div>
                    </>
                  )}
                </div>
              </div>

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

            {/* Safety Tips */}
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0A1EFF]" />
                Safety Reminders
              </h3>
              <div className="space-y-2">
                {[
                  'Always verify the exact URL before connecting your wallet',
                  'Legitimate platforms never ask for your seed phrase',
                  'Check SSL certificate validity in your browser',
                  'Bookmark official sites to avoid search engine spoofing',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0A1EFF]/60 mt-1.5 flex-shrink-0" />
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

            {/* Scan Again */}
            <button
              onClick={() => { setResult(null); setInput(''); }}
              className="w-full bg-[#0f1320] border border-[#1a1f2e] hover:border-[#0A1EFF]/30 py-2.5 rounded-xl text-xs text-gray-400 hover:text-white transition-all"
            >
              Scan another domain
            </button>
          </>
        )}

        {/* Empty State */}
        {!result && !scanning && !error && (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0A1EFF]/10 flex items-center justify-center">
              <Globe className="w-8 h-8 text-[#0A1EFF]/60" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">Enter a URL to check</h3>
            <p className="text-[11px] text-gray-600 mt-1.5 max-w-[260px] mx-auto">
              Instantly verify any website before connecting your wallet or entering credentials
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
