'use client';

import { Target, ArrowLeft, AlertTriangle, CheckCircle, TrendingUp, Shield, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RiskScannerPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => { setScanning(false); setScanned(true); }, 2000);
  };

  const risks = [
    { name: 'Portfolio Concentration', level: 'High', pct: 78, color: '#EF4444', desc: '65% in single asset (ETH)' },
    { name: 'Impermanent Loss Risk', level: 'Medium', pct: 45, color: '#F59E0B', desc: '3 LP positions at risk' },
    { name: 'Smart Contract Risk', level: 'Low', pct: 15, color: '#10B981', desc: 'All contracts audited' },
    { name: 'Liquidation Risk', level: 'Low', pct: 8, color: '#10B981', desc: 'Health factor: 2.4x' },
    { name: 'Counterparty Risk', level: 'Medium', pct: 42, color: '#F59E0B', desc: '2 unverified protocols' },
    { name: 'Rug Pull Exposure', level: 'Low', pct: 12, color: '#10B981', desc: 'All tokens verified' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Target className="w-5 h-5 text-[#00D4AA]" />
          <h1 className="text-sm font-heading font-bold">AI Risk Scanner</h1>
          <span className="ml-auto px-2 py-0.5 bg-[#00D4AA]/20 text-[#00D4AA] rounded text-[10px] font-semibold">NEW</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!scanned && (
          <div className="glass rounded-xl p-6 border border-white/10 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-[#00D4AA]" />
            </div>
            <h2 className="text-base font-heading font-bold mb-1">AI Portfolio Risk Scanner</h2>
            <p className="text-xs text-gray-500 mb-4">Scan your connected wallet for risks across all positions</p>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="bg-gradient-to-r from-[#00D4AA] to-[#6366F1] px-6 py-3 rounded-xl text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Scanning...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Run Full Scan
                </>
              )}
            </button>
          </div>
        )}

        {scanned && (
          <>
            <div className="glass rounded-xl p-4 border border-white/10 text-center">
              <div className="relative w-24 h-24 mx-auto mb-2">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="8" strokeDasharray="165 251" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#F59E0B]">66</span>
                </div>
              </div>
              <div className="text-sm font-bold text-[#F59E0B]">MODERATE RISK</div>
              <p className="text-[10px] text-gray-500 mt-1">2 high-priority items need attention</p>
            </div>

            <div className="space-y-2">
              {risks.map((risk) => (
                <div key={risk.name} className="glass rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${risk.color}20` }}>
                        {risk.level === 'High' ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: risk.color }} /> : <CheckCircle className="w-3.5 h-3.5" style={{ color: risk.color }} />}
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

            <button onClick={() => setScanned(false)} className="w-full glass py-3 rounded-xl text-xs font-semibold text-[#00D4AA] border border-white/10 hover:bg-white/5 transition-colors">
              Scan Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
