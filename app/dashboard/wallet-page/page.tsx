'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Download, Send, Copy, Eye, EyeOff, RotateCcw, Trash2, ChevronRight, Wallet, Key, Shield, Check, AlertTriangle, ExternalLink, Globe, Layers, ArrowUpRight, ArrowDownLeft, Repeat, DollarSign, TrendingUp, TrendingDown, Settings, Search, QrCode, X } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { notifyWalletCreated, notifyWalletImported } from '@/lib/notifications';

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
  color: string;
  explorerUrl: string;
  explorerName: string;
  apiChain: string;
  logoUrl: string;
  coinGeckoId: string;
}

const COIN_LOGOS: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  FTM: 'https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png',
  CRO: 'https://assets.coingecko.com/coins/images/7310/small/cro_token_logo.png',
  SUI: 'https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  DAI: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  BASE: 'https://assets.coingecko.com/coins/images/31164/small/base.png',
};

const SUPPORTED_CHAINS: ChainInfo[] = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', color: '#627EEA', explorerUrl: 'https://etherscan.io', explorerName: 'Etherscan', apiChain: 'ethereum', logoUrl: COIN_LOGOS.ETH, coinGeckoId: 'ethereum' },
  { id: 'base', name: 'Base', symbol: 'ETH', color: '#0052FF', explorerUrl: 'https://basescan.org', explorerName: 'BaseScan', apiChain: 'base', logoUrl: 'https://assets.coingecko.com/coins/images/31164/small/base.png', coinGeckoId: 'ethereum' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', color: '#8247E5', explorerUrl: 'https://polygonscan.com', explorerName: 'PolygonScan', apiChain: 'polygon', logoUrl: COIN_LOGOS.MATIC, coinGeckoId: 'matic-network' },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', color: '#E84142', explorerUrl: 'https://snowtrace.io', explorerName: 'SnowTrace', apiChain: 'avalanche', logoUrl: COIN_LOGOS.AVAX, coinGeckoId: 'avalanche-2' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', color: '#9945FF', explorerUrl: 'https://solscan.io', explorerName: 'SolScan', apiChain: 'solana', logoUrl: COIN_LOGOS.SOL, coinGeckoId: 'solana' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', color: '#F7931A', explorerUrl: 'https://blockchair.com/bitcoin', explorerName: 'Blockchair', apiChain: 'bitcoin', logoUrl: COIN_LOGOS.BTC, coinGeckoId: 'bitcoin' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', color: '#28A0F0', explorerUrl: 'https://arbiscan.io', explorerName: 'Arbiscan', apiChain: 'arbitrum', logoUrl: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg', coinGeckoId: 'ethereum' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH', color: '#FF0420', explorerUrl: 'https://optimistic.etherscan.io', explorerName: 'OpScan', apiChain: 'optimism', logoUrl: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png', coinGeckoId: 'ethereum' },
  { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', color: '#F0B90B', explorerUrl: 'https://bscscan.com', explorerName: 'BscScan', apiChain: 'bnb', logoUrl: COIN_LOGOS.BNB, coinGeckoId: 'binancecoin' },
  { id: 'fantom', name: 'Fantom', symbol: 'FTM', color: '#1969FF', explorerUrl: 'https://ftmscan.com', explorerName: 'FtmScan', apiChain: 'fantom', logoUrl: COIN_LOGOS.FTM, coinGeckoId: 'fantom' },
  { id: 'cronos', name: 'Cronos', symbol: 'CRO', color: '#002D74', explorerUrl: 'https://cronoscan.com', explorerName: 'CronoScan', apiChain: 'cronos', logoUrl: COIN_LOGOS.CRO, coinGeckoId: 'crypto-com-chain' },
  { id: 'sui', name: 'Sui', symbol: 'SUI', color: '#4DA2FF', explorerUrl: 'https://suiscan.xyz', explorerName: 'SuiScan', apiChain: 'sui', logoUrl: COIN_LOGOS.SUI, coinGeckoId: 'sui' },
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

function CoinLogo({ symbol, size = 40, className = '' }: { symbol: string; size?: number; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = COIN_LOGOS[symbol.toUpperCase()];

  if (!logoUrl || imgError) {
    const colors: Record<string, string> = {
      ETH: '#627EEA', BTC: '#F7931A', SOL: '#9945FF', MATIC: '#8247E5', AVAX: '#E84142',
      BNB: '#F0B90B', FTM: '#1969FF', CRO: '#002D74', SUI: '#4DA2FF', USDT: '#26A17B',
      USDC: '#2775CA', DAI: '#F5AC37',
    };
    const bg = colors[symbol.toUpperCase()] || '#374151';
    return (
      <div className={`rounded-full flex items-center justify-center font-bold ${className}`}
        style={{ width: size, height: size, minWidth: size, background: bg, fontSize: size * 0.35 }}>
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size, minWidth: size }}
      onError={() => setImgError(true)}
    />
  );
}

function ChainLogo({ chain, size = 24 }: { chain: ChainInfo; size?: number }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="rounded-full flex items-center justify-center font-bold text-white"
        style={{ width: size, height: size, minWidth: size, background: chain.color, fontSize: size * 0.4 }}>
        {chain.symbol.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      src={chain.logoUrl}
      alt={chain.name}
      width={size}
      height={size}
      className="rounded-full"
      style={{ width: size, height: size, minWidth: size }}
      onError={() => setImgError(true)}
    />
  );
}

const SOLANA_CHAIN = SUPPORTED_CHAINS.find(c => c.id === 'solana') || SUPPORTED_CHAINS[0];

export default function WalletPage() {
  const [view, setView] = useState<'main' | 'create' | 'import' | 'send' | 'receive' | 'add-token' | 'wallet-settings'>('main');
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<StoredWallet | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [customTokens, setCustomTokens] = useState<string[]>([]);
  const [activeChain, setActiveChain] = useState<ChainInfo>(SOLANA_CHAIN);
  const [multiChainBalances, setMultiChainBalances] = useState<Record<string, WalletData | null>>({});
  const [multiChainLoading, setMultiChainLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'crypto' | 'nfts' | 'activity'>('crypto');
  const [hideBalance, setHideBalance] = useState(false);
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [tokenSort, setTokenSort] = useState<'value' | 'name' | 'balance'>('value');
  const [prices, setPrices] = useState<Record<string, { usd: number; usd_24h_change: number }>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [defaultWalletAddress, setDefaultWalletAddress] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('steinz_wallets');
    if (stored) {
      const parsed = JSON.parse(stored);
      setWallets(parsed);
      const defAddr = localStorage.getItem('steinz_default_wallet') || '';
      setDefaultWalletAddress(defAddr);
      const def = parsed.find((w: StoredWallet) => w.address === defAddr) || parsed[0];
      if (def) setActiveWallet(def);
    }
    const tokens = localStorage.getItem('steinz_custom_tokens');
    if (tokens) setCustomTokens(JSON.parse(tokens));
    const savedSort = localStorage.getItem('steinz_token_sort') as 'value' | 'name' | 'balance' | null;
    if (savedSort) setTokenSort(savedSort);
    const savedHideSmall = localStorage.getItem('steinz_hide_small');
    if (savedHideSmall) setHideSmallBalances(savedHideSmall === 'true');
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    setPricesLoading(true);
    try {
      const ids = SUPPORTED_CHAINS.map(c => c.coinGeckoId).filter((v, i, a) => a.indexOf(v) === i).join(',');
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
      if (res.ok) {
        const data = await res.json();
        const priceMap: Record<string, { usd: number; usd_24h_change: number }> = {};
        for (const chain of SUPPORTED_CHAINS) {
          if (data[chain.coinGeckoId]) {
            priceMap[chain.id] = {
              usd: data[chain.coinGeckoId].usd || 0,
              usd_24h_change: data[chain.coinGeckoId].usd_24h_change || 0,
            };
          }
        }
        setPrices(priceMap);
      }
    } catch {} finally { setPricesLoading(false); }
  };

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
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchMultiChainBalances = useCallback(async (address: string) => {
    setMultiChainLoading(true);
    const results: Record<string, WalletData | null> = {};
    const promises = LIVE_CHAINS.map(async (chainId) => {
      try {
        const res = await fetch(`/api/wallet-intelligence?address=${address}&chain=${chainId}`);
        if (res.ok) { results[chainId] = await res.json(); }
        else { results[chainId] = null; }
      } catch { results[chainId] = null; }
    });
    await Promise.all(promises);
    setMultiChainBalances(results);
    setMultiChainLoading(false);
  }, []);

  useEffect(() => {
    if (activeWallet) fetchBalances(activeWallet.address, activeChain);
  }, [activeWallet, activeChain, fetchBalances]);

  const MAX_WALLETS = 5;

  const handleWalletCreated = (wallet: StoredWallet) => {
    if (wallets.length >= MAX_WALLETS) return;
    const updated = [...wallets, wallet];
    saveWallets(updated);
    setActiveWallet(wallet);
    setView('main');
    notifyWalletCreated(wallet.name);
  };

  const handleWalletImported = (wallet: StoredWallet) => {
    if (wallets.length >= MAX_WALLETS) return;
    const updated = [...wallets, wallet];
    saveWallets(updated);
    setActiveWallet(wallet);
    setView('main');
    notifyWalletImported(wallet.name);
  };

  const removeWallet = (addr: string) => {
    const updated = wallets.filter(w => w.address !== addr);
    saveWallets(updated);
    if (activeWallet?.address === addr) {
      setActiveWallet(updated[0] || null);
      setWalletData(null);
      setMultiChainBalances({});
    }
    if (defaultWalletAddress === addr) {
      const newDef = updated[0]?.address || '';
      setDefaultWalletAddress(newDef);
      localStorage.setItem('steinz_default_wallet', newDef);
    }
    setShowDeleteConfirm(false);
    setWalletToDelete('');
  };

  const setAsDefault = (addr: string) => {
    setDefaultWalletAddress(addr);
    localStorage.setItem('steinz_default_wallet', addr);
    const wallet = wallets.find(w => w.address === addr);
    if (wallet) setActiveWallet(wallet);
  };

  const renameWallet = (addr: string, newName: string) => {
    const updated = wallets.map(w => w.address === addr ? { ...w, name: newName } : w);
    saveWallets(updated);
    if (activeWallet?.address === addr) setActiveWallet(prev => prev ? { ...prev, name: newName } : null);
  };

  const totalMultiChainUsd = Object.values(multiChainBalances).reduce((sum, data) => {
    if (data) return sum + parseFloat(data.totalBalanceUsd || '0');
    return sum;
  }, 0);

  const currentBalance = walletData ? parseFloat(walletData.totalBalanceUsd || '0') : 0;
  const currentPrice = prices[activeChain.id];
  const priceChange = currentPrice?.usd_24h_change || 0;

  if (view === 'create') return <CreateWalletView onBack={() => setView('main')} onCreated={handleWalletCreated} />;
  if (view === 'import') return <ImportWalletView onBack={() => setView('main')} onImported={handleWalletImported} />;
  if (view === 'send' && activeWallet) return <SendView onBack={() => setView('main')} wallet={activeWallet} chain={activeChain} />;
  if (view === 'receive' && activeWallet) return <ReceiveView onBack={() => setView('main')} address={activeWallet.address} chain={activeChain} />;
  if (view === 'add-token') return <AddTokenView onBack={() => setView('main')} tokens={customTokens} onAdd={(t) => { const updated = [...customTokens, t]; setCustomTokens(updated); localStorage.setItem('steinz_custom_tokens', JSON.stringify(updated)); setView('main'); }} />;
  if (view === 'wallet-settings' && activeWallet) return (
    <WalletSettingsView
      onBack={() => setView('main')}
      wallet={activeWallet}
      isDefault={defaultWalletAddress === activeWallet.address}
      onSetDefault={() => setAsDefault(activeWallet.address)}
      onRename={(name: string) => renameWallet(activeWallet.address, name)}
      onDelete={() => { setWalletToDelete(activeWallet.address); setShowDeleteConfirm(true); setView('main'); }}
    />
  );

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="max-w-lg mx-auto">
        {wallets.length === 0 ? (
          <div className="px-4 pt-8">
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-3xl flex items-center justify-center shadow-2xl shadow-[#0A1EFF]/20 border border-[#0A1EFF]/20">
                <SteinzLogo size={56} />
              </div>
              <h1 className="text-2xl font-heading font-bold mb-2">STEINZ Wallet</h1>
              <p className="text-gray-400 text-sm mb-8">Your gateway to multi-chain crypto</p>

              <div className="bg-[#111827] rounded-2xl border border-white/5 p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4 text-[#0A1EFF]" />
                  <span className="text-sm font-bold">12 Chains Supported</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {SUPPORTED_CHAINS.map(chain => (
                    <div key={chain.id} className="flex flex-col items-center gap-1.5 p-2">
                      <ChainLogo chain={chain} size={32} />
                      <span className="text-[10px] text-gray-400 text-center leading-tight">{chain.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <button onClick={() => setView('create')} className="w-full py-4 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#0A1EFF]/20">
                  <Plus className="w-5 h-5" /> Create New Wallet
                </button>
                <button onClick={() => setView('import')} className="w-full py-4 bg-[#111827] border border-white/10 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-white/5">
                  <Download className="w-5 h-5" /> Import Wallet
                </button>
              </div>

              <div className="mt-6 p-4 bg-[#10B981]/5 rounded-2xl border border-[#10B981]/10">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-[#10B981]" />
                  <span className="text-xs font-semibold text-[#10B981]">Non-Custodial & Secure</span>
                </div>
                <p className="text-[11px] text-gray-500">Your keys stay on your device. STEINZ never has access to your private keys or funds.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link href="/dashboard" className="p-1.5 hover:bg-white/10 rounded-lg">
                  <ArrowLeft className="w-4 h-4 text-gray-400" />
                </Link>
                <button onClick={() => setView('wallet-settings')} className="p-1.5 hover:bg-white/10 rounded-lg">
                  <Settings className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {wallets.length > 1 ? (
                  <select
                    className="bg-transparent text-sm font-bold appearance-none cursor-pointer pr-1"
                    value={activeWallet?.address}
                    onChange={(e) => {
                      const w = wallets.find(w => w.address === e.target.value);
                      if (w) setActiveWallet(w);
                    }}
                  >
                    {wallets.map(w => (
                      <option key={w.address} value={w.address} className="bg-[#111827] text-white">
                        {w.name}{w.address === defaultWalletAddress ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-bold flex items-center gap-1">
                    {activeWallet?.name || 'Wallet'}
                    {activeWallet?.address === defaultWalletAddress && <span className="text-[10px] text-[#0A1EFF]">★</span>}
                  </span>
                )}
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{wallets.length}/{MAX_WALLETS}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setHideBalance(!hideBalance)} className="p-1.5 hover:bg-white/10 rounded-lg">
                  {hideBalance ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
                <button onClick={() => { if (activeWallet) fetchBalances(activeWallet.address, activeChain); fetchPrices(); }} disabled={loading} className="p-1.5 hover:bg-white/10 rounded-lg">
                  <RotateCcw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="px-4 pt-2 pb-4">
              <div className="text-center mb-5">
                <p className="text-4xl font-bold font-mono mb-1">
                  {hideBalance ? '••••••' : (
                    !LIVE_CHAINS.includes(activeChain.id) ? '--' :
                    loading ? '...' :
                    `$${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </p>
                {LIVE_CHAINS.includes(activeChain.id) && !hideBalance && (
                  <div className="flex items-center justify-center gap-1.5">
                    {priceChange !== 0 && (
                      <>
                        {priceChange > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />
                        )}
                        <span className={`text-sm font-medium ${priceChange > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
                        </span>
                      </>
                    )}
                    <span className="text-xs text-gray-500">24h</span>
                  </div>
                )}
                <button
                  onClick={() => { navigator.clipboard.writeText(activeWallet?.address || ''); }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full hover:bg-white/10 transition-all"
                >
                  <span className="text-[11px] font-mono text-gray-400">
                    {activeWallet?.address.slice(0, 6)}...{activeWallet?.address.slice(-4)}
                  </span>
                  <Copy className="w-3 h-3 text-gray-500" />
                </button>
              </div>

              <div className="flex justify-center gap-4 mb-6">
                {EVM_LIVE_CHAINS.includes(activeChain.id) ? (
                  <>
                    <ActionButton icon={<ArrowUpRight className="w-5 h-5" />} label="Send" color="#0A1EFF" onClick={() => setView('send')} />
                    <ActionButton icon={<ArrowDownLeft className="w-5 h-5" />} label="Receive" color="#10B981" onClick={() => setView('receive')} />
                    <ActionButton icon={<Plus className="w-5 h-5" />} label="Buy" color="#F59E0B" onClick={() => {}} disabled />
                    <ActionButton icon={<Repeat className="w-5 h-5" />} label="Swap" color="#8B5CF6" onClick={() => {}} disabled />
                  </>
                ) : activeChain.id === 'solana' ? (
                  <>
                    <ActionButton icon={<ArrowUpRight className="w-5 h-5" />} label="Send" color="#9945FF" onClick={() => {}} disabled soon />
                    <ActionButton icon={<ArrowDownLeft className="w-5 h-5" />} label="Receive" color="#10B981" onClick={() => setView('receive')} />
                    <ActionButton icon={<Plus className="w-5 h-5" />} label="Buy" color="#F59E0B" onClick={() => {}} disabled />
                    <ActionButton icon={<Repeat className="w-5 h-5" />} label="Swap" color="#8B5CF6" onClick={() => {}} disabled />
                  </>
                ) : (
                  <>
                    <ActionButton icon={<ArrowUpRight className="w-5 h-5" />} label="Send" color="#627EEA" onClick={() => {}} disabled soon />
                    <ActionButton icon={<ArrowDownLeft className="w-5 h-5" />} label="Receive" color="#10B981" onClick={() => {}} disabled soon />
                    <ActionButton icon={<Plus className="w-5 h-5" />} label="Buy" color="#F59E0B" onClick={() => {}} disabled />
                    <ActionButton icon={<Repeat className="w-5 h-5" />} label="Swap" color="#8B5CF6" onClick={() => {}} disabled />
                  </>
                )}
              </div>

              <div className="flex overflow-x-auto gap-2 mb-4 pb-1 scrollbar-hide">
                {SUPPORTED_CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => setActiveChain(chain)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeChain.id === chain.id
                        ? 'text-white border-2 bg-white/5'
                        : 'bg-[#111827] text-gray-400 border border-white/5 hover:border-white/15'
                    }`}
                    style={activeChain.id === chain.id ? { borderColor: chain.color } : {}}
                  >
                    <ChainLogo chain={chain} size={18} />
                    {chain.name}
                    {!LIVE_CHAINS.includes(chain.id) && <span className="text-[8px] text-gray-500 ml-0.5">soon</span>}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 mb-4 bg-[#111827] rounded-xl p-1">
                {(['crypto', 'nfts', 'activity'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                      activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}>
                    {tab === 'crypto' ? 'Crypto' : tab === 'nfts' ? 'NFTs' : 'Activity'}
                  </button>
                ))}
              </div>

              {activeTab === 'crypto' && (
                <div className="space-y-1">
                  {LIVE_CHAINS.includes(activeChain.id) ? (
                    <>
                      {/* Toolbar: hide small balances + sort */}
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => { const v = !hideSmallBalances; setHideSmallBalances(v); localStorage.setItem('steinz_hide_small', String(v)); }}
                          className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
                        >
                          <div className={`w-7 h-3.5 rounded-full transition-colors relative ${hideSmallBalances ? 'bg-[#0A1EFF]' : 'bg-gray-600'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${hideSmallBalances ? 'right-0.5' : 'left-0.5'}`} />
                          </div>
                          Hide &lt;$1
                        </button>
                        <select
                          value={tokenSort}
                          onChange={(e) => { const v = e.target.value as 'value' | 'name' | 'balance'; setTokenSort(v); localStorage.setItem('steinz_token_sort', v); }}
                          className="bg-[#111827] border border-white/10 rounded-lg px-2 py-0.5 text-[10px] text-gray-400 focus:outline-none focus:border-[#0A1EFF]/30"
                        >
                          <option value="value">Sort: Value</option>
                          <option value="balance">Sort: Balance</option>
                          <option value="name">Sort: Name</option>
                        </select>
                      </div>

                      {loading ? (
                        <div className="py-8 text-center">
                          <RotateCcw className="w-6 h-6 text-gray-500 animate-spin mx-auto mb-2" />
                          <p className="text-xs text-gray-500">Loading balances...</p>
                        </div>
                      ) : walletData?.holdings && walletData.holdings.length > 0 ? (
                        (() => {
                          let tokens = [...walletData.holdings];
                          if (hideSmallBalances) tokens = tokens.filter(t => parseFloat(t.valueUsd || '0') >= 1);
                          if (tokenSort === 'value') tokens.sort((a, b) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));
                          else if (tokenSort === 'balance') tokens.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
                          else tokens.sort((a, b) => a.name.localeCompare(b.name));
                          return tokens.map((token, i) => (
                            <TokenRow key={i} token={token} chainSymbol={activeChain.symbol} chainColor={activeChain.color} hideBalance={hideBalance} />
                          ));
                        })()
                      ) : (
                        <div className="py-8 text-center">
                          <div className="w-14 h-14 mx-auto mb-3 bg-white/5 rounded-2xl flex items-center justify-center">
                            <ChainLogo chain={activeChain} size={28} />
                          </div>
                          <p className="text-sm text-gray-400 mb-1">No tokens found</p>
                          <p className="text-xs text-gray-600">Fund your wallet to get started</p>
                        </div>
                      )}

                      <button onClick={() => setView('add-token')} className="w-full mt-3 py-3 border border-dashed border-white/10 rounded-xl text-xs text-gray-500 hover:text-white hover:border-white/20 flex items-center justify-center gap-2 transition-all">
                        <Plus className="w-3.5 h-3.5" /> Add Custom Token
                      </button>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="w-14 h-14 mx-auto mb-3 bg-white/5 rounded-2xl flex items-center justify-center">
                        <ChainLogo chain={activeChain} size={28} />
                      </div>
                      <p className="text-sm text-gray-400">{activeChain.name} support coming soon</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'nfts' && (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 bg-white/5 rounded-2xl flex items-center justify-center">
                    <Layers className="w-6 h-6 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-400">NFT support coming soon</p>
                </div>
              )}

              {activeTab === 'activity' && (
                <ActivityTab address={activeWallet?.address || ''} chain={activeChain} />
              )}

              {activeWallet && LIVE_CHAINS.includes(activeChain.id) && (
                <div className="mt-4 bg-[#111827] rounded-2xl border border-white/5 overflow-hidden">
                  <button
                    onClick={() => activeWallet && fetchMultiChainBalances(activeWallet.address)}
                    disabled={multiChainLoading}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#0A1EFF]" />
                      <span className="text-sm font-semibold">Multi-Chain Portfolio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {Object.keys(multiChainBalances).length > 0 && !hideBalance && (
                        <span className="text-xs font-mono text-[#0A1EFF]">${totalMultiChainUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      )}
                      {multiChainLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {Object.keys(multiChainBalances).length > 0 && (
                    <div className="border-t border-white/5">
                      {LIVE_CHAINS.map(chainId => {
                        const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
                        const data = multiChainBalances[chainId];
                        if (!chain) return null;
                        const balance = data ? parseFloat(data.totalBalanceUsd || '0') : 0;
                        return (
                          <button key={chainId} onClick={() => setActiveChain(chain)}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors ${activeChain.id === chainId ? 'bg-white/5' : ''}`}>
                            <div className="flex items-center gap-3">
                              <ChainLogo chain={chain} size={28} />
                              <div className="text-left">
                                <p className="text-xs font-semibold">{chain.name}</p>
                                <p className="text-[10px] text-gray-500">{chain.symbol}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-mono">{hideBalance ? '••••' : `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</p>
                              {data?.holdings?.[0] && !hideBalance && (
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

              {currentPrice && !hideBalance && (
                <div className="mt-4 bg-[#111827] rounded-2xl border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Market Price</span>
                    <span className={`text-xs font-medium ${priceChange > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChainLogo chain={activeChain} size={20} />
                    <span className="text-lg font-bold font-mono">${currentPrice.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-xs text-gray-500">{activeChain.symbol}</span>
                  </div>
                </div>
              )}

              {wallets.length >= MAX_WALLETS && (
                <div className="mt-3 p-3 bg-[#F59E0B]/5 border border-[#F59E0B]/10 rounded-xl">
                  <p className="text-xs text-[#F59E0B]">Maximum {MAX_WALLETS} wallets reached. Remove a wallet to add a new one.</p>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button onClick={() => setView('create')} disabled={wallets.length >= MAX_WALLETS} className="flex-1 py-3 bg-[#111827] border border-white/5 rounded-xl text-xs font-semibold hover:bg-white/5 flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  <Plus className="w-3.5 h-3.5" /> New Wallet
                </button>
                <button onClick={() => setView('import')} disabled={wallets.length >= MAX_WALLETS} className="flex-1 py-3 bg-[#111827] border border-white/5 rounded-xl text-xs font-semibold hover:bg-white/5 flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  <Download className="w-3.5 h-3.5" /> Import
                </button>
                <button
                  onClick={() => { if (activeWallet) { setWalletToDelete(activeWallet.address); setShowDeleteConfirm(true); } }}
                  className="py-3 px-4 bg-[#111827] border border-[#EF4444]/10 text-[#EF4444] rounded-xl text-xs font-semibold hover:bg-[#EF4444]/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Delete confirmation modal */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowDeleteConfirm(false)} />
                  <div className="relative w-full max-w-[320px] mx-4 bg-[#111827] border border-white/10 rounded-2xl p-5 shadow-2xl">
                    <h3 className="text-sm font-bold mb-2 text-white">Delete Wallet?</h3>
                    <p className="text-xs text-gray-400 mb-4">
                      This will remove the wallet from this device. Make sure you have your recovery phrase saved before deleting.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-white/5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => removeWallet(walletToDelete)} className="flex-1 py-2.5 bg-[#EF4444]/20 text-[#EF4444] rounded-xl text-xs font-semibold hover:bg-[#EF4444]/30 transition-colors border border-[#EF4444]/20">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeWallet && LIVE_CHAINS.includes(activeChain.id) && (
                <a href={`${activeChain.explorerUrl}/address/${activeWallet.address}`} target="_blank" rel="noopener noreferrer"
                  className="mt-3 w-full py-2.5 bg-[#111827] border border-white/5 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 block">
                  View on {activeChain.explorerName} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, color, onClick, disabled = false, soon = false }: { icon: React.ReactNode; label: string; color: string; onClick: () => void; disabled?: boolean; soon?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-1.5 ${disabled ? 'opacity-40' : 'hover:scale-105 active:scale-95'} transition-transform`}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}25` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <span className="text-[11px] font-medium text-gray-300">{label}</span>
      {soon && <span className="text-[8px] text-gray-500 -mt-1">Soon</span>}
    </button>
  );
}

function TokenRow({ token, chainSymbol, chainColor, hideBalance }: { token: TokenBalance; chainSymbol: string; chainColor: string; hideBalance: boolean }) {
  const value = token.valueUsd ? parseFloat(token.valueUsd) : 0;
  const bal = parseFloat(token.balance) || 0;

  return (
    <div className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/3 transition-colors">
      <CoinLogo symbol={token.symbol} size={40} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{token.name || token.symbol}</p>
        <p className="text-[11px] text-gray-500">{token.symbol}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-medium">{hideBalance ? '••••' : bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
        {value > 0 && <p className="text-[11px] text-gray-500 font-mono">{hideBalance ? '••••' : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>}
      </div>
    </div>
  );
}

function CreateWalletView({ onBack, onCreated, walletCount = 0 }: { onBack: () => void; onCreated: (w: StoredWallet) => void; walletCount?: number }) {
  const [step, setStep] = useState<'password' | 'phrase' | 'confirm'>('password');
  const [password, setPassword] = useState('');
  const [walletName, setWalletName] = useState(`Wallet ${walletCount + 1}`);
  const [mnemonic, setMnemonic] = useState('');
  const [address, setAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [phraseCopied, setPhraseCopied] = useState(false);

  const createWallet = async () => {
    if (!password || password.length < 8) return;
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
    } finally { setCreating(false); }
  };

  const confirmAndSave = () => {
    const encrypted = simpleEncrypt(privateKey, password);
    onCreated({ address, encryptedKey: encrypted, name: walletName, createdAt: new Date().toISOString() });
  };

  const handleCopyPhrase = () => {
    navigator.clipboard.writeText(mnemonic);
    setPhraseCopied(true);
    setTimeout(() => setPhraseCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-sm hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-3xl flex items-center justify-center border border-[#0A1EFF]/20">
            <SteinzLogo size={48} />
          </div>
          <h1 className="text-2xl font-heading font-bold mb-1">Create New Wallet</h1>
          <p className="text-gray-400 text-sm">Your keys, your crypto</p>
        </div>

        {step === 'password' && (
          <div className="space-y-5">
            <div>
              <label className="text-sm text-gray-300 mb-2 block font-medium">Wallet Name</label>
              <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-[#0A1EFF]/50 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-2 block font-medium">Set Password (min 8 chars)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-[#0A1EFF]/50 transition-colors" placeholder="Secure password to encrypt your keys" />
              {password.length > 0 && password.length < 8 && (
                <p className="text-[10px] text-[#EF4444] mt-1">Password must be at least 8 characters</p>
              )}
            </div>
            <div className="p-4 bg-[#F59E0B]/5 border border-[#F59E0B]/10 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-xs font-semibold text-[#F59E0B]">Important</span>
              </div>
              <p className="text-xs text-gray-400">This password encrypts your private key locally. If you lose it, you can only recover your wallet with the recovery phrase.</p>
            </div>
            <button onClick={createWallet} disabled={password.length < 8 || creating} className="w-full py-4 bg-[#0A1EFF] hover:bg-[#0818CC] rounded-xl font-bold text-base disabled:opacity-50 transition-colors shadow-lg shadow-[#0A1EFF]/20">
              {creating ? 'Generating...' : 'Generate Wallet'}
            </button>
          </div>
        )}

        {step === 'phrase' && (
          <div className="space-y-4">
            <div className="p-4 bg-[#EF4444]/5 border border-[#EF4444]/10 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span className="text-sm font-bold text-[#EF4444]">Write Down Your Recovery Phrase</span>
              </div>
              <p className="text-xs text-gray-400">This is the ONLY way to recover your wallet. Write it down and store it safely. Never share it with anyone.</p>
            </div>

            <div className="relative">
              <div className={`grid grid-cols-3 gap-2 p-4 bg-[#111827] rounded-xl border border-white/10 ${!showPhrase ? 'blur-md select-none' : ''}`}>
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="flex items-center gap-1.5 py-2 px-2.5 bg-white/5 rounded-lg">
                    <span className="text-[10px] text-gray-500 w-4 font-mono">{i + 1}.</span>
                    <span className="text-sm font-mono">{word}</span>
                  </div>
                ))}
              </div>
              {!showPhrase && (
                <button onClick={() => setShowPhrase(true)} className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2 px-5 py-3 bg-[#111827] rounded-xl border border-white/10 shadow-xl">
                    <Eye className="w-5 h-5" /> <span className="text-sm font-semibold">Tap to Reveal</span>
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={handleCopyPhrase}
              className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                phraseCopied
                  ? 'bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981]'
                  : 'border border-white/10 hover:bg-white/5 text-white'
              }`}
            >
              {phraseCopied ? <><Check className="w-4 h-4" /> Copied to Clipboard!</> : <><Copy className="w-4 h-4" /> Copy Recovery Phrase</>}
            </button>

            <div className="p-4 bg-[#111827] rounded-xl border border-white/5">
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Your Wallet Address</p>
              <p className="text-sm font-mono text-[#0A1EFF] break-all">{address}</p>
            </div>

            <button type="button" onClick={() => setConfirmed(!confirmed)} className="flex items-center gap-3 cursor-pointer p-3 bg-[#111827] rounded-xl border border-white/5 w-full text-left">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${confirmed ? 'bg-[#0A1EFF] border-[#0A1EFF]' : 'border-white/20 bg-transparent'}`}>
                {confirmed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm text-gray-300">I have saved my recovery phrase securely</span>
            </button>

            <button onClick={confirmAndSave} disabled={!confirmed} className="w-full py-4 bg-[#0A1EFF] hover:bg-[#0818CC] rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#0A1EFF]/20">
              <Check className="w-5 h-5" /> Continue to Wallet
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
    if (!input.trim() || !password || password.length < 8) return;
    setImporting(true); setError('');
    try {
      const ethers = await import('ethers');
      let wallet: any;
      if (method === 'phrase') { wallet = ethers.Wallet.fromPhrase(input.trim()); }
      else { wallet = new ethers.Wallet(input.trim()); }
      const encrypted = simpleEncrypt(wallet.privateKey, password);
      onImported({ address: wallet.address, encryptedKey: encrypted, name: walletName, createdAt: new Date().toISOString() });
    } catch (e: any) { setError(e.message || 'Invalid input. Check your recovery phrase or private key.'); }
    finally { setImporting(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Import Wallet</h1>
            <p className="text-gray-400 text-xs">Recovery phrase or private key</p>
          </div>
        </div>

        <div className="flex gap-2 mb-5 bg-[#111827] rounded-xl p-1">
          <button onClick={() => setMethod('phrase')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${method === 'phrase' ? 'bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-white' : 'text-gray-400'}`}>
            Recovery Phrase
          </button>
          <button onClick={() => setMethod('key')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${method === 'key' ? 'bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-white' : 'text-gray-400'}`}>
            Private Key
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Wallet Name</label>
            <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0A1EFF]/50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">{method === 'phrase' ? 'Recovery Phrase (12 or 24 words)' : 'Private Key'}</label>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              rows={method === 'phrase' ? 4 : 2}
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#0A1EFF]/50 resize-none"
              placeholder={method === 'phrase' ? 'word1 word2 word3 ...' : '0x...'} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Set Password (min 8 chars)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0A1EFF]/50" placeholder="Encrypt your keys" />
          </div>
          {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/5 p-3 rounded-xl border border-[#EF4444]/10">{error}</p>}
          <button onClick={handleImport} disabled={importing || !input.trim() || password.length < 8} className="w-full py-3.5 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
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
    setStatus('sending'); setError('');
    try {
      const ethers = await import('ethers');
      const decryptedKey = simpleDecrypt(wallet.encryptedKey, password);
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ALCHEMY_RPC || 'https://eth.llamarpc.com');
      const signer = new ethers.Wallet(decryptedKey, provider);
      const tx = await signer.sendTransaction({ to, value: ethers.parseEther(amount) });
      setTxHash(tx.hash); setStatus('success');
    } catch (e: any) { setError(e.message || 'Transaction failed'); setStatus('error'); }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${chain.color}15`, border: `1px solid ${chain.color}25` }}>
            <ArrowUpRight className="w-5 h-5" style={{ color: chain.color }} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Send {chain.symbol}</h1>
            <p className="text-gray-400 text-xs">on {chain.name}</p>
          </div>
        </div>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-[#10B981]/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-[#10B981]/20">
              <Check className="w-10 h-10 text-[#10B981]" />
            </div>
            <h2 className="text-xl font-bold mb-2">Transaction Sent!</h2>
            <p className="text-gray-400 text-sm mb-4">{amount} {chain.symbol} sent successfully</p>
            <a href={`${chain.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#0A1EFF] text-xs underline flex items-center justify-center gap-1">
              View on {chain.explorerName} <ExternalLink className="w-3 h-3" />
            </a>
            <button onClick={onBack} className="w-full mt-6 py-3 bg-[#111827] border border-white/10 rounded-xl text-sm font-semibold">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Recipient Address</label>
              <input value={to} onChange={e => setTo(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#0A1EFF]/50" placeholder="0x..." />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Amount ({chain.symbol})</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.001" className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#0A1EFF]/50" placeholder="0.01" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Wallet Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0A1EFF]/50" placeholder="Enter your wallet password" />
            </div>
            {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/5 p-3 rounded-xl border border-[#EF4444]/10">{error}</p>}
            <button onClick={handleSend} disabled={status === 'sending' || !to || !amount || !password} className="w-full py-3.5 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
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

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${chain.color}15`, border: `1px solid ${chain.color}25` }}>
            <ArrowDownLeft className="w-5 h-5" style={{ color: chain.color }} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Receive on {chain.name}</h1>
            <p className="text-gray-400 text-xs">Share your address to receive {chain.symbol}</p>
          </div>
        </div>

        <div className="text-center">
          <div className="w-48 h-48 bg-white rounded-2xl mx-auto mb-5 flex items-center justify-center p-6 shadow-lg">
            <div className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-2" style={{ backgroundColor: `${chain.color}08` }}>
              <ChainLogo chain={chain} size={48} />
              <QrCode className="w-10 h-10 text-gray-400" />
            </div>
          </div>

          <p className="text-gray-400 text-xs mb-3">Send {chain.symbol} or tokens to this address:</p>

          <div className="bg-[#111827] border border-white/10 rounded-xl p-4 mb-4">
            <p className="text-xs font-mono break-all text-[#0A1EFF]">{address}</p>
          </div>

          <button
            onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="w-full py-3.5 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl font-bold text-sm flex items-center justify-center gap-2">
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Address</>}
          </button>

          <div className="mt-4 p-3 bg-[#F59E0B]/5 rounded-xl border border-[#F59E0B]/10">
            <p className="text-[11px] text-gray-400">
              <AlertTriangle className="w-3 h-3 text-[#F59E0B] inline mr-1" />
              Only send {chain.name} network tokens to this address. Sending from other networks may result in loss.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTokenView({ onBack, tokens, onAdd }: { onBack: () => void; tokens: string[]; onAdd: (addr: string) => void }) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) { setError('Invalid ERC-20 contract address'); return; }
    if (tokens.includes(address.toLowerCase())) { setError('Token already added'); return; }
    onAdd(address.toLowerCase());
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Add Custom Token</h1>
            <p className="text-gray-400 text-xs">Import any ERC-20 token by contract</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Token Contract Address</label>
            <input value={address} onChange={e => { setAddress(e.target.value); setError(''); }} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#0A1EFF]/50" placeholder="0x..." />
          </div>
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          <button onClick={handleAdd} disabled={!address} className="w-full py-3.5 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
            Add Token
          </button>

          {tokens.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-2">Custom Tokens ({tokens.length})</h3>
              <div className="space-y-1.5">
                {tokens.map(t => (
                  <div key={t} className="flex items-center justify-between bg-[#111827] rounded-xl px-4 py-3 text-xs font-mono text-gray-400 border border-white/5">
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

function WalletSettingsView({
  onBack,
  wallet,
  isDefault,
  onSetDefault,
  onRename,
  onDelete,
}: {
  onBack: () => void;
  wallet: StoredWallet;
  isDefault: boolean;
  onSetDefault: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editName, setEditName] = useState(wallet.name);
  const [renamed, setRenamed] = useState(false);
  const [changePwd, setChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`steinz_wallet_privacy_${wallet.address}`) === 'true';
  });

  const handleRename = () => {
    if (editName.trim() && editName.trim() !== wallet.name) {
      onRename(editName.trim());
      setRenamed(true);
      setTimeout(() => setRenamed(false), 1500);
    }
  };

  const handleChangePassword = () => {
    if (newPwd.length < 8) { setPwdError('New password must be at least 8 characters'); return; }
    try {
      const dec = (encoded: string, pw: string) => {
        const text = atob(encoded);
        let r = '';
        for (let i = 0; i < text.length; i++) r += String.fromCharCode(text.charCodeAt(i) ^ pw.charCodeAt(i % pw.length));
        return r;
      };
      const enc = (text: string, pw: string) => {
        let r = '';
        for (let i = 0; i < text.length; i++) r += String.fromCharCode(text.charCodeAt(i) ^ pw.charCodeAt(i % pw.length));
        return btoa(r);
      };
      const pk = dec(wallet.encryptedKey, oldPwd);
      if (pk.length < 10) { setPwdError('Incorrect current password'); return; }
      const newEncrypted = enc(pk, newPwd);
      const wallets: StoredWallet[] = JSON.parse(localStorage.getItem('steinz_wallets') || '[]');
      const updated = wallets.map(w => w.address === wallet.address ? { ...w, encryptedKey: newEncrypted } : w);
      localStorage.setItem('steinz_wallets', JSON.stringify(updated));
      setPwdSuccess(true); setPwdError('');
      setOldPwd(''); setNewPwd('');
      setTimeout(() => setPwdSuccess(false), 3000);
    } catch { setPwdError('Failed to change password. Check your current password.'); }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#0A1EFF]" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Wallet Settings</h1>
            <p className="text-gray-400 text-xs font-mono">{wallet.address.slice(0, 10)}...{wallet.address.slice(-6)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Rename */}
          <div className="bg-[#111827] rounded-xl border border-white/10 p-4">
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Wallet Name</label>
            <div className="flex gap-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 bg-[#0A0E1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/50"
                placeholder="My Wallet"
              />
              <button
                onClick={handleRename}
                disabled={!editName.trim() || editName.trim() === wallet.name}
                className="px-4 py-2.5 rounded-xl bg-[#0A1EFF] text-xs font-semibold disabled:opacity-40 transition-opacity"
              >
                {renamed ? <Check className="w-4 h-4" /> : 'Save'}
              </button>
            </div>
          </div>

          {/* Set as Default */}
          {!isDefault && (
            <button
              onClick={() => { onSetDefault(); onBack(); }}
              className="w-full flex items-center gap-3 bg-[#111827] rounded-xl border border-white/10 p-4 hover:bg-white/5 transition-colors text-left"
            >
              <Shield className="w-5 h-5 text-[#10B981]" />
              <div>
                <p className="text-sm font-semibold">Set as Default</p>
                <p className="text-xs text-gray-500">Use this wallet by default for all actions</p>
              </div>
            </button>
          )}

          {isDefault && (
            <div className="flex items-center gap-3 bg-[#10B981]/10 rounded-xl border border-[#10B981]/20 p-4">
              <Shield className="w-5 h-5 text-[#10B981]" />
              <p className="text-sm font-semibold text-[#10B981]">This is your Default Wallet</p>
            </div>
          )}

          {/* Privacy Toggle */}
          <div className="bg-[#111827] rounded-xl border border-white/10 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Privacy Mode</p>
              <p className="text-xs text-gray-500">Hide this wallet from your public profile</p>
            </div>
            <button
              onClick={() => {
                const v = !privacyMode;
                setPrivacyMode(v);
                localStorage.setItem(`steinz_wallet_privacy_${wallet.address}`, String(v));
              }}
              className={`w-10 h-5 rounded-full transition-colors relative ${privacyMode ? 'bg-[#0A1EFF]' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${privacyMode ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Change Password */}
          <div className="bg-[#111827] rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold">Change Password</p>
                <p className="text-xs text-gray-500">Update your wallet encryption password</p>
              </div>
              <button onClick={() => setChangePwd(!changePwd)} className="px-3 py-1 bg-white/5 rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors">
                {changePwd ? 'Cancel' : 'Change'}
              </button>
            </div>
            {changePwd && (
              <div className="space-y-3 mt-3">
                <input type="password" value={oldPwd} onChange={e => { setOldPwd(e.target.value); setPwdError(''); }} placeholder="Current password" className="w-full bg-[#0A0E1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40 text-white" />
                <input type="password" value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdError(''); }} placeholder="New password (min 8 chars)" className="w-full bg-[#0A0E1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40 text-white" />
                {pwdError && <p className="text-[11px] text-[#EF4444]">{pwdError}</p>}
                {pwdSuccess && <p className="text-[11px] text-[#10B981]">Password changed successfully!</p>}
                <button onClick={handleChangePassword} disabled={!oldPwd || !newPwd} className="w-full py-2.5 bg-[#0A1EFF] rounded-xl text-sm font-bold disabled:opacity-50">
                  Update Password
                </button>
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => { onDelete(); onBack(); }}
            className="w-full flex items-center gap-3 bg-[#EF4444]/10 rounded-xl border border-[#EF4444]/20 p-4 hover:bg-[#EF4444]/15 transition-colors text-left"
          >
            <Trash2 className="w-5 h-5 text-[#EF4444]" />
            <div>
              <p className="text-sm font-semibold text-[#EF4444]">Remove Wallet</p>
              <p className="text-xs text-gray-500">Remove this wallet from the app (keys stay on your device)</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ address, chain }: { address: string; chain: ChainInfo }) {
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <ArrowUpRight className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-400">No wallet selected</p>
      </div>
    );
  }

  const swapHistory: any[] = typeof window !== 'undefined'
    ? (JSON.parse(localStorage.getItem('steinz_swap_history') || '[]') as any[]).filter(t => t.address?.toLowerCase() === address.toLowerCase())
    : [];
  const sendHistory: any[] = typeof window !== 'undefined'
    ? (JSON.parse(localStorage.getItem('steinz_send_history') || '[]') as any[]).filter(t => t.address?.toLowerCase() === address.toLowerCase())
    : [];
  const all = [...swapHistory, ...sendHistory].sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);

  if (all.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="w-14 h-14 mx-auto mb-3 bg-white/5 rounded-2xl flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-400">No transactions yet</p>
        <p className="text-xs text-gray-600 mt-1">Your swap & send history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {all.map((tx, i) => {
        const isSwap = tx.type === 'swap';
        const date = new Date(tx.timestamp);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return (
          <div key={i} className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/5 transition-colors">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSwap ? 'bg-[#0A1EFF]/10' : 'bg-[#F59E0B]/10'}`}>
              {isSwap ? <Repeat className="w-4 h-4 text-[#0A1EFF]" /> : <ArrowUpRight className="w-4 h-4 text-[#F59E0B]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">
                {isSwap ? `Swap ${tx.from} → ${tx.to}` : `Send ${tx.symbol || chain.symbol}`}
              </p>
              <p className="text-[10px] text-gray-500">{dateStr} · {timeStr}</p>
            </div>
            <div className="text-right shrink-0">
              {isSwap ? (
                <>
                  <p className="text-xs font-mono">-{parseFloat(tx.fromAmount || 0).toFixed(4)} {tx.from}</p>
                  <p className="text-[10px] text-[#10B981] font-mono">+{parseFloat(tx.toAmount || 0).toFixed(4)} {tx.to}</p>
                </>
              ) : (
                <p className="text-xs font-mono text-[#EF4444]">-{parseFloat(tx.amount || 0).toFixed(4)} {tx.symbol || chain.symbol}</p>
              )}
              {tx.txHash && (
                <a
                  href={chain.id === 'solana' ? `https://solscan.io/tx/${tx.txHash}` : `${chain.explorerUrl}/tx/${tx.txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[9px] text-[#0A1EFF] hover:underline"
                >
                  View ↗
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
