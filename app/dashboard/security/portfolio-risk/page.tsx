'use client';

import { useCallback, useEffect, useState } from 'react';
import { PieChart, AlertTriangle, CheckCircle, Loader2, ShieldAlert } from 'lucide-react';
import { useNakaWallet } from '@/lib/hooks/useNakaWallet';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

interface RiskRow {
  contractAddress: string;
  symbol: string;
  riskLevel: 'safe' | 'warning' | 'danger' | 'unknown';
  score: number;
  flags: string[];
}

interface RiskResponse {
  results: Record<string, RiskRow>;
  summary: {
    scanned: number;
    safe: number;
    warning: number;
    danger: number;
    unknown: number;
    avgScore: number;
    portfolioRisk: 'safe' | 'moderate' | 'high' | 'critical';
  };
}

const CHAIN_IDS: Array<{ id: string; slug: string; label: string }> = [
  { id: '1',     slug: 'ethereum', label: 'Ethereum' },
  { id: '8453',  slug: 'base',     label: 'Base' },
  { id: '42161', slug: 'arbitrum', label: 'Arbitrum' },
  { id: '10',    slug: 'optimism', label: 'Optimism' },
  { id: '137',   slug: 'polygon',  label: 'Polygon' },
  { id: '56',    slug: 'bsc',      label: 'BSC' },
];

export default function PortfolioRiskPage() {
  const naka = useNakaWallet();
  const [chainId, setChainId] = useState('1');
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    if (!naka.address) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const chainMeta = CHAIN_IDS.find(c => c.id === chainId);
      const chainSlug = chainMeta?.slug ?? 'ethereum';
      const tokensRes = await fetch(`/api/wallet/balances?address=${encodeURIComponent(naka.address)}&chain=${chainSlug}`);
      const tokensJson = await tokensRes.json().catch(() => ({}));
      const raw: Array<{ contract_address: string | null; symbol: string | null; is_native?: boolean }> =
        Array.isArray(tokensJson?.tokens) ? tokensJson.tokens : [];
      const tokens = raw
        .filter(t => t.contract_address && !t.is_native)
        .map(t => ({ contractAddress: t.contract_address as string, symbol: t.symbol ?? undefined }));

      if (tokens.length === 0) {
        setError('No tokens detected for this wallet on the selected chain.');
        return;
      }

      const res = await fetch('/api/portfolio-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, chainId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j?.error === 'string' ? j.error : 'Risk scan failed');
        return;
      }
      setData(await res.json());
    } catch {
      setError('Network error while scanning portfolio risk.');
    } finally {
      setLoading(false);
    }
  }, [naka.address, chainId]);

  useEffect(() => {
    if (naka.address) scan();
  }, [naka.address, chainId, scan]);

  if (!naka.address) {
    return (
      <AuroraBackground fullHeight className="text-white">
        <div className="p-4">
          <div className="nl-glass rounded-2xl p-6 text-center text-sm text-gray-400 nl-fade-up">
            Connect a wallet to analyse portfolio risk.
          </div>
        </div>
      </AuroraBackground>
    );
  }

  const summary = data?.summary;
  const rows = data ? Object.values(data.results) : [];

  return (
    <AuroraBackground fullHeight className="text-white">
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
          <h2 className="text-sm font-bold">Portfolio Risk</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CHAIN_IDS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChainId(c.id)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-colors ${
                chainId === c.id
                  ? 'bg-[#0066FF]/15 border-[#0066FF]/40 text-white'
                  : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="nl-glass rounded-2xl flex items-center justify-center gap-2 py-12 text-xs text-gray-400 nl-fade-up">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Scanning every holding against GoPlus…
        </div>
      )}

      {error && !loading && (
        <div className="nl-glass rounded-2xl border border-red-500/20 p-4 text-center text-xs text-red-400 nl-fade-up">
          {error}
        </div>
      )}

      {summary && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 nl-fade-up">
            <SummaryStat label="Scanned" value={summary.scanned} tone="neutral" />
            <SummaryStat label="Safe" value={summary.safe} tone="safe" />
            <SummaryStat label="Warning" value={summary.warning} tone="warning" />
            <SummaryStat label="Danger" value={summary.danger} tone="danger" />
          </div>
          <TiltCard className="nl-fade-up nl-fade-up-1">
          <div className={`nl-glass rounded-2xl p-4 border ${
            summary.portfolioRisk === 'critical' ? 'border-red-500/40'
            : summary.portfolioRisk === 'high' ? 'border-orange-500/40'
            : summary.portfolioRisk === 'moderate' ? 'border-yellow-500/40'
            : 'border-green-500/40'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Portfolio risk</span>
              <span className="text-xs text-gray-500">avg score {summary.avgScore}/100</span>
            </div>
            <div className="text-lg font-bold mt-1 capitalize">
              {summary.portfolioRisk}
            </div>
          </div>
          </TiltCard>

          <div className="space-y-2 nl-fade-up nl-fade-up-2">
            {rows.length === 0 ? (
              <div className="nl-glass rounded-xl p-6 text-center text-xs text-gray-500">
                No scannable tokens returned.
              </div>
            ) : rows
              .sort((a, b) => a.score - b.score)
              .map((r) => (
                <div key={r.contractAddress} className={`nl-glass rounded-xl border p-3 ${
                  r.riskLevel === 'danger' ? 'border-red-500/40'
                  : r.riskLevel === 'warning' ? 'border-yellow-500/40'
                  : r.riskLevel === 'safe' ? 'border-green-500/30'
                  : 'border-white/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {r.riskLevel === 'danger'
                        ? <ShieldAlert className="w-4 h-4 text-red-400" aria-hidden="true" />
                        : r.riskLevel === 'warning'
                        ? <AlertTriangle className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                        : <CheckCircle className="w-4 h-4 text-green-400" aria-hidden="true" />}
                      <span className="text-sm font-semibold">{r.symbol || 'Unknown'}</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400">{r.score}/100</span>
                  </div>
                  {r.flags.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {r.flags.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-[11px] text-gray-400">• {f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
    </AuroraBackground>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'safe' | 'warning' | 'danger' }) {
  const color =
    tone === 'safe' ? 'text-green-400'
    : tone === 'warning' ? 'text-yellow-400'
    : tone === 'danger' ? 'text-red-400'
    : 'text-white';
  return (
    <div className="nl-glass rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
