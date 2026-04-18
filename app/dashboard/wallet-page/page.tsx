'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Download, Send, Copy, Eye, EyeOff, RotateCcw, Trash2, ChevronRight, Wallet, Key, Shield, Check, AlertTriangle, ExternalLink, Globe, Layers, ArrowUpRight, ArrowDownLeft, Repeat, DollarSign, TrendingUp, TrendingDown, Settings, Search, QrCode, X, RefreshCw, ChevronDown, ShoppingCart, Zap } from 'lucide-react';
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
  { id: 'base', name: 'Base', symbol: 'ETH', color: '#0052FF', explorerUrl: 'https://basescan.org', explorerName: 'BaseScan', apiChain: 'base', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/base.png', coinGeckoId: 'ethereum' },
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

async function encryptPrivateKey(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return JSON.stringify({
    v: 2,
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  });
}

async function decryptPrivateKey(encoded: string, password: string): Promise<string> {
  // Backward compatibility — old XOR format had no JSON wrapper
  let parsed: { v?: number; data: string; iv: string; salt: string };
  try {
    parsed = JSON.parse(encoded);
    if (parsed.v !== 2) throw new Error('Unsupported encryption version');
  } catch {
    // Legacy XOR-encrypted wallet — decrypt with old algorithm
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
    }
    return result;
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = Uint8Array.from(atob(parsed.salt), c => c.charCodeAt(0));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(parsed.data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
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
  const router = useRouter();
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
  const [assetSearch, setAssetSearch] = useState('');
  const [assetSort, setAssetSort] = useState<'value' | 'change' | 'alpha' | 'recent'>('value');
  const [chainFilter, setChainFilter] = useState('all');
  const [showSecuritySection, setShowSecuritySection] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [recentActivity, setRecentActivity] = useState<{ id: string; type: string; from?: string; to?: string; amount: string; symbol: string; valueUsd: string; timestamp: number; txHash?: string; chain?: string }[]>([]);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

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
    } catch (err) {
      console.error('[wallet-page] Fetch prices failed:', err);
    } finally { setPricesLoading(false); }
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
        } catch {
          // Malformed JSON — return default
        }
      }
    } catch (err) {
      console.error('[wallet-page] Fetch balances failed:', err);
    } finally { setLoading(false); }
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

  // CountUp animation: runs whenever walletData changes
  useEffect(() => {
    const target = walletData ? parseFloat(walletData.totalBalanceUsd || '0') : 0;
    if (target === 0) { setDisplayBalance(0); return; }
    const duration = 800;
    const steps = 40;
    const step = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) { setDisplayBalance(target); clearInterval(interval); }
      else setDisplayBalance(current);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [walletData]);

  // Load recent activity from localStorage swap history
  useEffect(() => {
    const raw = localStorage.getItem('steinz_swap_history');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { id: string; type: string; from: string; to: string; fromAmount: number; toAmount: number; chain: string; txHash: string; timestamp: number; address: string }[];
        setRecentActivity(parsed.slice(0, 5).map(r => ({
          id: r.id,
          type: 'swap',
          from: r.from,
          to: r.to,
          amount: r.fromAmount?.toString() || '0',
          symbol: r.from || '',
          valueUsd: '0',
          timestamp: r.timestamp,
          txHash: r.txHash,
          chain: r.chain,
        })));
      } catch { /* ignore */ }
    }
  }, []);

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

  const CHAIN_FILTER_PILLS = [
    { id: 'all', label: 'All' },
    { id: 'ethereum', label: 'Ethereum' },
    { id: 'solana', label: 'Solana' },
    { id: 'base', label: 'Base' },
    { id: 'arbitrum', label: 'Arbitrum' },
    { id: 'polygon', label: 'Polygon' },
    { id: 'bnb', label: 'BSC' },
  ];

  const allHoldings = (() => {
    let tokens = [...(walletData?.holdings || [])];
    if (assetSearch) tokens = tokens.filter(t => t.symbol.toLowerCase().includes(assetSearch.toLowerCase()) || t.name.toLowerCase().includes(assetSearch.toLowerCase()));
    if (assetSort === 'value') tokens.sort((a, b) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));
    else if (assetSort === 'alpha') tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
    else if (assetSort === 'change') tokens.sort((a, b) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));
    return tokens;
  })();

  const pnlAmount = currentBalance * (priceChange / 100);
  const pnlPositive = priceChange >= 0;

  const copyAddress = () => {
    navigator.clipboard.writeText(activeWallet?.address || '');
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const getExplorerUrl = (txHash: string, chain?: string) => {
    if (chain === 'solana') return `https://solscan.io/tx/${txHash}`;
    if (chain === 'base') return `https://basescan.org/tx/${txHash}`;
    if (chain === 'arbitrum') return `https://arbiscan.io/tx/${txHash}`;
    return `https://etherscan.io/tx/${txHash}`;
  };

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-600/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4">

        {wallets.length === 0 ? (
          /* ── EMPTY STATE ────────────────────────────────── */
          <div className="pt-12 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-600/20 to-violet-600/20 rounded-3xl flex items-center justify-center shadow-2xl border border-blue-500/20">
              <SteinzLogo size={56} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Naka Wallet</h1>
            <p className="text-slate-400 text-sm mb-8">Non-custodial. Your keys, your crypto.</p>
            <div className="space-y-3 mb-6">
              <button onClick={() => setView('create')} className="w-full py-4 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                <Plus className="w-5 h-5" /> Create New Wallet
              </button>
              <button onClick={() => setView('import')} className="w-full py-4 bg-slate-900 border border-slate-800 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-slate-800/80">
                <Download className="w-5 h-5" /> Import Existing Wallet
              </button>
            </div>
            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-left">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">100% Non-Custodial</span>
              </div>
              <p className="text-[11px] text-slate-500">Your seed phrase and private keys never leave your device. Naka never has access to your funds.</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── TOP BAR ─────────────────────────────────── */}
            <div className="flex items-center justify-between pt-4 pb-5">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">N</div>
                <span className="text-base font-bold">Naka Wallet</span>
                {wallets.length > 1 && (
                  <select
                    className="bg-transparent text-sm text-slate-400 appearance-none cursor-pointer max-w-[90px] truncate"
                    value={activeWallet?.address}
                    onChange={(e) => { const w = wallets.find(w => w.address === e.target.value); if (w) setActiveWallet(w); }}
                  >
                    {wallets.map(w => (
                      <option key={w.address} value={w.address} className="bg-slate-900 text-white">{w.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <button onClick={() => setView('wallet-settings')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                <Settings className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* ── HERO BALANCE CARD ────────────────────────── */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 border border-slate-800/50 shadow-[0_0_30px_rgba(59,130,246,0.08)] p-6 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Total Balance</p>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-4xl sm:text-5xl font-bold font-mono text-white leading-none">
                      {hideBalance ? '••••••' : `$${displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  {!hideBalance && LIVE_CHAINS.includes(activeChain.id) && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${
                      pnlPositive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {pnlPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {pnlPositive ? '+' : ''}{pnlAmount >= 0.01 ? `$${pnlAmount.toFixed(2)} ` : ''}{priceChange !== 0 ? `(${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)` : ''} today
                    </span>
                  )}
                  <button onClick={copyAddress} className="mt-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                    <span className="text-[11px] font-mono text-slate-400">
                      {activeWallet?.address.slice(0, 8)}...{activeWallet?.address.slice(-6)}
                    </span>
                    {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  </button>
                </div>
                <button onClick={() => { if (activeWallet) { fetchBalances(activeWallet.address, activeChain); fetchPrices(); } }} disabled={loading} className="p-2 hover:bg-white/5 rounded-xl transition-colors ml-2 mt-1">
                  <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* ── 4 ACTION BUTTONS ─────────────────────────── */}
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Send', icon: <ArrowUpRight className="w-6 h-6" />, color: '#0A1EFF', action: () => setView('send'), enabled: EVM_LIVE_CHAINS.includes(activeChain.id) || activeChain.id === 'solana' },
                { label: 'Receive', icon: <ArrowDownLeft className="w-6 h-6" />, color: '#10B981', action: () => setView('receive'), enabled: true },
                { label: 'Swap', icon: <Repeat className="w-6 h-6" />, color: '#8B5CF6', action: () => router.push('/dashboard/swap'), enabled: true },
                { label: 'Buy', icon: <ShoppingCart className="w-6 h-6" />, color: '#F59E0B', action: () => { /* coming soon */ }, enabled: false },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  disabled={!btn.enabled}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border min-h-[80px] p-3 transition-all duration-200 ${
                    btn.enabled
                      ? 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)] active:scale-95'
                      : 'bg-slate-900/40 border-slate-800/40 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div style={{ color: btn.enabled ? btn.color : '#64748b' }}>{btn.icon}</div>
                  <span className="text-xs font-medium text-slate-300">{btn.label}</span>
                  {!btn.enabled && <span className="text-[8px] text-slate-600 -mt-1">Soon</span>}
                </button>
              ))}
            </div>

            {/* ── CHAIN FILTER PILLS ───────────────────────── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
              {CHAIN_FILTER_PILLS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setChainFilter(p.id); if (p.id !== 'all') { const c = SUPPORTED_CHAINS.find(c => c.id === p.id); if (c) setActiveChain(c); } }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                    chainFilter === p.id
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-slate-900/50 text-slate-400 border-slate-800/60 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* ── SEARCH + SORT BAR ────────────────────────── */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder-slate-600 text-white"
                />
              </div>
              <select
                value={assetSort}
                onChange={e => setAssetSort(e.target.value as typeof assetSort)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-400 focus:outline-none focus:border-blue-500/40 shrink-0"
              >
                <option value="value">By Value</option>
                <option value="change">By Change</option>
                <option value="alpha">A–Z</option>
              </select>
            </div>

            {/* ── ASSETS LIST ──────────────────────────────── */}
            <div className="space-y-2 mb-6">
              {loading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-[68px] bg-slate-900/40 border border-slate-800/30 rounded-xl animate-pulse" />
                  ))}
                </>
              ) : allHoldings.length > 0 ? (
                allHoldings.map((token, i) => {
                  const val = parseFloat(token.valueUsd || '0');
                  const bal = parseFloat(token.balance) || 0;
                  const logoUrl = (COIN_LOGOS as Record<string, string>)[token.symbol.toUpperCase()];
                  return (
                    <button
                      key={i}
                      onClick={() => router.push(`/dashboard/market/${activeChain.id}/${token.contractAddress || token.symbol}`)}
                      className="w-full flex items-center gap-4 p-4 bg-slate-900/40 border border-slate-800/30 rounded-xl hover:bg-slate-900/80 hover:border-slate-800/60 hover:translate-x-0.5 transition-all duration-150 group text-left"
                    >
                      {logoUrl ? (
                        <img src={logoUrl} alt={token.symbol} className="w-11 h-11 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold shrink-0">{token.symbol.slice(0, 2)}</div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-bold text-white text-sm">{token.symbol}</p>
                        <p className="text-xs text-slate-400 truncate">{token.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-white text-sm">{hideBalance ? '••••' : bal.toLocaleString(undefined, { maximumFractionDigits: 6 })} {token.symbol}</p>
                        <p className="text-xs text-slate-400 font-mono">{hideBalance ? '••••' : val > 0 ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  );
                })
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
                    <Wallet className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-slate-300 font-semibold mb-1">No assets yet</p>
                  <p className="text-slate-500 text-sm mb-4">Your Naka Wallet is ready. Add funds to get started.</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setView('receive')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors">Receive</button>
                    <button disabled className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-semibold text-slate-400 opacity-60">Buy (soon)</button>
                  </div>
                </div>
              )}

              <button onClick={() => setView('add-token')} className="w-full py-3 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:border-slate-700 flex items-center justify-center gap-2 transition-all">
                <Plus className="w-3.5 h-3.5" /> Add Custom Token
              </button>
            </div>

            {/* ── RECENT ACTIVITY ──────────────────────────── */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-white">Recent Activity</h2>
                <Link href="/dashboard/transactions" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  View All <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/30 rounded-xl overflow-hidden">
                {recentActivity.length > 0 ? recentActivity.map((tx, i) => (
                  <div key={tx.id} className={`flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors ${i > 0 ? 'border-t border-slate-800/30' : ''}`}>
                    <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">Swapped {tx.amount} {tx.from} → {tx.to}</p>
                      <p className="text-xs text-slate-500">{formatTimeAgo(tx.timestamp)}</p>
                    </div>
                    {tx.txHash && (
                      <a href={getExplorerUrl(tx.txHash, tx.chain)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 shrink-0">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )) : (
                  <div className="py-8 text-center">
                    <p className="text-slate-500 text-sm">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── SECURITY SECTION ─────────────────────────── */}
            <div className="mb-5 bg-slate-900/40 border border-slate-800/30 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowSecuritySection(!showSecuritySection)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-white">Security</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showSecuritySection ? 'rotate-180' : ''}`} />
              </button>
              {showSecuritySection && (
                <div className="border-t border-slate-800/30 divide-y divide-slate-800/20">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">Back up seed phrase</p>
                        <p className="text-xs text-slate-500">Store your 12-word phrase safely</p>
                      </div>
                    </div>
                    <button onClick={() => setView('wallet-settings')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition-colors">
                      Backup
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">2FA Authentication</p>
                        <p className="text-xs text-slate-500">Coming in Phase 2</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 px-3 py-1.5 border border-slate-800 rounded-lg">Soon</span>
                  </div>
                  {activeWallet && LIVE_CHAINS.includes(activeChain.id) && (
                    <div className="p-4">
                      <a href={`${activeChain.explorerUrl}/address/${activeWallet.address}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-xl text-xs text-slate-400 hover:text-slate-300 transition-colors">
                        View on {activeChain.explorerName} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── ADVANCED ─────────────────────────────────── */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Advanced</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('create')}
                  disabled={wallets.length >= MAX_WALLETS}
                  className="flex-1 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Account
                </button>
                <button
                  onClick={() => setView('import')}
                  disabled={wallets.length >= MAX_WALLETS}
                  className="flex-1 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" /> Import Wallet
                </button>
              </div>
              {wallets.length >= MAX_WALLETS && (
                <p className="text-xs text-amber-400 mt-2 text-center">Max {MAX_WALLETS} wallets. Remove one to add more.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── DELETE CONFIRM MODAL ─────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-[320px] mx-4 bg-slate-950 border border-slate-800/50 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold mb-2 text-white">Delete Wallet?</h3>
            <p className="text-xs text-slate-400 mb-4">
              This removes the wallet from this device. Make sure your seed phrase is backed up first.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={() => removeWallet(walletToDelete)} className="flex-1 py-2.5 bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-500/30 transition-colors border border-red-500/20">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE FLOATING SEND BUTTON ──────────────────── */}
      {wallets.length > 0 && activeWallet && (EVM_LIVE_CHAINS.includes(activeChain.id) || activeChain.id === 'solana') && (
        <button
          onClick={() => setView('send')}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-600/30 hover:scale-105 active:scale-95 transition-all duration-200 sm:hidden z-40"
          title="Send"
        >
          <ArrowUpRight className="w-6 h-6 text-white" />
        </button>
      )}
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

    } finally { setCreating(false); }
  };

  const confirmAndSave = async () => {
    const encrypted = await encryptPrivateKey(privateKey, password);
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
      const encrypted = await encryptPrivateKey(wallet.privateKey, password);
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
      const decryptedKey = await decryptPrivateKey(wallet.encryptedKey, password);
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
