'use client';

import { useState, useEffect } from 'react';
import { Dna, ArrowLeft, Loader2, TrendingUp, Shield, Target, Brain, Zap, BarChart3, AlertTriangle, CheckCircle, RotateCcw, FileCode2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';

interface DNAAnalysis {
  tradingStyle: string;
  riskProfile: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  metrics: {
    diversification: number;
    timing: number;
    riskManagement: number;
    consistency: number;
    conviction: number;
  };
  recommendations: string[];
  personalityTraits: string[];
  marketOutlook: string;
  portfolioGrade: string;
  topInsight: string;
}

export default function DNAAnalyzerPage() {
  const router = useRouter();
  const { address: walletAddress, connectAuto, connecting: walletConnecting } = useWallet();
  const [analysis, setAnalysis] = useState<DNAAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [isContractAddress, setIsContractAddress] = useState(false);
  const [contractAddress, setContractAddress] = useState('');

  const checkIfContract = async (address: string): Promise<boolean> => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;

    try {
      const rpcUrls = [
        'https://eth.llamarpc.com',
        'https://rpc.ankr.com/eth',
        'https://cloudflare-eth.com',
      ];

      for (const rpcUrl of rpcUrls) {
        try {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getCode',
              params: [address, 'latest'],
              id: 1,
            }),
            signal: AbortSignal.timeout(5000),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.result && data.result !== '0x' && data.result !== '0x0') {
              return true;
            }
            return false;
          }
        } catch {
          continue;
        }
      }
    } catch {}

    return false;
  };

  const runAnalysis = async (address: string) => {
    setLoading(true);
    setError('');
    setAnalysis(null);
    setIsContractAddress(false);
    setContractAddress('');

    try {
      const isContract = await checkIfContract(address.trim());
      if (isContract) {
        setIsContractAddress(true);
        setContractAddress(address.trim());
        setLoading(false);
        return;
      }

      let holdings: any[] = [];
      let totalBalance = 0;

      try {
        const balRes = await fetch(`/api/wallet-intelligence?address=${encodeURIComponent(address)}`);
        if (balRes.ok) {
          const balData = await balRes.json();
          if (balData.holdings) {
            holdings = balData.holdings;
            totalBalance = parseFloat(balData.totalBalanceUsd || '0');
          }
        }
      } catch {}

      const response = await fetch('/api/dna-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, holdings, totalBalance }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze wallet');
    } finally {
      setLoading(false);
    }
  };

  const connectAndAnalyze = async () => {
    try {
      const addr = await connectAuto();
      if (addr) {
        runAnalysis(addr);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#0A1EFF';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return '#10B981';
    if (grade.startsWith('B')) return '#0A1EFF';
    if (grade.startsWith('C')) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-8">
      <div className="fixed top-0 w-full z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center px-4 h-14 gap-3">
          <button onClick={() => router.push('/dashboard')} className="hover:bg-white/10 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Dna className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="font-heading font-bold">Trading DNA Analyzer</h1>
          <span className="ml-auto text-[10px] px-2 py-1 bg-[#7C3AED]/20 text-[#7C3AED] rounded-full font-semibold">AI Powered</span>
        </div>
      </div>

      <div className="pt-20 px-4 max-w-2xl mx-auto">
        {!analysis && !loading && !isContractAddress && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Dna className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">Decode Your Trading DNA</h2>
              <p className="text-gray-400 text-sm">AI-powered analysis of your on-chain trading patterns, strengths, and areas for improvement.</p>
            </div>

            {walletAddress ? (
              <div className="space-y-3">
                <div className="glass rounded-xl p-4 border border-white/10 overflow-hidden">
                  <div className="text-[10px] text-gray-500 mb-1">Connected Wallet</div>
                  <div className="text-sm font-mono text-gray-300 truncate">{walletAddress}</div>
                </div>
                <button
                  onClick={() => runAnalysis(walletAddress)}
                  className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                >
                  <Brain className="w-5 h-5" /> Analyze My Trading DNA
                </button>
              </div>
            ) : (
              <button
                onClick={connectAndAnalyze}
                className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                Connect Wallet & Analyze
              </button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center"><span className="px-4 bg-[#0A0E1A] text-xs text-gray-500">or analyze any wallet</span></div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Enter wallet address (0x...)"
                className="flex-1 min-w-0 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#0A1EFF]/50 truncate"
              />
              <button
                onClick={() => manualAddress && runAnalysis(manualAddress)}
                disabled={!manualAddress}
                className="bg-[#111827] border border-white/10 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-[#0A1EFF]" />
              </button>
            </div>

            {error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-[#EF4444] text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {isContractAddress && (
          <div className="space-y-6 animate-fadeInUp">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#F59E0B]/30">
                <FileCode2 className="w-10 h-10 text-[#F59E0B]" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2 text-[#F59E0B]">This is a Smart Contract Address</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                The address you entered is a smart contract, not a wallet. The DNA Analyzer is designed to analyze 
                <span className="text-white font-semibold"> wallet addresses only</span>. It examines personal trading patterns, risk profiles, and portfolio behavior.
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-[#F59E0B]/20 bg-[#F59E0B]/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm mb-1 text-[#F59E0B]">Why can't contracts be analyzed here?</div>
                  <p className="text-sm text-gray-400">
                    Smart contracts don't have trading behavior or portfolio history. They are programs deployed on the blockchain. 
                    To analyze a contract's security, audit status, and risk factors, use our <span className="text-white font-semibold">Token Scanner</span> instead.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-[10px] text-gray-500 mb-1">Address Detected</div>
              <div className="text-sm font-mono text-gray-300 break-all">{contractAddress}</div>
              <div className="mt-2 inline-block px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] rounded text-[10px] font-semibold uppercase tracking-wider">
                Smart Contract
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard/security')}
              className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <Shield className="w-5 h-5" /> Go to Token Scanner
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => {
                setIsContractAddress(false);
                setContractAddress('');
                setManualAddress('');
              }}
              className="w-full border border-white/10 py-3 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Enter a Wallet Address Instead
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-[#0A1EFF] animate-spin" />
            </div>
            <h3 className="text-xl font-heading font-bold mb-2">Analyzing Your DNA...</h3>
            <p className="text-gray-400 text-sm">AI is scanning your on-chain history and trading patterns</p>
            <div className="mt-6 max-w-xs mx-auto space-y-2">
              {['Scanning wallet history', 'Analyzing trade patterns', 'Computing risk profile', 'Generating recommendations'].map((step, i) => (
                <div key={step} className="flex items-center gap-2 text-xs text-gray-400 animate-fadeInUp" style={{ animationDelay: `${i * 0.5}s` }}>
                  <Loader2 className="w-3 h-3 animate-spin text-[#0A1EFF]" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis && (
          <div className="space-y-4 animate-fadeInUp">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-heading font-bold">Your Trading DNA</h2>
              <button onClick={() => setAnalysis(null)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> New Analysis
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4 border border-white/10 text-center">
                <div className="text-4xl font-heading font-bold mb-1" style={{ color: getScoreColor(analysis.overallScore) }}>
                  {analysis.overallScore}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Overall Score</div>
              </div>
              <div className="glass rounded-xl p-4 border border-white/10 text-center">
                <div className="text-4xl font-heading font-bold mb-1" style={{ color: getGradeColor(analysis.portfolioGrade) }}>
                  {analysis.portfolioGrade}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Portfolio Grade</div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-[#0A1EFF]" />
                </div>
                <div>
                  <div className="font-bold text-sm">{analysis.tradingStyle}</div>
                  <div className="text-[10px] text-gray-400">Trading Style</div>
                </div>
                <div className="ml-auto">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    analysis.riskProfile === 'Conservative' ? 'bg-[#10B981]/20 text-[#10B981]' :
                    analysis.riskProfile === 'Moderate' ? 'bg-[#0A1EFF]/20 text-[#0A1EFF]' :
                    analysis.riskProfile === 'Aggressive' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                    'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}>
                    {analysis.riskProfile}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.personalityTraits.map((trait, i) => (
                  <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-300">{trait}</span>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-[#0A1EFF]" />
                <span className="font-bold text-sm">Performance Metrics</span>
              </div>
              <div className="space-y-3">
                {Object.entries(analysis.metrics).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-semibold" style={{ color: getScoreColor(value) }}>{value}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${value}%`, backgroundColor: getScoreColor(value) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-[#0A1EFF]/20 bg-gradient-to-r from-[#0A1EFF]/5 to-transparent">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm mb-1">Key Insight</div>
                  <p className="text-sm text-gray-300">{analysis.topInsight}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4 border border-[#10B981]/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                  <span className="font-bold text-xs text-[#10B981]">Strengths</span>
                </div>
                <div className="space-y-2">
                  {analysis.strengths.map((s, i) => (
                    <div key={i} className="text-xs text-gray-300 flex items-start gap-2">
                      <span className="text-[#10B981] mt-0.5">+</span> {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-xl p-4 border border-[#F59E0B]/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  <span className="font-bold text-xs text-[#F59E0B]">Weaknesses</span>
                </div>
                <div className="space-y-2">
                  {analysis.weaknesses.map((w, i) => (
                    <div key={i} className="text-xs text-gray-300 flex items-start gap-2">
                      <span className="text-[#F59E0B] mt-0.5">!</span> {w}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#7C3AED]" />
                <span className="font-bold text-sm">AI Recommendations</span>
              </div>
              <div className="space-y-2">
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-300 py-2 border-b border-white/5 last:border-0">
                    <span className="w-5 h-5 bg-[#7C3AED]/20 rounded flex items-center justify-center text-[10px] font-bold text-[#7C3AED] flex-shrink-0">{i + 1}</span>
                    {r}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[#0A1EFF]" />
                <span className="font-bold text-sm">Market Outlook</span>
              </div>
              <p className="text-sm text-gray-400">{analysis.marketOutlook}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
