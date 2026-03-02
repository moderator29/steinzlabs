'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Download, Send, Copy, Eye, EyeOff, RefreshCw, Trash2, ChevronRight, Wallet, Key, Shield, Check, AlertTriangle, ExternalLink, Globe, Layers } from 'lucide-react';
import Link from 'next/link';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress: string | null;
  logo?: string;
}

interface WalletData {
  address: string;
  ethBalance?: string;
  totalBalanceUsd: string;
  holdings: TokenBalance[];
  tokenCount: number;
  chain?: string;
  explorerUrl?: string;
  nativeBalance?: string;
  nativeValueUsd?: string;
}

interface StoredWallet {
  address: string;
  encryptedKey: string;
  name: string;
  createdAt: string;
}

interface ChainInfo {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  color: string;
  explorerUrl: string;
  explorerName: string;
  apiChain: string;
}

const SUPPORTED_CHAINS: ChainInfo[] = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '⟠', color: '#627EEA', explorerUrl: 'https://etherscan.io', explorerName: 'Etherscan', apiChain: 'ethereum' },
  { id: 'base', name: 'Base', symbol: 'ETH', icon: '🔵', color: '#0052FF', explorerUrl: 'https://basescan.org', explorerName: 'BaseScan', apiChain: 'base' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: '⬡', color: '#8247E5', explorerUrl: 'https://polygonscan.com', explorerName: 'PolygonScan', apiChain: 'polygon' },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', icon: '🔺', color: '#E84142', explorerUrl: 'https://snowtrace.io', explorerName: 'SnowTrace', apiChain: 'avalanche' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', icon: '◎', color: '#9945FF', explorerUrl: 'https://solscan.io', explorerName: 'SolScan', apiChain: 'solana' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', icon: '₿', color: '#F7931A', explorerUrl: 'https://blockchair.com/bitcoin', explorerName: 'Blockchair', apiChain: 'bitcoin' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', icon: '🔷', color: '#28A0F0', explorerUrl: 'https://arbiscan.io', explorerName: 'Arbiscan', apiChain: 'arbitrum' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH', icon: '🔴', color: '#FF0420', explorerUrl: 'https://optimistic.etherscan.io', explorerName: 'OpScan', apiChain: 'optimism' },
  { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', icon: '◆', color: '#F0B90B', explorerUrl: 'https://bscscan.com', explorerName: 'BscScan', apiChain: 'bnb' },
  { id: 'fantom', name: 'Fantom', symbol: 'FTM', icon: '👻', color: '#1969FF', explorerUrl: 'https://ftmscan.com', explorerName: 'FtmScan', apiChain: 'fantom' },
  { id: 'cronos', name: 'Cronos', symbol: 'CRO', icon: '💎', color: '#002D74', explorerUrl: 'https://cronoscan.com', explorerName: 'CronoScan', apiChain: 'cronos' },
  { id: 'sui', name: 'Sui', symbol: 'SUI', icon: '💧', color: '#4DA2FF', explorerUrl: 'https://suiscan.xyz', explorerName: 'SuiScan', apiChain: 'sui' },
];

const LIVE_CHAINS = ['ethereum', 'base', 'polygon', 'avalanche', 'solana'];
const EVM_LIVE_CHAINS = ['ethereum', 'base', 'polygon', 'avalanche'];

function simpleEncrypt(text: string, password: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return btoa(result);
}

function simpleDecrypt(encoded: string, password: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return result;
}

export default function WalletPage() {
  const [view, setView] = useState<'main' | 'create' | 'import' | 'send' | 'receive' | 'add-token'>('main');
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<StoredWallet | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [customTokens, setCustomTokens] = useState<string[]>([]);
  const [activeChain, setActiveChain] = useState<ChainInfo>(SUPPORTED_CHAINS[0]);
  const [multiChainBalances, setMultiChainBalances] = useState<Record<string, WalletData | null>>({});
  const [multiChainLoading, setMultiChainLoading] = useState(false);
  const [showAllChains, setShowAllChains] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('steinz_wallets');
    if (stored) {
      const parsed = JSON.parse(stored);
      setWallets(parsed);
      if (parsed.length > 0) setActiveWallet(parsed[0]);
    }
    const tokens = localStorage.getItem('steinz_custom_tokens');
    if (tokens) setCustomTokens(JSON.parse(tokens));
  }, []);

  const saveWallets = (w: StoredWallet[]) => {
    setWallets(w);
    localStorage.setItem('steinz_wallets', JSON.stringify(w));
  };

  const fetchBalances = useCallback(async (address: string, chain: ChainInfo) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wallet-intelligence?address=${address}&chain=${chain.apiChain}`);
      if (res.ok) {
        const data = await res.json();
        setWalletData(data);

        try {
          const existing = JSON.parse(localStorage.getItem('steinz_portfolio_wallet') || '""');
          if (existing !== address) {
            localStorage.setItem('steinz_portfolio_wallet', JSON.stringify(address));
            localStorage.setItem('wallet_address', address);
            localStorage.setItem('wallet_provider', 'builtin');
            window.dispatchEvent(new CustomEvent('steinz_wallet_changed'));
          }
        } catch {}
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMultiChainBalances = useCallback(async (address: string) => {
    setMultiChainLoading(true);
    const results: Record<string, WalletData | null> = {};
    const promises = LIVE_CHAINS.map(async (chainId) => {
      try {
        const res = await fetch(`/api/wallet-intelligence?address=${address}&chain=${chainId}`);
        if (res.ok) {
          const data = await res.json();
          results[chainId] = data;
        } else {
          results[chainId] = null;
        }
      } catch {
        results[chainId] = null;
      }
    });
    await Promise.all(promises);
    setMultiChainBalances(results);
    setMultiChainLoading(false);
  }, []);

  useEffect(() => {
    if (activeWallet) fetchBalances(activeWallet.address, activeChain);
  }, [activeWallet, activeChain, fetchBalances]);

  const handleWalletCreated = (wallet: StoredWallet) => {
    const updated = [...wallets, wallet];
    saveWallets(updated);
    setActiveWallet(wallet);
    setView('main');
  };

  const removeWallet = (addr: string) => {
    const updated = wallets.filter(w => w.address !== addr);
    saveWallets(updated);
    if (activeWallet?.address === addr) {
      setActiveWallet(updated[0] || null);
      setWalletData(null);
      setMultiChainBalances({});
    }
  };

  const totalMultiChainUsd = Object.values(multiChainBalances).reduce((sum, data) => {
    if (data) return sum + parseFloat(data.totalBalanceUsd || '0');
    return sum;
  }, 0);

  if (view === 'create') return <CreateWalletView onBack={() => setView('main')} onCreated={handleWalletCreated} />;
  if (view === 'import') return <ImportWalletView onBack={() => setView('main')} onImported={handleWalletCreated} />;
  if (view === 'send' && activeWallet) return <SendView onBack={() => setView('main')} wallet={activeWallet} chain={activeChain} />;
  if (view === 'receive' && activeWallet) return <ReceiveView onBack={() => setView('main')} address={activeWallet.address} chain={activeChain} />;
  if (view === 'add-token') return <AddTokenView onBack={() => setView('main')} tokens={customTokens} onAdd={(t) => { const updated = [...customTokens, t]; setCustomTokens(updated); localStorage.setItem('steinz_custom_tokens', JSON.stringify(updated)); setView('main'); }} />;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-heading font-bold">STEINZ Wallet</h1>
              <p className="text-gray-400 text-[10px] flex items-center gap-1">
                <Globe className="w-3 h-3" /> Multi-chain non-custodial wallet
              </p>
            </div>
          </div>
          <button onClick={() => activeWallet && fetchBalances(activeWallet.address, activeChain)} disabled={loading} className="p-2 hover:bg-white/10 rounded-lg">
            <RefreshCw className={`w-4 h-4 text-[#00E5FF] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#00E5FF]/10 to-[#7C3AED]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-10 h-10 text-[#00E5FF]" />
            </div>
            <h2 className="text-lg font-bold mb-2">Get Started</h2>
            <p className="text-gray-400 text-sm mb-6">Create a new wallet or import an existing one using your recovery phrase or private key.</p>

            <div className="glass rounded-xl border border-white/10 p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-xs font-bold">12 Chains Supported</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SUPPORTED_CHAINS.map(chain => (
                  <div key={chain.id} className="flex flex-col items-center gap-1 p-2 bg-[#111827] rounded-lg">
                    <span className="text-base">{chain.icon}</span>
                    <span className="text-[9px] text-gray-400 text-center leading-tight">{chain.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <button onClick={() => setView('create')} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Create New Wallet
              </button>
              <button onClick={() => setView('import')} className="w-full py-3 border border-white/10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/5">
                <Download className="w-4 h-4" /> Import Wallet
              </button>
            </div>
            <div className="mt-6 p-3 bg-[#111827] rounded-xl border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[10px] font-semibold text-[#10B981]">Non-Custodial</span>
              </div>
              <p className="text-[10px] text-gray-500">Your keys stay on your device. STEINZ never has access to your private keys or funds.</p>
            </div>
          </div>
        ) : (
          <>
            {wallets.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {wallets.map(w => (
                  <button
                    key={w.address}
                    onClick={() => setActiveWallet(w)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
                      activeWallet?.address === w.address ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
              {SUPPORTED_CHAINS.slice(0, showAllChains ? SUPPORTED_CHAINS.length : 5).map(chain => (
                <button
                  key={chain.id}
                  onClick={() => setActiveChain(chain)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    activeChain.id === chain.id
                      ? 'text-white border-2'
                      : 'bg-[#111827] text-gray-400 border border-white/5 hover:border-white/20'
                  }`}
                  style={activeChain.id === chain.id ? { borderColor: chain.color, backgroundColor: `${chain.color}15` } : {}}
                >
                  <span className="text-sm">{chain.icon}</span>
                  {chain.name}
                  {!LIVE_CHAINS.includes(chain.id) && <span className="text-[8px] text-gray-500 ml-0.5">soon</span>}
                </button>
              ))}
              <button
                onClick={() => setShowAllChains(!showAllChains)}
                className="px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-[#111827] text-gray-400 border border-white/5 hover:border-white/20"
              >
                {showAllChains ? '−' : `+${SUPPORTED_CHAINS.length - 5}`}
              </button>
            </div>

            <div className="glass rounded-2xl p-5 border border-white/10 mb-4">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-lg">{activeChain.icon}</span>
                  <p className="text-gray-400 text-xs">{activeChain.name} Balance</p>
                </div>
                <p className="text-3xl font-bold font-mono">
                  {!LIVE_CHAINS.includes(activeChain.id) ? (
                    <span className="text-lg text-gray-500">Coming Soon</span>
                  ) : loading ? '...' : walletData ? `$${parseFloat(walletData.totalBalanceUsd).toLocaleString()}` : '$0.00'}
                </p>
                {LIVE_CHAINS.includes(activeChain.id) && walletData && (
                  <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                    {walletData.nativeBalance || walletData.ethBalance || '0'} {activeChain.symbol}
                  </p>
                )}
                <p className="text-gray-500 text-[10px] font-mono mt-1">
                  {activeWallet?.address.slice(0, 6)}...{activeWallet?.address.slice(-4)}
                  <button onClick={() => { navigator.clipboard.writeText(activeWallet?.address || ''); }} className="ml-1 inline-flex"><Copy className="w-3 h-3 text-gray-500 hover:text-white" /></button>
                </p>
              </div>

              {EVM_LIVE_CHAINS.includes(activeChain.id) && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setView('send')} className="py-2.5 bg-[#111827] rounded-xl text-xs font-semibold flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
                    <Send className="w-4 h-4 text-[#00E5FF]" /> Send
                  </button>
                  <button onClick={() => setView('receive')} className="py-2.5 bg-[#111827] rounded-xl text-xs font-semibold flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
                    <Download className="w-4 h-4 text-[#10B981]" /> Receive
                  </button>
                  <button onClick={() => setView('add-token')} className="py-2.5 bg-[#111827] rounded-xl text-xs font-semibold flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
                    <Plus className="w-4 h-4 text-[#7C3AED]" /> Add Token
                  </button>
                </div>
              )}

              {activeChain.id === 'solana' && (
                <div className="text-center py-2">
                  <p className="text-[10px] text-gray-500">Solana send/receive requires a Solana keypair — coming soon</p>
                </div>
              )}

              {!LIVE_CHAINS.includes(activeChain.id) && (
                <div className="text-center py-2">
                  <p className="text-[10px] text-gray-500">{activeChain.name} integration coming soon</p>
                </div>
              )}
            </div>

            {activeWallet && LIVE_CHAINS.includes(activeChain.id) && (
              <div className="glass rounded-xl border border-white/10 overflow-hidden mb-4">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => activeWallet && fetchMultiChainBalances(activeWallet.address)}
                      disabled={multiChainLoading}
                      className="text-[10px] px-2 py-1 bg-[#111827] rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                    >
                      <Layers className="w-3 h-3" />
                      {multiChainLoading ? 'Scanning...' : 'Scan All Chains'}
                    </button>
                  </div>
                  {Object.keys(multiChainBalances).length > 0 && (
                    <span className="text-[10px] font-mono text-[#00E5FF]">
                      Total: ${totalMultiChainUsd.toLocaleString()}
                    </span>
                  )}
                </div>
                {Object.keys(multiChainBalances).length > 0 && (
                  <div className="divide-y divide-white/5">
                    {LIVE_CHAINS.map(chainId => {
                      const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
                      const data = multiChainBalances[chainId];
                      if (!chain) return null;
                      const balance = data ? parseFloat(data.totalBalanceUsd || '0') : 0;
                      return (
                        <button
                          key={chainId}
                          onClick={() => setActiveChain(chain)}
                          className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors ${activeChain.id === chainId ? 'bg-white/5' : ''}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{chain.icon}</span>
                            <div className="text-left">
                              <p className="text-xs font-semibold">{chain.name}</p>
                              <p className="text-[10px] text-gray-500">{chain.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono">${balance.toLocaleString()}</p>
                            {data && data.holdings?.[0] && (
                              <p className="text-[10px] text-gray-500">{data.holdings[0].balance} {chain.symbol}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="glass rounded-xl border border-white/10 overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>{activeChain.icon}</span> {activeChain.name} Holdings
                </h3>
                <span className="text-[10px] text-gray-500">{walletData?.tokenCount || 0} tokens</span>
              </div>
              {LIVE_CHAINS.includes(activeChain.id) ? (
                walletData?.holdings && walletData.holdings.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {walletData.holdings.map((token, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${activeChain.color}20` }}>
                            <span className="text-[10px] font-bold">{token.symbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{token.symbol}</p>
                            <p className="text-[10px] text-gray-500">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono">{token.balance}</p>
                          {token.valueUsd && <p className="text-[10px] text-gray-500">${parseFloat(token.valueUsd).toLocaleString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-gray-500 text-xs">
                    {loading ? 'Loading...' : 'No tokens found'}
                  </div>
                )
              ) : (
                <div className="px-4 py-6 text-center text-gray-500 text-xs">
                  {activeChain.name} support coming soon
                </div>
              )}
            </div>

            <div className="glass rounded-xl border border-white/10 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-xs font-bold">Supported Chains</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {SUPPORTED_CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => setActiveChain(chain)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                      activeChain.id === chain.id ? 'bg-white/10 border border-white/20' : 'bg-[#111827] border border-transparent hover:border-white/10'
                    }`}
                  >
                    <span className="text-sm">{chain.icon}</span>
                    <span className="text-[8px] text-gray-400 text-center leading-tight">{chain.symbol}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setView('create')} className="flex-1 py-2 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/5 flex items-center justify-center gap-1">
                <Plus className="w-3 h-3" /> New Wallet
              </button>
              <button onClick={() => setView('import')} className="flex-1 py-2 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/5 flex items-center justify-center gap-1">
                <Download className="w-3 h-3" /> Import
              </button>
              <button onClick={() => activeWallet && removeWallet(activeWallet.address)} className="py-2 px-3 border border-[#EF4444]/20 text-[#EF4444] rounded-lg text-xs font-semibold hover:bg-[#EF4444]/10">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {activeWallet && LIVE_CHAINS.includes(activeChain.id) && (
              <a
                href={`${activeChain.explorerUrl}/address/${activeWallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full py-2 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
              >
                View on {activeChain.explorerName} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CreateWalletView({ onBack, onCreated }: { onBack: () => void; onCreated: (w: StoredWallet) => void }) {
  const [step, setStep] = useState<'password' | 'phrase' | 'confirm'>('password');
  const [password, setPassword] = useState('');
  const [walletName, setWalletName] = useState('Wallet 1');
  const [mnemonic, setMnemonic] = useState('');
  const [address, setAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [creating, setCreating] = useState(false);

  const createWallet = async () => {
    if (!password || password.length < 6) return;
    setCreating(true);
    try {
      const ethers = await import('ethers');
      const wallet = ethers.Wallet.createRandom();
      setMnemonic(wallet.mnemonic?.phrase || '');
      setAddress(wallet.address);
      setPrivateKey(wallet.privateKey);
      setStep('phrase');
    } catch (e) {
      console.error('Wallet creation error:', e);
    } finally {
      setCreating(false);
    }
  };

  const confirmAndSave = () => {
    const encrypted = simpleEncrypt(privateKey, password);
    onCreated({
      address,
      encryptedKey: encrypted,
      name: walletName,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-1">Create New Wallet</h1>
        <p className="text-gray-400 text-xs mb-6">Your keys, your crypto. Works across 12 chains.</p>

        {step === 'password' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Wallet Name</label>
              <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Set Password (min 6 chars)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Secure password to encrypt your keys" />
            </div>
            <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="text-[10px] font-semibold text-[#F59E0B]">Important</span>
              </div>
              <p className="text-[10px] text-gray-400">This password encrypts your private key locally. If you lose it, you can only recover your wallet with the recovery phrase.</p>
            </div>
            <button onClick={createWallet} disabled={password.length < 6 || creating} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
              {creating ? 'Generating...' : 'Generate Wallet'}
            </button>
          </div>
        )}

        {step === 'phrase' && (
          <div className="space-y-4">
            <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span className="text-xs font-bold text-[#EF4444]">Write Down Your Recovery Phrase</span>
              </div>
              <p className="text-[10px] text-gray-400">This is the ONLY way to recover your wallet. Write it down and store it safely. Never share it with anyone.</p>
            </div>

            <div className="relative">
              <div className={`grid grid-cols-3 gap-2 p-4 bg-[#111827] rounded-xl border border-white/10 ${!showPhrase ? 'blur-md select-none' : ''}`}>
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="flex items-center gap-1.5 py-1">
                    <span className="text-[10px] text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-xs font-mono">{word}</span>
                  </div>
                ))}
              </div>
              {!showPhrase && (
                <button onClick={() => setShowPhrase(true)} className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#111827] rounded-lg border border-white/10">
                    <Eye className="w-4 h-4" /> <span className="text-xs font-semibold">Tap to Reveal</span>
                  </div>
                </button>
              )}
            </div>

            <button onClick={() => navigator.clipboard.writeText(mnemonic)} className="w-full py-2 border border-white/10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-white/5">
              <Copy className="w-3 h-3" /> Copy Phrase
            </button>

            <div className="p-3 bg-[#111827] rounded-xl border border-white/5">
              <p className="text-[10px] text-gray-400 mb-1"><strong>Address:</strong></p>
              <p className="text-xs font-mono text-[#00E5FF] break-all">{address}</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded" />
              <span className="text-xs text-gray-400">I have saved my recovery phrase securely</span>
            </label>

            <button onClick={confirmAndSave} disabled={!confirmed} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
              <Check className="w-4 h-4 inline mr-1" /> Continue to Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportWalletView({ onBack, onImported }: { onBack: () => void; onImported: (w: StoredWallet) => void }) {
  const [method, setMethod] = useState<'phrase' | 'key'>('phrase');
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [walletName, setWalletName] = useState('Imported Wallet');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!input.trim() || !password || password.length < 6) return;
    setImporting(true);
    setError('');
    try {
      const ethers = await import('ethers');
      let wallet: any;
      if (method === 'phrase') {
        wallet = ethers.Wallet.fromPhrase(input.trim());
      } else {
        wallet = new ethers.Wallet(input.trim());
      }
      const encrypted = simpleEncrypt(wallet.privateKey, password);
      onImported({
        address: wallet.address,
        encryptedKey: encrypted,
        name: walletName,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e.message || 'Invalid input. Check your recovery phrase or private key.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-1">Import Wallet</h1>
        <p className="text-gray-400 text-xs mb-6">Import using recovery phrase or private key</p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setMethod('phrase')} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${method === 'phrase' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
            Recovery Phrase
          </button>
          <button onClick={() => setMethod('key')} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${method === 'key' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
            Private Key
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Wallet Name</label>
            <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{method === 'phrase' ? 'Recovery Phrase (12 or 24 words)' : 'Private Key'}</label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={method === 'phrase' ? 4 : 2}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50 resize-none"
              placeholder={method === 'phrase' ? 'word1 word2 word3 ...' : '0x...'}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Set Password (min 6 chars)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Encrypt your keys" />
          </div>

          {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 p-2 rounded-lg">{error}</p>}

          <button onClick={handleImport} disabled={importing || !input.trim() || password.length < 6} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
            {importing ? 'Importing...' : 'Import Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SendView({ onBack, wallet, chain }: { onBack: () => void; wallet: StoredWallet; chain: ChainInfo }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'input' | 'sending' | 'success' | 'error'>('input');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!to || !amount || !password) return;
    setStatus('sending');
    setError('');
    try {
      const ethers = await import('ethers');
      const decryptedKey = simpleDecrypt(wallet.encryptedKey, password);
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_ALCHEMY_RPC || 'https://eth.llamarpc.com'
      );
      const signer = new ethers.Wallet(decryptedKey, provider);
      const tx = await signer.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });
      setTxHash(tx.hash);
      setStatus('success');
    } catch (e: any) {
      setError(e.message || 'Transaction failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-6">Send {chain.symbol}</h1>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[#10B981]" />
            </div>
            <h2 className="text-lg font-bold mb-2">Transaction Sent!</h2>
            <p className="text-gray-400 text-sm mb-4">{amount} {chain.symbol} sent successfully</p>
            <a href={`${chain.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#00E5FF] text-xs underline">View on {chain.explorerName}</a>
            <button onClick={onBack} className="w-full mt-4 py-2.5 border border-white/10 rounded-lg text-sm font-semibold">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Recipient Address</label>
              <input value={to} onChange={e => setTo(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50" placeholder="0x..." />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Amount ({chain.symbol})</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.001" className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50" placeholder="0.01" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Wallet Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Enter your wallet password" />
            </div>
            {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 p-2 rounded-lg">{error}</p>}
            <button onClick={handleSend} disabled={status === 'sending' || !to || !amount || !password} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
              {status === 'sending' ? 'Sending...' : 'Send Transaction'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiveView({ onBack, address, chain }: { onBack: () => void; address: string; chain: ChainInfo }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-6">Receive on {chain.name}</h1>

        <div className="text-center">
          <div className="w-48 h-48 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center p-4">
            <div className="w-full h-full rounded-lg flex items-center justify-center" style={{ backgroundColor: `${chain.color}15` }}>
              <span className="text-6xl">{chain.icon}</span>
            </div>
          </div>
          <p className="text-gray-400 text-xs mb-3">Send {chain.symbol} or tokens to this address on {chain.name}:</p>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-3 mb-4">
            <p className="text-xs font-mono break-all text-[#00E5FF]">{address}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="w-full py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Address</>}
          </button>
          <p className="text-[10px] text-gray-500 mt-3">Only send {chain.name} network tokens to this address. Sending tokens from other networks may result in loss.</p>
        </div>
      </div>
    </div>
  );
}

function AddTokenView({ onBack, tokens, onAdd }: { onBack: () => void; tokens: string[]; onAdd: (addr: string) => void }) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid ERC-20 contract address');
      return;
    }
    if (tokens.includes(address.toLowerCase())) {
      setError('Token already added');
      return;
    }
    onAdd(address.toLowerCase());
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-1">Add Custom Token</h1>
        <p className="text-gray-400 text-xs mb-6">Import any ERC-20 token by contract address</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Token Contract Address</label>
            <input value={address} onChange={e => { setAddress(e.target.value); setError(''); }} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50" placeholder="0x..." />
          </div>
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          <button onClick={handleAdd} disabled={!address} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
            Add Token
          </button>

          {tokens.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-2">Custom Tokens ({tokens.length})</h3>
              <div className="space-y-1">
                {tokens.map(t => (
                  <div key={t} className="flex items-center justify-between bg-[#111827] rounded-lg px-3 py-2 text-[10px] font-mono text-gray-400">
                    <span>{t.slice(0, 10)}...{t.slice(-8)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
