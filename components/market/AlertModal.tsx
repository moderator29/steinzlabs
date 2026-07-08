'use client';

import { useState } from 'react';
import { X, Bell } from 'lucide-react';
import { PriceAlertInput } from '@/lib/market/types';
import { formatPrice } from '@/lib/market/formatters';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!price || isNaN(parseFloat(price))) return;
    setLoading(true);
    try {
      await onAdd({ token_id: tokenId, token_symbol: symbol, target_price: parseFloat(price), direction });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="alert-modal-title">
      <div ref={trapRef} className="nl-glass rounded-xl p-5 w-full max-w-sm max-h-[90dvh] overflow-y-auto" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.35), 0 0 24px rgba(0,102,255,.2)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[#0066FF]" aria-hidden />
            <span id="alert-modal-title" className="text-white font-semibold">Set Price Alert — {symbol}</span>
          </div>
          <button onClick={onClose} aria-label="Close price alert modal" className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <p className="text-gray-400 text-sm mb-4">Current: <span className="text-white font-mono">{formatPrice(currentPrice)}</span></p>

        <div className="flex gap-2 mb-4">
          {(['above', 'below'] as const).map((d) => (
            <button key={d} onClick={() => setDirection(d)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                direction === d ? 'bg-[#0066FF] text-white' : 'bg-[#141824] text-gray-400 border border-[#1E2433]'
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
          className="w-full bg-[#141824] border border-[#1E2433] rounded-lg px-3 py-2.5 text-white font-mono text-sm mb-3 focus:outline-none focus:border-[#0066FF]"
        />
        {price && <p className="text-gray-500 text-xs mb-4">Alert when {symbol} goes {direction} ${parseFloat(price || '0').toFixed(4)} — delivered to your in-app notifications.</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="nl-button--ghost flex-1 py-2.5 rounded-lg text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!price || loading}
            className="nl-button flex-1 py-2.5 rounded-lg text-sm">
            {loading ? 'Setting...' : 'Set Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}
