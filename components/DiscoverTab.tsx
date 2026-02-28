'use client';

import { Shield, Search, AlertTriangle, Globe, Scan } from 'lucide-react';
import { useState } from 'react';

export default function DiscoverTab() {
  const [scanInput, setScanInput] = useState('');
  const [activeScanner, setActiveScanner] = useState('token');

  const scanners = [
    { id: 'token', icon: Shield, label: 'Token Safety Scanner' },
    { id: 'contract', icon: Scan, label: 'Contract Analyzer' },
    { id: 'rug', icon: AlertTriangle, label: 'Rug Detector' },
    { id: 'phishing', icon: Globe, label: 'Phishing Detector' },
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Shield className="w-7 h-7 text-[#00E5FF]" />
        </div>
        <h2 className="text-lg font-heading font-bold mb-1">Security Center</h2>
        <p className="text-gray-400 text-xs">AI-Powered Protection for Every Trade</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {scanners.map((scanner) => {
          const Icon = scanner.icon;
          return (
            <button
              key={scanner.id}
              onClick={() => setActiveScanner(scanner.id)}
              className={`rounded-xl p-3 border transition-all text-left ${
                activeScanner === scanner.id
                  ? 'bg-[#00E5FF]/10 border-[#00E5FF]/30'
                  : 'glass border-white/10 hover:border-white/20'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1.5 ${activeScanner === scanner.id ? 'text-[#00E5FF]' : 'text-gray-400'}`} />
              <div className="text-xs font-semibold">{scanner.label}</div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Enter token contract address"
            className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500 font-mono"
          />
        </div>
        <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold hover:scale-105 transition-transform flex items-center gap-1">
          Scan <span>→</span>
        </button>
      </div>
    </div>
  );
}
