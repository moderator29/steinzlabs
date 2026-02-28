'use client';

import { Shield, ArrowLeft, Search, AlertTriangle, Globe, Scan, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SecurityPage() {
  const router = useRouter();
  const [scanInput, setScanInput] = useState('');
  const [activeScanner, setActiveScanner] = useState('token');
  const [scanned, setScanned] = useState(false);

  const scanners = [
    { id: 'token', icon: Shield, label: 'Token Safety Scanner' },
    { id: 'contract', icon: Scan, label: 'Contract Analyzer' },
    { id: 'rug', icon: AlertTriangle, label: 'Rug Detector' },
    { id: 'phishing', icon: Globe, label: 'Phishing Detector' },
  ];

  const handleScan = () => {
    if (scanInput.trim()) setScanned(true);
  };

  const checks = [
    { label: 'Ownership Renounced', status: 'pass', icon: CheckCircle },
    { label: 'Liquidity Locked', status: 'pass', icon: CheckCircle },
    { label: 'No Mint Function', status: 'pass', icon: CheckCircle },
    { label: 'No Honeypot', status: 'pass', icon: CheckCircle },
    { label: 'Top 10 Holders < 30%', status: 'fail', icon: XCircle },
    { label: 'Contract Verified', status: 'pass', icon: CheckCircle },
    { label: 'No Proxy Contract', status: 'warn', icon: Clock },
    { label: 'Adequate Liquidity', status: 'fail', icon: XCircle },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Security Center</h1>
          <span className="ml-auto px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] rounded text-[10px] font-semibold">NEW</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {scanners.map((scanner) => {
            const Icon = scanner.icon;
            return (
              <button
                key={scanner.id}
                onClick={() => setActiveScanner(scanner.id)}
                className={`rounded-xl p-3 border transition-all text-left ${activeScanner === scanner.id ? 'bg-[#00E5FF]/10 border-[#00E5FF]/30' : 'glass border-white/10 hover:border-white/20'}`}
              >
                <Icon className={`w-5 h-5 mb-1.5 ${activeScanner === scanner.id ? 'text-[#00E5FF]' : 'text-gray-400'}`} />
                <div className="text-xs font-semibold">{scanner.label}</div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Enter token contract address"
            className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#00E5FF]/30"
          />
          <button onClick={handleScan} className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold">
            Scan
          </button>
        </div>

        {scanned && (
          <>
            <div className="glass rounded-xl p-4 border border-white/10 text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="8" strokeDasharray="150 251" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-[#F59E0B]">62</span>
                </div>
              </div>
              <div className="text-sm font-bold text-[#F59E0B]">CAUTION</div>
              <p className="text-[10px] text-gray-500 mt-1">Some risks detected — proceed with care</p>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <h3 className="font-bold text-sm mb-3">Security Checks</h3>
              <div className="space-y-2">
                {checks.map((check) => {
                  const Icon = check.icon;
                  const color = check.status === 'pass' ? '#10B981' : check.status === 'fail' ? '#EF4444' : '#F59E0B';
                  return (
                    <div key={check.label} className="flex items-center gap-3 py-1.5">
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                      <span className="text-xs text-gray-300">{check.label}</span>
                      <span className="ml-auto text-[10px] font-semibold uppercase" style={{ color }}>
                        {check.status === 'pass' ? 'Pass' : check.status === 'fail' ? 'Fail' : 'Warning'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!scanned && (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500">Enter a contract address to scan</h3>
            <p className="text-xs text-gray-600 mt-1">AI-powered security analysis across all chains</p>
          </div>
        )}
      </div>
    </div>
  );
}
