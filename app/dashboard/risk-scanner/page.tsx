'use client';

import { Target, AlertTriangle, CheckCircle, Shield, Zap, Loader2, Wallet, Search, Brain, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';

interface RiskItem {
  name: string;
  level: 'High' | 'Medium' | 'Low';
  pct: number;
  color: string;
  desc: string;
}

function analyzeWalletRisks(holdings: any[], totalUsd: number): { score: number; risks: RiskItem[] } {
  const risks: RiskItem[] = [];

  if (!holdings || holdings.length === 0) {
    return { score: 100, risks: [] };
  }

  const topHolding = holdings[0];
  const topPct = totalUsd > 0 && topHolding?.valueUsd
    ? (parseFloat(topHolding.valueUsd) / totalUsd) * 100
    : 0;

  if (topPct > 80) {
    risks.push({ name: 'Portfolio Concentration', level: 'High', pct: Math.round(topPct), color: '#EF4444', desc: `${topPct.toFixed(0)}% in ${topHolding.symbol || 'single asset'}` });
  } else if (topPct > 50) {
    risks.push({ name: 'Portfolio Concentration', level: 'Medium', pct: Math.round(topPct), color: '#F59E0B', desc: `${topPct.toFixed(0)}% in ${topHolding.symbol || 'single asset'}` });
  } else {
    risks.push({ name: 'Portfolio Concentration', level: 'Low', pct: Math.round(topPct), color: '#10B981', desc: 'Well diversified across holdings' });
  }

  const unknownTokens = holdings.filter(h => !h.valueUsd || parseFloat(h.valueUsd) === 0);
  if (unknownTokens.length > 3) {
    risks.push({ name: 'Unknown Token Exposure', level: 'High', pct: Math.round((unknownTokens.length / holdings.length) * 100), color: '#EF4444', desc: `${unknownTokens.length} tokens with no market value` });
  } else if (unknownTokens.length > 0) {
    risks.push({ name: 'Unknown Token Exposure', level: 'Medium', pct: Math.round((unknownTokens.length / holdings.length) * 100), color: '#F59E0B', desc: `${unknownTokens.length} token${unknownTokens.length > 1 ? 's' : ''} with no market value` });
  } else {
    risks.push({ name: 'Unknown Token Exposure', level: 'Low', pct: 5, color: '#10B981', desc: 'All tokens have market data' });
  }

  const stablecoins = holdings.filter(h => ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'].includes(h.symbol?.toUpperCase()));
  const stablePct = totalUsd > 0
    ? stablecoins.reduce((sum, s) => sum + parseFloat(s.valueUsd || '0'), 0) / totalUsd * 100
    : 0;

  if (stablePct < 5) {
    risks.push({ name: 'No Stablecoin Buffer', level: 'Medium', pct: 60, color: '#F59E0B', desc: 'Less than 5% in stablecoins' });
  } else {
    risks.push({ name: 'Stablecoin Buffer', level: 'Low', pct: Math.round(stablePct), color: '#10B981', desc: `${stablePct.toFixed(0)}% in stablecoins` });
  }

  if (holdings.length < 3) {
    risks.push({ name: 'Low Diversification', level: 'Medium', pct: 50, color: '#F59E0B', desc: `Only ${holdings.length} token${holdings.length > 1 ? 's' : ''} held` });
  } else {
    risks.push({ name: 'Diversification', level: 'Low', pct: 15, color: '#10B981', desc: `${holdings.length} different tokens` });
  }

  if (totalUsd < 100) {
    risks.push({ name: 'Low Portfolio Value', level: 'Low', pct: 10, color: '#10B981', desc: 'Small portfolio, limited exposure' });
  } else if (totalUsd > 50000) {
    risks.push({ name: 'High Value Target', level: 'Medium', pct: 45, color: '#F59E0B', desc: 'Large portfolio, ensure security practices' });
  }

  const highCount = risks.filter(r => r.level === 'High').length;
  const medCount = risks.filter(r => r.level === 'Medium').length;
  const score = Math.max(10, 100 - highCount * 25 - medCount * 12);

  return { score, risks };
}

export default function RiskScannerPage() {
  const router = useRouter();
  const { address: walletAddress } = useWallet();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [manualAddress, setManualAddress] = useState('');
  const [scannedAddress, setScannedAddress] = useState('');
  const [hasData, setHasData] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<'up' | 'down' | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const doScan = async (address: string) => {
    setScanning(true);
    setScannedAddress(address);
    setAiReport(null);
    try {
      const res = await fetch(`/api/wallet-intelligence?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        const holdings = data.holdings || [];
        const totalUsd = parseFloat(data.totalBalanceUsd || '0');
        if (holdings.length === 0) {
          setHasData(false);
          setRiskScore(0);
          setRisks([]);
        } else {
          const { score, risks: analyzedRisks } = analyzeWalletRisks(holdings, totalUsd);
          setHasData(true);
          setRiskScore(score);
          setRisks(analyzedRisks);
          // Kick off AI analysis in background
          setAiLoading(true);
          fetch('/api/dna-analyzer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: address, holdings, totalBalance: data.totalBalanceUsd, txCount: data.txCount || 0 }),
          })
            .then(r => r.json())
            .then(ai => {
              if (ai?.analysis?.topInsight) {
                const summary = [
                  ai.analysis.topInsight,
                  ai.analysis.riskAssessment?.summary || '',
                  ai.analysis.recommendations ? '• ' + (ai.analysis.recommendations as string[]).slice(0, 3).join('\n• ') : '',
                ].filter(Boolean).join('\n\n');
                setAiReport(summary);
              }
            })
            .catch(() => {})
            .finally(() => setAiLoading(false));
        }
      } else {
        setHasData(false);
        setRiskScore(0);
        setRisks([]);
      }
    } catch {
      setHasData(false);
      setRiskScore(0);
      setRisks([]);
    } finally {
      setScanning(false);
      setScanned(true);
    }
  };

  const handleScan = () => {
    const addr = manualAddress.trim() || walletAddress || '';
    if (!addr) return;
    doScan(addr);
  };

  const scoreColor = riskScore >= 75 ? '#10B981' : riskScore >= 50 ? '#F59E0B' : '#EF4444';
  const scoreLabel = riskScore >= 75 ? 'LOW RISK' : riskScore >= 50 ? 'MODERATE RISK' : 'HIGH RISK';
  const strokeDash = (riskScore / 100) * 251;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <Target className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="text-sm font-heading font-bold">AI Risk Scanner</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!scanned && !scanning && (
          <div className="glass rounded-xl p-6 border border-white/10 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-[#0A1EFF]" />
            </div>
            <h2 className="text-base font-heading font-bold mb-1">AI Portfolio Risk Scanner</h2>
            <p className="text-xs text-gray-500 mb-4">Scan any wallet for on-chain risks across all positions</p>

            <div className="mb-4">
              <div className="flex items-center bg-[#111827] rounded-xl border border-white/10 overflow-hidden">
                <Search className="w-4 h-4 text-gray-500 ml-3 flex-shrink-0" />
                <input
                  type="text"
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  placeholder={walletAddress ? `Connected: ${walletAddress.slice(0, 8)}...` : 'Enter wallet address (0x...)'}
                  className="flex-1 bg-transparent py-3 px-2 text-xs placeholder-gray-600 focus:outline-none font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={scanning || (!manualAddress.trim() && !walletAddress)}
              className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-6 py-3 rounded-xl text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              <Zap className="w-4 h-4" /> Run Full Scan
            </button>

            {!walletAddress && !manualAddress && (
              <p className="text-[10px] text-gray-600 mt-3">Enter an address or connect your wallet first</p>
            )}
          </div>
        )}

        {scanning && (
          <div className="glass rounded-xl p-8 border border-white/10 text-center">
            <Loader2 className="w-10 h-10 text-[#0A1EFF] animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold mb-1">Scanning wallet...</p>
            <p className="text-[10px] text-gray-500 font-mono">{scannedAddress.slice(0, 10)}...{scannedAddress.slice(-6)}</p>
          </div>
        )}

        {scanned && !scanning && (
          <>
            {!hasData ? (
              <div className="glass rounded-xl p-6 border border-white/10 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-sm font-semibold mb-1">No transaction data found</p>
                <p className="text-xs text-gray-500">Enter a wallet address with transaction history to run analysis.</p>
              </div>
            ) : (
              <>
                <div className="glass rounded-xl p-4 border border-white/10 text-center">
                  <p className="text-[10px] text-gray-500 font-mono mb-2">{scannedAddress.slice(0, 10)}...{scannedAddress.slice(-6)}</p>
                  <div className="relative w-24 h-24 mx-auto mb-2">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={`${strokeDash} 251`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: scoreColor }}>{riskScore}</span>
                    </div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: scoreColor }}>{scoreLabel}</div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {risks.filter(r => r.level === 'High').length > 0
                      ? `${risks.filter(r => r.level === 'High').length} high-priority item${risks.filter(r => r.level === 'High').length > 1 ? 's' : ''} need attention`
                      : 'Portfolio looks healthy'}
                  </p>
                </div>

                <div className="space-y-2">
                  {risks.map((risk) => (
                    <div key={risk.name} className="glass rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${risk.color}20` }}>
                            {risk.level === 'High' ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: risk.color }} /> : risk.level === 'Medium' ? <Shield className="w-3.5 h-3.5" style={{ color: risk.color }} /> : <CheckCircle className="w-3.5 h-3.5" style={{ color: risk.color }} />}
                          </div>
                          <div>
                            <div className="text-xs font-bold">{risk.name}</div>
                            <div className="text-[10px] text-gray-500">{risk.desc}</div>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${risk.color}20`, color: risk.color }}>{risk.level}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${risk.pct}%`, backgroundColor: risk.color }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Intelligence Report */}
            {hasData && (
              <div className="bg-[#0A0E1A] rounded-xl p-4 border border-[#0A1EFF]/20 bg-gradient-to-br from-[#0A1EFF]/5 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-[#0A1EFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-[#0A1EFF]" />
                  </div>
                  <span className="font-bold text-sm">Intelligence Report</span>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                    riskScore >= 75
                      ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                      : riskScore >= 50
                      ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                      : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                  }`}>
                    {scoreLabel}
                  </span>
                </div>

                {/* AI written assessment */}
                <div className="bg-white/5 rounded-xl p-3 mb-3">
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running AI analysis...
                    </div>
                  ) : aiReport ? (
                    <div className="space-y-1.5">
                      {aiReport.split('\n').filter(Boolean).map((line, i) => (
                        <p key={i} className={`text-xs leading-relaxed ${line.startsWith('•') ? 'text-gray-400 pl-2' : 'text-gray-300'}`}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {riskScore >= 75
                        ? `Wallet ${scannedAddress.slice(0, 8)}...${scannedAddress.slice(-6)} shows a healthy risk profile with a score of ${riskScore}/100. ${risks.filter(r => r.level === 'Low').length} risk categories are within safe parameters.`
                        : riskScore >= 50
                        ? `Wallet ${scannedAddress.slice(0, 8)}...${scannedAddress.slice(-6)} shows a moderate risk profile with a score of ${riskScore}/100. ${risks.filter(r => r.level === 'High').length} high-priority risk(s) detected.`
                        : `Wallet ${scannedAddress.slice(0, 8)}...${scannedAddress.slice(-6)} has a high-risk profile (${riskScore}/100). Immediate rebalancing recommended.`
                      }
                    </p>
                  )}
                </div>

                {/* Risk breakdown chart */}
                <div className="mb-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Risk Category Breakdown</p>
                  <div className="space-y-2">
                    {risks.map((risk) => (
                      <div key={risk.name}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-400">{risk.name}</span>
                          <span className="font-semibold" style={{ color: risk.color }}>{risk.level}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${risk.pct}%`, backgroundColor: risk.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations list */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[#0A1EFF]" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Recommendations</p>
                  </div>
                  <div className="space-y-1.5">
                    {riskScore >= 75 ? (
                      <>
                        <div className="flex items-start gap-2 text-xs text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                          Maintain current diversification strategy
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                          Consider adding stablecoin buffer for volatility protection
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                          Review contract approvals periodically
                        </div>
                      </>
                    ) : riskScore >= 50 ? (
                      <>
                        <div className="flex items-start gap-2 text-xs text-gray-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                          Reduce concentration in single assets above 50%
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                          Diversify across 5+ tokens for better risk distribution
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                          Add stablecoins to create a portfolio safety buffer
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 text-xs text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          Urgently rebalance — current concentration levels are dangerous
                        </div>
                        <div className="flex items-start gap-2 text-xs text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          Review and revoke unnecessary token approvals immediately
                        </div>
                        <div className="flex items-start gap-2 text-xs text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          Consider hardware wallet for assets above $10K
                        </div>
                        <div className="flex items-start gap-2 text-xs text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          Investigate unknown tokens with no market value
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Feedback */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <p className="text-[10px] text-gray-600">Was this report helpful?</p>
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
            )}

            <button onClick={() => { setScanned(false); setRisks([]); setHasData(false); }} className="w-full glass py-3 rounded-xl text-xs font-semibold text-[#0A1EFF] border border-white/10 hover:bg-white/5 transition-colors">
              Scan Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
