'use client';

import { useState } from 'react';
import { Copy, TrendingUp, Shield } from 'lucide-react';

interface CopyTradeOptionsProps {
  entityName: string;
  entityPosition: string;
  onCopy: (option: 'mirror' | 'scaled' | 'custom', amount?: number) => void;
}

export function CopyTradeOptions({ entityName, entityPosition, onCopy }: CopyTradeOptionsProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState<'mirror' | 'scaled' | 'custom' | null>(null);

  return (
    <div className="bg-[#0f1320] border border-white/[0.06] rounded-xl p-3 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Copy className="w-3.5 h-3.5 text-[#0A1EFF]" />
        <span className="text-[11px] font-semibold text-gray-300">Copy Smart Money</span>
      </div>

      <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-white/[0.02] rounded-lg">
        <Shield className="w-3 h-3 text-[#10B981]" />
        <span className="text-[10px] text-gray-400">
          <span className="text-white font-medium">{entityName}</span> holds {entityPosition}
        </span>
      </div>

      <div className="space-y-1.5">
        <button
          onClick={() => { setSelectedOption('mirror'); onCopy('mirror'); }}
          className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-colors border ${
            selectedOption === 'mirror'
              ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/30 text-white'
              : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">Mirror Position</span>
            <TrendingUp className="w-3 h-3" />
          </div>
          <span className="text-[9px] text-gray-600">Match exact % allocation</span>
        </button>

        <button
          onClick={() => { setSelectedOption('scaled'); onCopy('scaled'); }}
          className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-colors border ${
            selectedOption === 'scaled'
              ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/30 text-white'
              : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04]'
          }`}
        >
          <div className="font-medium">Scaled (10%)</div>
          <span className="text-[9px] text-gray-600">10% of their position size</span>
        </button>

        <div className="flex gap-1.5">
          <input
            type="number"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            placeholder="Custom $"
            className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30 font-mono"
          />
          <button
            onClick={() => { if (customAmount) { setSelectedOption('custom'); onCopy('custom', parseFloat(customAmount)); } }}
            disabled={!customAmount}
            className="px-3 py-2 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-lg text-[10px] font-bold transition-colors disabled:opacity-30"
          >
            Copy
          </button>
        </div>
      </div>

      <p className="text-[9px] text-gray-700 mt-2 text-center">1% fee on copy trades</p>
    </div>
  );
}
