'use client';

import { useState } from 'react';
import { Shield, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ShadowGuardianScan } from '@/components/security/ShadowGuardianScan';

export default function SecurityCenterPage() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'wallet' | 'threats'>('scanner');
  const [tokenAddress, setTokenAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [scanSubmitted, setScanSubmitted] = useState(false);
  const [walletResult, setWalletResult] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [threats, setThreats] = useState<any[]>([]);
  const [threatsLoading, setThreatsLoading] = useState(false);

  const checkWallet = async () => {
    if (!walletAddress.trim()) return;
    setWalletLoading(true);
    setWalletResult(null);
    try {
      const res = await fetch('/api/security/check-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      setWalletResult(data);
    } catch (err: any) {
      setWalletResult({ error: err.message });
    } finally {
      setWalletLoading(false);
    }
  };

  const loadThreats = async () => {
    setThreatsLoading(true);
    try {
      const wallet = localStorage.getItem('wallet_address') || '';
      const res = await fetch(`/api/security/threats?wallet=${wallet}`);
      const data = await res.json();
      setThreats(data.threats || []);
    } catch (err) {
      console.error('Failed to load threats:', err);
    } finally {
      setThreatsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Security Center"
          description="Shadow Guardian — AI-powered protection for every trade and wallet interaction"
        />

        {/* Security Status Banner */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <div>
            <span className="text-green-500 font-medium">Shadow Guardian Active</span>
            <span className="text-gray-400 text-sm ml-3">Protecting all your transactions in real-time</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            ['scanner', 'Token Scanner'],
            ['wallet', 'Wallet Check'],
            ['threats', 'Threats'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'threats') loadThreats();
              }}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-[#0A1EFF] text-white'
                  : 'bg-[#141824] text-gray-400 hover:text-white border border-[#1E2433]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Token Scanner Tab */}
        {activeTab === 'scanner' && (
          <div className="space-y-4">
            <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Search size={18} className="text-[#0A1EFF]" />
                Token Contract Scanner
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="Enter token contract address..."
                  className="flex-1 bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                />
                <button
                  onClick={() => setScanSubmitted(true)}
                  disabled={!tokenAddress.trim()}
                  className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg"
                >
                  Scan
                </button>
              </div>
            </div>

            {tokenAddress && scanSubmitted && (
              <ShadowGuardianScan
                tokenAddress={tokenAddress}
                onComplete={(result) => {}}
              />
            )}
          </div>
        )}

        {/* Wallet Check Tab */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Shield size={18} className="text-[#0A1EFF]" />
                Wallet Reputation Check
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Enter wallet address..."
                  className="flex-1 bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                />
                <button
                  onClick={checkWallet}
                  disabled={!walletAddress.trim() || walletLoading}
                  className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg"
                >
                  {walletLoading ? 'Checking...' : 'Check'}
                </button>
              </div>
            </div>

            {walletResult && !walletResult.error && (
              <div className={`bg-[#141824] rounded-lg p-6 border ${
                walletResult.status === 'DANGEROUS'
                  ? 'border-red-500'
                  : walletResult.status === 'SUSPICIOUS'
                  ? 'border-yellow-500'
                  : 'border-green-500'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  {walletResult.status === 'VERIFIED' ? (
                    <CheckCircle size={24} className="text-green-500" />
                  ) : walletResult.status === 'DANGEROUS' ? (
                    <XCircle size={24} className="text-red-500" />
                  ) : (
                    <AlertTriangle size={24} className="text-yellow-500" />
                  )}
                  <div>
                    <span className={`font-bold text-lg ${
                      walletResult.status === 'DANGEROUS' ? 'text-red-500' :
                      walletResult.status === 'SUSPICIOUS' ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {walletResult.status}
                    </span>
                    <div className="text-gray-400 text-sm">Reputation Score: {walletResult.score}/100</div>
                  </div>
                </div>
                {walletResult.reasons?.map((reason: string, i: number) => (
                  <p key={i} className="text-gray-300 text-sm mb-1">• {reason}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Threats Tab */}
        {activeTab === 'threats' && (
          <div className="space-y-3">
            {threatsLoading ? (
              <div className="text-center py-12 text-gray-500">Loading threats...</div>
            ) : threats.length === 0 ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-8 text-center">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
                <div className="text-green-500 font-bold text-lg">No Threats Detected</div>
                <div className="text-gray-400 text-sm mt-2">Your portfolio is clean</div>
              </div>
            ) : (
              threats.map((threat: any) => (
                <div key={threat.id} className={`bg-[#141824] rounded-lg p-5 border ${
                  threat.severity === 'CRITICAL' ? 'border-red-500' :
                  threat.severity === 'WARNING' ? 'border-yellow-500' : 'border-gray-600'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          threat.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' :
                          threat.severity === 'WARNING' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {threat.severity}
                        </span>
                        <span className="text-white font-medium">{threat.token_symbol}</span>
                      </div>
                      <p className="text-gray-400 text-sm">{threat.threat_type}</p>
                      <p className="text-gray-300 text-sm mt-1">{threat.recommendation}</p>
                    </div>
                    <button className="text-gray-500 hover:text-white text-sm transition-colors">
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
