'use client';

import { useState } from 'react';
import { X, Bell } from 'lucide-react';
import { PriceAlertInput } from '@/lib/market/types';
import { formatPrice } from '@/lib/market/formatters';

interface AlertModalProps {
  tokenId: string;
  symbol: string;
  currentPrice: number;
  onAdd: (input: PriceAlertInput) => Promise<void>;
  onClose: () => void;
}

export function AlertModal({ tokenId, symbol, currentPrice, onAdd, onClose }: AlertModalProps) {
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [email, setEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!price || isNaN(parseFloat(price))) return;
    setLoading(true);
    try {
      await onAdd({ token_id: tokenId, token_symbol: symbol, target_price: parseFloat(price), direction, notify_email: email });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[#0A1EFF]" />
            <span className="text-white font-semibold">Set Price Alert — {symbol}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <p className="text-gray-400 text-sm mb-4">Current: <span className="text-white font-mono">{formatPrice(currentPrice)}</span></p>

        <div className="flex gap-2 mb-4">
          {(['above', 'below'] as const).map((d) => (
            <button key={d} onClick={() => setDirection(d)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                direction === d ? 'bg-[#0A1EFF] text-white' : 'bg-[#141824] text-gray-400 border border-[#1E2433]'
              }`}>
              {d === 'above' ? 'Above $' : 'Below $'}
            </button>
          ))}
        </div>

        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Enter target price..."
          className="w-full bg-[#141824] border border-[#1E2433] rounded-lg px-3 py-2.5 text-white font-mono text-sm mb-3 focus:outline-none focus:border-[#0A1EFF]"
        />
        {price && <p className="text-gray-500 text-xs mb-3">Alert when {symbol} goes {direction} ${parseFloat(price || '0').toFixed(4)}</p>}

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="w-4 h-4 accent-[#0A1EFF]" />
          <span className="text-gray-400 text-sm">Also notify by email</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 border border-[#1E2433] hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!price || loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-[#0A1EFF] text-white hover:bg-[#0916CC] disabled:opacity-50 transition-colors">
            {loading ? 'Setting...' : 'Set Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}
