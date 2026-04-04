'use client';

import { Target, ArrowLeft, AlertTriangle, CheckCircle, Shield, Zap, Loader2, Wallet, Search } from 'lucide-react';
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

  const doScan = async (address: string) => {
    setScanning(true);
    setScannedAddress(address);
    try {
      const res = await fetch(`/api/wallet-intelligence?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        const totalUsd = parseFloat(data.totalBalanceUsd || '0');
        const { score, risks: analyzedRisks } = analyzeWalletRisks(data.holdings || [], totalUsd);
        setRiskScore(score);
        setRisks(analyzedRisks);
      } else {
        setRiskScore(0);
        setRisks([]);
      }
    } catch {
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
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
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
            {risks.length === 0 ? (
              <div className="glass rounded-xl p-6 border border-white/10 text-center">
                <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-semibold mb-1">No holdings found</p>
                <p className="text-xs text-gray-500">This wallet has no token balances to analyze</p>
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

            <button onClick={() => { setScanned(false); setRisks([]); }} className="w-full glass py-3 rounded-xl text-xs font-semibold text-[#0A1EFF] border border-white/10 hover:bg-white/5 transition-colors">
              Scan Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
