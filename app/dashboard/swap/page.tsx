'use client';

import { ArrowLeftRight, ArrowLeft, ChevronDown, Settings, Zap, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SwapPage() {
  const router = useRouter();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [slippage, setSlippage] = useState('0.5');

  const tokens = ['ETH', 'SOL', 'USDC', 'USDT', 'BNB', 'MATIC', 'ARB', 'AVAX', 'LINK', 'UNI'];

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ArrowLeftRight className="w-5 h-5 text-[#00D4AA]" />
          <h1 className="text-sm font-heading font-bold">Multi-Chain Swap</h1>
          <button className="ml-auto hover:bg-white/10 p-2 rounded-lg transition-colors">
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="glass rounded-2xl p-5 border border-white/10">
          <div className="text-[10px] text-gray-500 mb-2">You Pay</div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => { setFromAmount(e.target.value); setToAmount(e.target.value ? (parseFloat(e.target.value) * 3450).toFixed(2) : ''); }}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-bold focus:outline-none placeholder-gray-600"
            />
            <button className="flex items-center gap-1.5 bg-[#111827] px-3 py-2 rounded-lg text-sm font-semibold border border-white/10">
              <div className="w-5 h-5 bg-[#627EEA] rounded-full flex items-center justify-center text-[8px] font-bold">E</div>
              {fromToken}
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          <div className="text-[10px] text-gray-500">Balance: 4.52 {fromToken}</div>
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <button className="w-10 h-10 bg-[#111827] border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors hover:rotate-180 duration-300">
            <ArrowLeftRight className="w-4 h-4 text-[#00D4AA]" />
          </button>
        </div>

        <div className="glass rounded-2xl p-5 border border-white/10">
          <div className="text-[10px] text-gray-500 mb-2">You Receive</div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="number"
              value={toAmount}
              readOnly
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-bold focus:outline-none placeholder-gray-600"
            />
            <button className="flex items-center gap-1.5 bg-[#111827] px-3 py-2 rounded-lg text-sm font-semibold border border-white/10">
              <div className="w-5 h-5 bg-[#2775CA] rounded-full flex items-center justify-center text-[8px] font-bold">$</div>
              {toToken}
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          <div className="text-[10px] text-gray-500">Balance: 12,480.00 {toToken}</div>
        </div>

        {fromAmount && (
          <div className="glass rounded-xl p-3 border border-white/10 space-y-2">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Rate</span>
              <span>1 {fromToken} = 3,450 {toToken}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Slippage</span>
              <span className="text-[#F59E0B]">{slippage}%</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Network Fee</span>
              <span>~$2.40</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Route</span>
              <span className="text-[#00D4AA]">Uniswap V3 (Best)</span>
            </div>
          </div>
        )}

        <button className="w-full bg-gradient-to-r from-[#00D4AA] to-[#6366F1] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
          <Zap className="w-4 h-4" />
          {fromAmount ? 'Swap Now' : 'Enter Amount'}
        </button>

        <div className="flex gap-2 justify-center">
          {['0.1%', '0.5%', '1.0%', '3.0%'].map((s) => (
            <button key={s} onClick={() => setSlippage(s.replace('%', ''))} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${slippage === s.replace('%', '') ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'bg-[#111827] text-gray-500'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
