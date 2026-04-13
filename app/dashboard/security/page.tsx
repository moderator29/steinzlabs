'use client';

import { Shield, ArrowLeft, Search, AlertTriangle, Globe, Scan, CheckCircle, XCircle, Clock, Loader2, ExternalLink, Copy, Wallet, ArrowRight, Brain, ThumbsUp, ThumbsDown, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ScanResult {
  contract: string;
  chainId: string;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  creatorAddress: string;
  ownerAddress: string;
  trustScore: number;
  safetyLevel: string;
  safetyColor: string;
  buyTax: string;
  sellTax: string;
  isHoneypot: boolean;
  isOpenSource: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasHiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  ownerCanChangeBalance: boolean;
  lpHolders: any[];
  lpTotalSupply: string;
  checks: { label: string; status: string }[];
  timestamp: string;
  dexData?: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
    fdv: number;
    marketCap: number;
    url?: string;
  };
  solanaNote?: string;
  aiAnalysis?: string;
}

const CHAINS = [
  { id: '1', label: 'Ethereum', key: 'ethereum' },
  { id: '56', label: 'BSC', key: 'bsc' },
  { id: '137', label: 'Polygon', key: 'polygon' },
  { id: 'solana', label: 'Solana', key: 'solana' },
  { id: '8453', label: 'Base', key: 'base' },
  { id: '43114', label: 'Avalanche', key: 'avalanche' },
  { id: '42161', label: 'Arbitrum', key: 'arbitrum' },
];

export default function SecurityPage() {
  const router = useRouter();
  const [scanInput, setScanInput] = useState('');
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletRejection, setWalletRejection] = useState<{ error: string; message: string; suggestion: string; redirectUrl: string } | null>(null);
  const [aiFeedback, setAiFeedback] = useState<'up' | 'down' | null>(null);

  const handleScan = async () => {
    const address = scanInput.trim();
    if (!address) return;

    setScanning(true);
    setError(null);
    setResult(null);
    setWalletRejection(null);

    try {
      const res = await fetch('/api/token-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract: address, chain: selectedChain }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isWalletAddress) {
          setWalletRejection(data);
          return;
        }
        setError(data.error || 'Failed to scan token');
        return;
      }

      setResult(data);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const getScoreStroke = (score: number) => {
    const circumference = 2 * Math.PI * 40;
    const filled = (score / 100) * circumference;
    return `${filled} ${circumference}`;
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr === 'N/A') return 'N/A';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const explorerUrl = (addr: string) => {
    const chain = CHAINS.find(c => c.key === selectedChain);
    if (chain?.id === '56') return `https://bscscan.com/address/${addr}`;
    if (chain?.id === '137') return `https://polygonscan.com/address/${addr}`;
    if (chain?.id === 'solana') return `https://solscan.io/token/${addr}`;
    if (chain?.id === '8453') return `https://basescan.org/address/${addr}`;
    if (chain?.id === '43114') return `https://snowtrace.io/address/${addr}`;
    if (chain?.id === '42161') return `https://arbiscan.io/address/${addr}`;
    return `https://etherscan.io/address/${addr}`;
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
  };

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <h1 className="text-sm font-heading font-bold">Security Center</h1>
          <span className="ml-auto px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-lg text-[9px] font-bold">VERIFIED</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {CHAINS.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChain(chain.key)}
              className={`rounded-xl py-2 px-3 border transition-all text-center text-xs font-semibold ${selectedChain === chain.key ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/30 text-[#0A1EFF]' : 'bg-[#0f1320] border-[#1a1f2e] hover:border-[#0A1EFF]/20 text-gray-400'}`}
            >
              {chain.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="Contract address only (0x...), not wallet addresses"
            className="flex-1 bg-[#0f1320] border border-[#1a1f2e] rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30"
          />
          <button
            onClick={handleScan}
            disabled={scanning || !scanInput.trim()}
            className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Scan
          </button>
        </div>

        {scanning && (
          <div className="text-center py-12">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#0A1EFF]/20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0A1EFF] animate-spin"></div>
              <Shield className="w-6 h-6 text-[#0A1EFF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Scanning contract security...</p>
            <p className="text-[10px] text-gray-600 mt-1">Analyzing honeypot risk, ownership, taxes, and more</p>
          </div>
        )}

        {walletRejection && !scanning && (
          <div className="bg-[#0f1320] rounded-2xl p-6 border border-orange-500/30 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-orange-400 mb-2">{walletRejection.error}</h3>
            <p className="text-sm text-gray-400 mb-1">{walletRejection.message}</p>
            <p className="text-xs text-gray-500 mb-4">{walletRejection.suggestion}</p>
            <button
              onClick={() => router.push(`${walletRejection.redirectUrl}?address=${encodeURIComponent(scanInput.trim())}`)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Go to DNA Analyzer <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-gray-600 mt-3">
              The Token Scanner only accepts smart contract addresses for security analysis.
            </p>
          </div>
        )}

        {error && !scanning && !walletRejection && (
          <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/20 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
            <p className="text-[10px] text-gray-500 mt-1">Check the contract address and selected chain</p>
          </div>
        )}

        {result && !scanning && (
          <>
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold">{result.name}</h2>
                  <p className="text-xs text-gray-400 font-mono">{result.symbol}</p>
                </div>
                <a
                  href={explorerUrl(result.contract)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-[#0A1EFF] hover:underline"
                >
                  View on Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                <span>{shortenAddress(result.contract)}</span>
                <button onClick={() => copyAddress(result.contract)} className="hover:text-white transition-colors">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e] text-center">
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={result.safetyColor}
                    strokeWidth="8"
                    strokeDasharray={getScoreStroke(result.trustScore)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold" style={{ color: result.safetyColor }}>{result.trustScore}</span>
                </div>
              </div>
              <div className="text-sm font-bold" style={{ color: result.safetyColor }}>{result.safetyLevel}</div>
              <p className="text-[10px] text-gray-500 mt-1">
                {result.safetyLevel === 'SAFE' && 'Token passed most security checks'}
                {result.safetyLevel === 'CAUTION' && 'Some risks detected, proceed with care'}
                {result.safetyLevel === 'WARNING' && 'Significant risks found, high caution advised'}
                {result.safetyLevel === 'DANGER' && 'Critical risks detected, avoid this token'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0f1320] rounded-2xl p-3 border border-[#1a1f2e]">
                <p className="text-[10px] text-gray-500 mb-1">Holders</p>
                <p className="text-sm font-bold">{result.holderCount.toLocaleString()}</p>
              </div>
              <div className="bg-[#0f1320] rounded-2xl p-3 border border-[#1a1f2e]">
                <p className="text-[10px] text-gray-500 mb-1">Honeypot</p>
                <p className={`text-sm font-bold ${result.isHoneypot ? 'text-red-400' : 'text-green-400'}`}>
                  {result.isHoneypot ? 'YES [!]' : 'NO [ok]'}
                </p>
              </div>
              <div className="bg-[#0f1320] rounded-2xl p-3 border border-[#1a1f2e]">
                <p className="text-[10px] text-gray-500 mb-1">Buy Tax</p>
                <p className="text-sm font-bold">{result.buyTax}</p>
              </div>
              <div className="bg-[#0f1320] rounded-2xl p-3 border border-[#1a1f2e]">
                <p className="text-[10px] text-gray-500 mb-1">Sell Tax</p>
                <p className="text-sm font-bold">{result.sellTax}</p>
              </div>
            </div>

            {result.dexData && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                <h3 className="font-bold text-sm mb-3">Market Data</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Price</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.price < 0.01 ? result.dexData.price.toFixed(8) : result.dexData.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">24h</p>
                    <p className={`text-xs font-bold ${result.dexData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {result.dexData.priceChange24h >= 0 ? '+' : ''}{result.dexData.priceChange24h.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">MCap</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.marketCap > 1e6 ? (result.dexData.marketCap / 1e6).toFixed(2) + 'M' : result.dexData.marketCap > 1000 ? (result.dexData.marketCap / 1000).toFixed(1) + 'K' : result.dexData.marketCap.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Volume</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.volume24h > 1e6 ? (result.dexData.volume24h / 1e6).toFixed(2) + 'M' : result.dexData.volume24h > 1000 ? (result.dexData.volume24h / 1000).toFixed(1) + 'K' : result.dexData.volume24h.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Liquidity</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.liquidity > 1e6 ? (result.dexData.liquidity / 1e6).toFixed(2) + 'M' : result.dexData.liquidity > 1000 ? (result.dexData.liquidity / 1000).toFixed(1) + 'K' : result.dexData.liquidity.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">FDV</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.fdv > 1e6 ? (result.dexData.fdv / 1e6).toFixed(2) + 'M' : result.dexData.fdv > 1000 ? (result.dexData.fdv / 1000).toFixed(1) + 'K' : result.dexData.fdv.toFixed(0)}
                    </p>
                  </div>
                </div>
                {result.dexData.url && (
                  <a href={result.dexData.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 text-[10px] text-[#0A1EFF] hover:underline">
                    View on DexScreener <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <h3 className="font-bold text-sm mb-3">Security Checks</h3>
              <div className="space-y-2">
                {result.checks.map((check) => {
                  const Icon = check.status === 'pass' ? CheckCircle : check.status === 'fail' ? XCircle : Clock;
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

            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <h3 className="font-bold text-sm mb-3">Contract Details</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Open Source</span>
                  <span className={result.isOpenSource ? 'text-green-400' : 'text-red-400'}>{result.isOpenSource ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mintable</span>
                  <span className={result.isMintable ? 'text-red-400' : 'text-green-400'}>{result.isMintable ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Proxy Contract</span>
                  <span className={result.isProxy ? 'text-yellow-400' : 'text-green-400'}>{result.isProxy ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Hidden Owner</span>
                  <span className={result.hasHiddenOwner ? 'text-red-400' : 'text-green-400'}>{result.hasHiddenOwner ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Can Reclaim Ownership</span>
                  <span className={result.canTakeBackOwnership ? 'text-red-400' : 'text-green-400'}>{result.canTakeBackOwnership ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner Changes Balance</span>
                  <span className={result.ownerCanChangeBalance ? 'text-red-400' : 'text-green-400'}>{result.ownerCanChangeBalance ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Creator</span>
                  <span className="font-mono text-gray-400">{shortenAddress(result.creatorAddress)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner</span>
                  <span className="font-mono text-gray-400">{shortenAddress(result.ownerAddress)}</span>
                </div>
              </div>
            </div>

            {/* AI Security Assessment */}
            <div className="bg-[#0A0E1A] rounded-2xl p-4 border border-[#0A1EFF]/20 bg-gradient-to-br from-[#0A1EFF]/5 to-transparent">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-[#0A1EFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-[#0A1EFF]" />
                </div>
                <span className="font-bold text-sm">AI Security Assessment</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                  result.safetyLevel === 'SAFE'
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                    : result.safetyLevel === 'CAUTION'
                    ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                    : result.safetyLevel === 'WARNING'
                    ? 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30'
                    : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                }`}>
                  {result.safetyLevel === 'SAFE' ? 'LOW' : result.safetyLevel === 'CAUTION' ? 'MEDIUM' : result.safetyLevel === 'WARNING' ? 'HIGH' : 'CRITICAL'}
                </span>
              </div>

              {/* Risk summary paragraph — real AI if available, fallback to template */}
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                {result.aiAnalysis ? (
                  <div className="space-y-1.5">
                    {result.aiAnalysis.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className={`text-xs leading-relaxed ${
                        line.startsWith('SUMMARY:') ? 'text-gray-300 font-medium' :
                        line.startsWith('RISKS:') ? 'text-amber-400 font-semibold mt-2' :
                        line.startsWith('VERDICT:') ? 'text-white font-bold mt-2' :
                        line.startsWith('•') || line.startsWith('-') ? 'text-gray-400 pl-2' :
                        'text-gray-300'
                      }`}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {result.safetyLevel === 'SAFE' && `This token (${result.symbol}) has passed all critical security checks with a trust score of ${result.trustScore}/100. The contract is ${result.isOpenSource ? 'open-source and verifiable' : 'not open-source'}, with ${result.holderCount.toLocaleString()} holders on-chain. Buy tax is ${result.buyTax} and sell tax is ${result.sellTax}. No honeypot behavior was detected.`}
                    {result.safetyLevel === 'CAUTION' && `Token ${result.symbol} shows a trust score of ${result.trustScore}/100 and warrants caution. ${result.isHoneypot ? 'A honeypot pattern was detected — you may be unable to sell. ' : ''}${result.isMintable ? 'The contract is mintable, which could allow supply inflation. ' : ''}Taxes are ${result.buyTax} buy / ${result.sellTax} sell.`}
                    {result.safetyLevel === 'WARNING' && `Significant risks identified for ${result.symbol} (score: ${result.trustScore}/100). ${result.isHoneypot ? 'HONEYPOT DETECTED. ' : ''}${result.ownerCanChangeBalance ? 'Owner can modify balances. ' : ''}${result.canTakeBackOwnership ? 'Rugpull mechanism active. ' : ''}Exercise extreme caution.`}
                    {result.safetyLevel === 'DANGER' && `CRITICAL: ${result.symbol} has failed multiple security checks (score: ${result.trustScore}/100). ${result.isHoneypot ? 'HONEYPOT — funds may be trapped. ' : ''}${result.ownerCanChangeBalance ? 'Owner can drain balances. ' : ''}Do not interact with this contract.`}
                  </p>
                )}
              </div>

              {/* Specific warnings */}
              {(result.isHoneypot || result.isMintable || result.hasHiddenOwner || result.canTakeBackOwnership || result.ownerCanChangeBalance || result.isProxy) && (
                <div className="mb-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Specific Warnings</p>
                  <div className="space-y-1.5">
                    {result.isHoneypot && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Honeypot detected — selling transactions may be blocked
                      </div>
                    )}
                    {result.isMintable && (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Mintable supply — owner can inflate token supply at any time
                      </div>
                    )}
                    {result.hasHiddenOwner && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Hidden owner present — contract control is concealed
                      </div>
                    )}
                    {result.canTakeBackOwnership && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Ownership can be reclaimed — rugpull vector exists
                      </div>
                    )}
                    {result.ownerCanChangeBalance && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Owner can modify balances — direct theft risk
                      </div>
                    )}
                    {result.isProxy && (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Proxy contract — underlying logic can be changed by owner
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="mb-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Recommendations</p>
                <div className="space-y-1.5">
                  {result.safetyLevel === 'SAFE' && (
                    <>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                        Token passed security checks — suitable for standard research
                      </div>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                        Still verify liquidity depth and team reputation before investing
                      </div>
                    </>
                  )}
                  {(result.safetyLevel === 'CAUTION' || result.safetyLevel === 'WARNING') && (
                    <>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        Limit position size and use stop-loss strategies
                      </div>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        Verify contract ownership structure and community trust
                      </div>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        Monitor for sudden liquidity changes or owner activity
                      </div>
                    </>
                  )}
                  {result.safetyLevel === 'DANGER' && (
                    <>
                      <div className="flex items-start gap-2 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Do not purchase or interact with this contract
                      </div>
                      <div className="flex items-start gap-2 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        If already holding, do not attempt additional transactions
                      </div>
                      <div className="flex items-start gap-2 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Report to community channels to warn other users
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Feedback */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <p className="text-[10px] text-gray-600">Was this assessment helpful?</p>
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

            <p className="text-[10px] text-gray-600 text-center">
              Security analysis verified • Scanned at {new Date(result.timestamp).toLocaleTimeString()}
            </p>
          </>
        )}

        {!result && !scanning && !error && !walletRejection && (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500">Enter a contract address to scan</h3>
            <p className="text-xs text-gray-600 mt-1">Real-time security analysis and threat detection</p>
            <div className="mt-4 space-y-1">
              <p className="text-[10px] text-gray-600">Try these examples:</p>
              <button
                onClick={() => { setScanInput('0xdac17f958d2ee523a2206206994597c13d831ec7'); setSelectedChain('ethereum'); }}
                className="text-[10px] text-[#0A1EFF]/60 hover:text-[#0A1EFF] font-mono block mx-auto"
              >
                USDT (Ethereum)
              </button>
              <button
                onClick={() => { setScanInput('0x55d398326f99059ff775485246999027b3197955'); setSelectedChain('bsc'); }}
                className="text-[10px] text-[#0A1EFF]/60 hover:text-[#0A1EFF] font-mono block mx-auto"
              >
                USDT (BSC)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
