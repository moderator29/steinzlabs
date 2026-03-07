'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, LogOut, Copy, Check, ExternalLink } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';

interface WalletConnectButtonProps {
  compact?: boolean;
}

export default function WalletConnectButton({ compact = false }: WalletConnectButtonProps) {
  const {
    address,
    shortAddress,
    provider,
    connecting,
    error,
    isConnected,
    connectEVM,
    connectSolana,
    connectAuto,
    disconnect,
    clearError,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowProviderPicker(false);
        clearError();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearError]);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = provider === 'phantom'
    ? `https://solscan.io/account/${address}`
    : `https://etherscan.io/address/${address}`;

  const handleConnectClick = () => {
    const hasEthereum = typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';
    const hasSolana = typeof window !== 'undefined' && typeof (window as any).solana !== 'undefined';

    if (hasEthereum && hasSolana) {
      setShowProviderPicker(true);
    } else {
      connectAuto();
    }
  };

  if (isConnected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-1.5 bg-gradient-to-r from-[#00D4AA]/10 to-[#6366F1]/10 border border-[#00D4AA]/30 rounded-lg hover:border-[#00D4AA]/60 transition-all ${compact ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'}`}
        >
          <div className="w-2 h-2 bg-[#10B981] rounded-full flex-shrink-0" />
          <span className="font-mono font-semibold">{shortAddress}</span>
          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-[#111827] border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-[60] overflow-hidden">
            <div className="p-3 border-b border-white/10">
              <div className="text-[10px] text-gray-500 mb-1">Connected via {provider === 'phantom' ? 'Phantom' : 'MetaMask'}</div>
              <div className="text-xs font-mono text-white break-all">{address}</div>
            </div>

            <div className="p-1">
              <button
                onClick={copyAddress}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Address'}
              </button>

              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on Explorer
              </a>

              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleConnectClick}
        disabled={connecting}
        className={`flex items-center gap-1.5 bg-gradient-to-r from-[#00D4AA] to-[#6366F1] rounded-lg font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'}`}
      >
        <Wallet className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showProviderPicker && (
        <div className="absolute right-0 mt-2 w-56 bg-[#111827] border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-[60] overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <div className="text-xs font-semibold text-white">Choose Wallet</div>
          </div>
          <div className="p-1">
            <button
              onClick={() => { setShowProviderPicker(false); connectEVM(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 bg-[#F6851B]/10 rounded-lg flex items-center justify-center text-base">🦊</div>
              <div>
                <div className="font-semibold text-white">MetaMask</div>
                <div className="text-[10px] text-gray-500">Ethereum &amp; EVM chains</div>
              </div>
            </button>
            <button
              onClick={() => { setShowProviderPicker(false); connectSolana(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 bg-[#AB9FF2]/10 rounded-lg flex items-center justify-center text-base">👻</div>
              <div>
                <div className="font-semibold text-white">Phantom</div>
                <div className="text-[10px] text-gray-500">Solana</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {error && !showProviderPicker && (
        <div className="absolute right-0 mt-2 w-64 bg-[#111827] border border-red-500/30 rounded-xl shadow-2xl shadow-black/40 z-[60] p-3">
          <div className="text-xs text-red-400 mb-2">{error}</div>
          <button
            onClick={clearError}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
