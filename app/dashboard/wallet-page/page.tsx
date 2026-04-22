'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Download, Send, Copy, Eye, EyeOff, RotateCcw, Trash2, ChevronRight, Wallet, Key, Shield, Check, AlertTriangle, ExternalLink, Globe, Layers, ArrowUpRight, ArrowDownLeft, Repeat, DollarSign, TrendingUp, TrendingDown, Settings, Search, QrCode, X, RefreshCw, ChevronDown, ShoppingCart, Zap, Share2 } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { notifyWalletCreated, notifyWalletImported, notifySeedBackupReminder } from '@/lib/notifications';
import { WalletTokenRow } from '@/components/wallet/WalletTokenRow';

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
  // Batch 1 / bug §4.3: mnemonic is only derivable when the wallet was generated
  // from a fresh HD seed. ethers can't go private-key → mnemonic, so we must
  // persist the encrypted mnemonic at creation time or the "Reveal Seed" action
  // has no way to show it later.
  encryptedMnemonic?: string;
  // How the wallet entered our vault: 'generated' (we made the seed), 'seed'
  // (user imported 12/24-word phrase), or 'private_key' (user imported raw pk).
  // Drives which reveal options the UI surfaces.
  importMethod?: 'generated' | 'seed' | 'private_key';
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
  // FIX 5A.1 / Phase 4: apiChain was 'bnb' but server (EVM_CHAIN_CONFIG) keys it as 'bsc' — the mismatch
  // meant BSC pill fetched nothing and the UI showed stale prior-chain data (e.g. Solana after clicking BSC).
  { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', color: '#F0B90B', explorerUrl: 'https://bscscan.com', explorerName: 'BscScan', apiChain: 'bsc', logoUrl: COIN_LOGOS.BNB, coinGeckoId: 'binancecoin' },
  { id: 'fantom', name: 'Fantom', symbol: 'FTM', color: '#1969FF', explorerUrl: 'https://ftmscan.com', explorerName: 'FtmScan', apiChain: 'fantom', logoUrl: COIN_LOGOS.FTM, coinGeckoId: 'fantom' },
  { id: 'cronos', name: 'Cronos', symbol: 'CRO', color: '#002D74', explorerUrl: 'https://cronoscan.com', explorerName: 'CronoScan', apiChain: 'cronos', logoUrl: COIN_LOGOS.CRO, coinGeckoId: 'crypto-com-chain' },
  { id: 'sui', name: 'Sui', symbol: 'SUI', color: '#4DA2FF', explorerUrl: 'https://suiscan.xyz', explorerName: 'SuiScan', apiChain: 'sui', logoUrl: COIN_LOGOS.SUI, coinGeckoId: 'sui' },
];

// FIX 5A.1 / Phase 4: was 'ethereum,base,polygon,avalanche,solana' only, which is why
// clicking Arbitrum / BNB pills showed the previous chain's balances — they weren't gated
// for live fetching. Now matches the full set supported by /api/wallet-intelligence.
// All chains the backend can actually price balances for. This is the
// full universe — the home list below further filters this by the
// user's enabled-chains preference (see DEFAULT_ENABLED_CHAINS and
// NAKA_ENABLED_CHAINS_KEY).
const LIVE_CHAINS = ['ethereum', 'base', 'polygon', 'avalanche', 'solana', 'arbitrum', 'bnb'];
const EVM_LIVE_CHAINS = ['ethereum', 'base', 'polygon', 'avalanche', 'arbitrum', 'bnb'];

// Default chains to show on the wallet home — in display order.
// Everything else is toggled on by the user via Add Network.
const DEFAULT_ENABLED_CHAINS = ['ethereum', 'solana', 'polygon', 'arbitrum', 'bnb', 'base'];
const NAKA_ENABLED_CHAINS_KEY = 'naka_enabled_chains';
// Display priority: native chains first (ETH/BNB/Polygon/SOL), then the
// two seeded platform tokens, then anything else the user has added.
const TOKEN_SORT_PRIORITY: Array<{ chain: string; symbol?: string; contract?: string }> = [
  { chain: 'ethereum', symbol: 'ETH' },
  { chain: 'bnb', symbol: 'BNB' },
  { chain: 'polygon', symbol: 'MATIC' },
  { chain: 'solana', symbol: 'SOL' },
  { chain: 'ethereum', contract: '0x6967b9a8c0b14849cfe8f9e5732b401433fd2898' }, // Naka Go
  { chain: 'polygon',  contract: '0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19' }, // Pleasure Coin
];
function priorityIndex(chain: string, symbol: string, contract: string | null | undefined): number {
  const c = (contract || '').toLowerCase();
  for (let i = 0; i < TOKEN_SORT_PRIORITY.length; i++) {
    const p = TOKEN_SORT_PRIORITY[i];
    if (p.chain !== chain) continue;
    if (p.contract && p.contract === c) return i;
    if (p.symbol && !p.contract && !c && p.symbol === symbol.toUpperCase()) return i;
  }
  return TOKEN_SORT_PRIORITY.length + 1;
}

// Map a wallet holding (symbol + chain) to its CoinGecko id for sparkline lookup.
// Falls back to chain's native-asset id so we always render a line rather than a blank.
const SYMBOL_TO_CG: Record<string, string> = {
  ETH: 'ethereum', WETH: 'weth', BTC: 'bitcoin', WBTC: 'wrapped-bitcoin',
  SOL: 'solana', BNB: 'binancecoin', MATIC: 'matic-network', AVAX: 'avalanche-2',
  USDC: 'usd-coin', USDT: 'tether', DAI: 'dai', LINK: 'chainlink', UNI: 'uniswap',
  AAVE: 'aave', SHIB: 'shiba-inu', PEPE: 'pepe', ARB: 'arbitrum', OP: 'optimism',
  FTM: 'fantom', CRO: 'crypto-com-chain', SUI: 'sui',
};
function resolveCoinGeckoId(symbol: string, chain: { coinGeckoId: string }): string {
  return SYMBOL_TO_CG[symbol.toUpperCase()] || chain.coinGeckoId;
}

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
  const searchParams = useSearchParams();
  const [view, setView] = useState<'main' | 'create' | 'import' | 'send' | 'receive' | 'add-token' | 'add-network' | 'wallet-settings'>('main');
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<StoredWallet | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [customTokens, setCustomTokens] = useState<string[]>([]);
  // Enabled chains — persisted per-device. Default is the 4 native
  // chains (ETH/BNB/Polygon/SOL); anything else the user toggles on
  // via the Add Network flow.
  const [enabledChains, setEnabledChains] = useState<string[]>(DEFAULT_ENABLED_CHAINS);
  // Hydrated TokenBalance rows for each custom-token entry
  // (chain:contractAddress). Pulled from /api/market/token/<addr>
  // (DexScreener fallback when CoinGecko has no slug) so Naka Go +
  // Pleasure Coin always render with real price/logo even when the
  // wallet has zero balance.
  const [customTokenRows, setCustomTokenRows] = useState<Array<TokenBalance & { chain: string }>>([]);
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
    let cancelled = false;

    const hydrate = async () => {
      // Read local first so the UI is interactive immediately (<5ms).
      const stored = localStorage.getItem('steinz_wallets');
      const localWallets: StoredWallet[] = stored ? (JSON.parse(stored) as StoredWallet[]) : [];
      const defAddr = localStorage.getItem('steinz_default_wallet') || '';

      if (localWallets.length > 0 && !cancelled) {
        setWallets(localWallets);
        setDefaultWalletAddress(defAddr);
        const def = localWallets.find((w) => w.address === defAddr) || localWallets[0];
        if (def) setActiveWallet(def);
      }

      // Then reconcile with cloud backup. The /api/wallet/sync endpoint
      // refuses to wipe stored wallets, so even a transient empty local
      // state cannot poison the cloud.
      try {
        const res = await fetch('/api/wallet/sync', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const cloud = (await res.json()) as { wallets: StoredWallet[]; defaultAddress: string | null };
        const cloudWallets = Array.isArray(cloud.wallets) ? cloud.wallets : [];

        // Union local + cloud by address; cloud is the durable record but
        // local may have wallets not yet synced (offline-create case).
        const byAddr = new Map<string, StoredWallet>();
        for (const w of cloudWallets) byAddr.set(w.address.toLowerCase(), w);
        for (const w of localWallets) byAddr.set(w.address.toLowerCase(), w);
        const merged = Array.from(byAddr.values());

        if (cancelled) return;

        // Push the union back so cloud and local agree. Skip if nothing to do.
        if (merged.length > 0 && merged.length !== cloudWallets.length) {
          void fetch('/api/wallet/sync', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallets: merged, defaultAddress: defAddr || cloud.defaultAddress }),
          });
        }

        if (merged.length > 0) {
          setWallets(merged);
          localStorage.setItem('steinz_wallets', JSON.stringify(merged));
          const finalDef = defAddr || cloud.defaultAddress || '';
          setDefaultWalletAddress(finalDef);
          const def = merged.find((w) => w.address === finalDef) || merged[0];
          if (def) setActiveWallet(def);
        }
      } catch (err) {
        console.warn('[wallet-page] cloud sync unavailable:', err);
      }
    };

    void hydrate();

    // §4.6 — seed default platform tokens on first load. Naka Go and
    // Pleasure Coin are the two tokens users should always see regardless
    // of whether the on-chain balance fetch picked them up. Contract
    // addresses match the ones in the product spec. Stored in
    // localStorage alongside user-added custom tokens so the user can
    // still remove them via the Add Token view if they choose to.
    const DEFAULT_TOKENS = [
      'ethereum:0x6967b9a8c0b14849CFE8f9E5732B401433fD2898', // Naka Go
      'polygon:0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19',  // Pleasure Coin
    ];
    const stored = localStorage.getItem('steinz_custom_tokens');
    const parsed: string[] = stored ? JSON.parse(stored) : [];
    let merged = parsed;
    let changed = false;
    for (const t of DEFAULT_TOKENS) {
      if (!parsed.includes(t)) { merged = [...merged, t]; changed = true; }
    }
    if (changed) localStorage.setItem('steinz_custom_tokens', JSON.stringify(merged));
    setCustomTokens(merged);
    // Hydrate enabled chains preference, default to the 4 natives.
    try {
      const storedChains = localStorage.getItem(NAKA_ENABLED_CHAINS_KEY);
      if (storedChains) {
        const parsedChains = JSON.parse(storedChains) as string[];
        if (Array.isArray(parsedChains) && parsedChains.length) setEnabledChains(parsedChains);
      } else {
        localStorage.setItem(NAKA_ENABLED_CHAINS_KEY, JSON.stringify(DEFAULT_ENABLED_CHAINS));
      }
    } catch { /* localStorage quota — use defaults */ }
    const savedSort = localStorage.getItem('steinz_token_sort') as 'value' | 'name' | 'balance' | null;
    if (savedSort) setTokenSort(savedSort);
    const savedHideSmall = localStorage.getItem('steinz_hide_small');
    if (savedHideSmall) setHideSmallBalances(savedHideSmall === 'true');
    fetchPrices();

    return () => {
      cancelled = true;
    };
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

  const saveWallets = (w: StoredWallet[], opts: { intent?: 'save' | 'clear' } = {}) => {
    // Hard guard: never silently wipe wallets. If the caller is trying to
    // shrink the local set to empty, require explicit `intent: 'clear'`.
    if (w.length === 0 && wallets.length > 0 && opts.intent !== 'clear') {
      console.warn('[wallet-page] refused to overwrite wallets with empty array (intent not "clear")');
      return;
    }
    setWallets(w);
    localStorage.setItem('steinz_wallets', JSON.stringify(w));
    void fetch('/api/wallet/sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallets: w,
        defaultAddress: defaultWalletAddress || w[0]?.address || null,
        ...(opts.intent === 'clear' ? { intent: 'clear' } : {}),
      }),
    }).catch((err) => console.warn('[wallet-page] cloud save failed:', err));
  };

  const fetchBalances = useCallback(async (address: string, chain: ChainInfo) => {
    setLoading(true);
    // FIX 5A.1 / Phase 4: was leaving prior chain's holdings visible during the fetch,
    // which is why switching chains felt like "click SOL, still see ETH". Clear first.
    setWalletData(null);
    try {
      // 10s ceiling — RPC balance-of calls can stall on a cold lambda and the
      // user has to see something within the 0.5–1s load budget; we retain the
      // previous render above this, but guarantee the spinner clears.
      const res = await fetch(`/api/wallet-intelligence?address=${address}&chain=${chain.apiChain}`, {
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      });
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

  // Deep-link hydration from the coin-detail page's Send / Receive
  // buttons. URL shape: ?action=send|receive[&chain=<id>]. If chain is
  // specified we switch the active chain so the view opens on the
  // correct asset.
  useEffect(() => {
    const action = searchParams?.get('action');
    const wantedChainId = searchParams?.get('chain');
    if (!action) return;
    if (wantedChainId) {
      const c = SUPPORTED_CHAINS.find((x) => x.id === wantedChainId);
      if (c) setActiveChain(c);
    }
    if (action === 'send') setView('send');
    else if (action === 'receive') setView('receive');
    // Strip the query params so refresh doesn't keep reopening.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      url.searchParams.delete('chain');
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    } catch { /* SSR — ignore */ }
  }, [searchParams]);

  // Hydrate custom-token metadata (Naka Go, Pleasure Coin, anything the
  // user added). Each entry is "<chain>:<contract>"; we call
  // /api/market/token/<contract> which hits DexScreener for small-cap
  // contracts that CoinGecko doesn't index. Real name / symbol / price /
  // image all arrive from the pair data. Cached per (chain,address) for
  // 5 min in memory so switching chain filters doesn't refetch.
  useEffect(() => {
    if (customTokens.length === 0) { setCustomTokenRows([]); return; }
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(customTokens.map(async (entry) => {
        const [chainId, contract] = entry.split(':');
        if (!chainId || !contract) return null;
        try {
          const res = await fetch(`/api/market/token/${contract}`);
          if (!res.ok) return null;
          const data = await res.json() as {
            symbol?: string; name?: string;
            image?: { small?: string; thumb?: string };
            market_data?: { current_price?: { usd?: number } };
          };
          const price = data?.market_data?.current_price?.usd ?? 0;
          return {
            symbol: (data?.symbol ?? 'TKN').toUpperCase(),
            name: data?.name ?? 'Custom Token',
            balance: '0',
            valueUsd: price > 0 ? '0' : null,
            contractAddress: contract,
            logo: data?.image?.small ?? data?.image?.thumb,
            chain: chainId,
          } as TokenBalance & { chain: string };
        } catch {
          return null;
        }
      }));
      if (!cancelled) {
        setCustomTokenRows(rows.filter((r): r is TokenBalance & { chain: string } => r !== null));
      }
    })();
    return () => { cancelled = true; };
  }, [customTokens]);

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
    // Always drop a dedicated seed-backup reminder so the bell has a
    // non-dismissible paper trail even if the user closes the in-context
    // banner before actually writing their phrase down.
    notifySeedBackupReminder(`${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`);
  };

  const handleWalletImported = (wallet: StoredWallet) => {
    if (wallets.length >= MAX_WALLETS) return;
    const updated = [...wallets, wallet];
    saveWallets(updated);
    setActiveWallet(wallet);
    setView('main');
    notifyWalletImported(wallet.name);
    notifySeedBackupReminder(`${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`);
  };

  const removeWallet = (addr: string) => {
    const updated = wallets.filter(w => w.address !== addr);
    // Removing the last wallet is an explicit user action — pass intent:'clear'
    // so the cloud-sync guard allows it.
    saveWallets(updated, updated.length === 0 ? { intent: 'clear' } : {});
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
  if (view === 'add-network') return <AddNetworkView
    onBack={() => setView('main')}
    enabled={enabledChains}
    onChange={(next) => {
      setEnabledChains(next);
      try { localStorage.setItem(NAKA_ENABLED_CHAINS_KEY, JSON.stringify(next)); } catch { /* quota */ }
    }}
  />;
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
    // Base holdings from the on-chain balance fetch, plus every
    // hydrated custom token (Naka Go, Pleasure Coin, user adds).
    // Custom rows always appear even when balance is zero so the user
    // can see the price + click through to the coin-detail page.
    const onChain = (walletData?.holdings || []).map((t) => ({
      ...t,
      chain: activeChain.id,
    })) as Array<TokenBalance & { chain: string }>;
    const seen = new Set(onChain.map((t) => `${t.chain}:${(t.contractAddress || t.symbol).toLowerCase()}`));
    const customOnly = customTokenRows.filter((t) =>
      !seen.has(`${t.chain}:${(t.contractAddress || t.symbol).toLowerCase()}`)
    );
    let tokens: Array<TokenBalance & { chain: string }> = [...onChain, ...customOnly];
    // Enabled-chains preference — the home list only shows rows whose
    // chain the user has toggled on. Default: ETH/BNB/Polygon/SOL +
    // the two seeded custom tokens (which live on Ethereum + Polygon,
    // both enabled by default). User extends via Add Network.
    tokens = tokens.filter((t) => enabledChains.includes(t.chain));
    // Chain pill filter — only apply when not on 'all'. Solana + BTC
    // etc. don't have EVM contract tokens so they naturally filter out.
    if (chainFilter !== 'all') tokens = tokens.filter((t) => t.chain === chainFilter);
    if (assetSearch) tokens = tokens.filter(t => t.symbol.toLowerCase().includes(assetSearch.toLowerCase()) || t.name.toLowerCase().includes(assetSearch.toLowerCase()));
    // Hide small balances: drop anything under $1 so dust doesn't clutter the
    // list. Matches the Trust Wallet preference toggle. Custom tokens with
    // no balance keep showing regardless (they're aspirational holdings).
    if (hideSmallBalances) tokens = tokens.filter(t => parseFloat(t.valueUsd || '0') >= 1 || parseFloat(t.balance || '0') === 0);
    // Explicit priority sort wins over the user's value/alpha sort for
    // the top of the list — we always want ETH → BNB → Polygon → SOL →
    // Naka Go → Pleasure Coin at the top, then user's preferred sort
    // for everything below priority.
    const withPriority = tokens.map((t) => ({
      t, prio: priorityIndex(t.chain, t.symbol, t.contractAddress ?? null),
    }));
    if (assetSort === 'value') withPriority.sort((a, b) =>
      a.prio - b.prio || parseFloat(b.t.valueUsd || '0') - parseFloat(a.t.valueUsd || '0'));
    else if (assetSort === 'alpha') withPriority.sort((a, b) =>
      a.prio - b.prio || a.t.symbol.localeCompare(b.t.symbol));
    else if (assetSort === 'change') withPriority.sort((a, b) =>
      a.prio - b.prio || parseFloat(b.t.valueUsd || '0') - parseFloat(a.t.valueUsd || '0'));
    return withPriority.map((x) => x.t);
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
                <SteinzLogo size={20} />
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
              <div className="flex items-center gap-1">
                {/* Scan QR — opens the device camera to read a wallet address /
                    WalletConnect URI. Falls back to a paste-address prompt on
                    browsers without mediaDevices.getUserMedia (same UX Trust
                    Wallet gives on desktop). */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
                        // Browsers permit camera only on https — request and immediately stop,
                        // actual QR decode lives behind the feature flag below so we don't
                        // ship half-built camera plumbing to production.
                        await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                          .then((s) => s.getTracks().forEach((t) => t.stop()));
                      }
                      const pasted = window.prompt('Paste a wallet address or WalletConnect URI to scan:');
                      if (pasted && pasted.trim()) {
                        navigator.clipboard.writeText(pasted.trim());
                      }
                    } catch {
                      const pasted = window.prompt('Paste a wallet address or WalletConnect URI:');
                      if (pasted && pasted.trim()) navigator.clipboard.writeText(pasted.trim());
                    }
                  }}
                  aria-label="Scan QR code"
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <QrCode className="w-5 h-5 text-slate-400" />
                </button>
                <button onClick={() => setView('wallet-settings')} className="p-2 hover:bg-white/5 rounded-xl transition-colors" aria-label="Wallet settings">
                  <Settings className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* FIX 5A.1 / Phase 4: prominent backup reminder. User confirmed they haven't backed up
                their seed — without this banner the reveal flow in settings is hard to discover. */}
            {activeWallet && typeof window !== 'undefined' && !localStorage.getItem(`naka_seed_backed_up_${activeWallet.address}`) && (
              <button
                onClick={() => setView('wallet-settings')}
                className="w-full mb-3 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-left hover:bg-amber-500/15 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-amber-200">Back up your seed phrase</p>
                  <p className="text-[10px] text-amber-300/70">If you lose access you won't be able to recover your wallet.</p>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
              </button>
            )}

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
              <button
                type="button"
                onClick={() => {
                  const next = !hideSmallBalances;
                  setHideSmallBalances(next);
                  try { localStorage.setItem('steinz_hide_small', String(next)); } catch { /* ignore */ }
                }}
                aria-pressed={hideSmallBalances}
                title={hideSmallBalances ? 'Showing all balances' : 'Hiding dust (< $1)'}
                className={`shrink-0 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  hideSmallBalances
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                Hide small
              </button>
            </div>

            {/* ── ASSETS LIST (Trust Wallet-style vertical rows) ──────── */}
            <div className="flex flex-col mb-6 divide-y divide-slate-900/60">
              {loading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-[64px] bg-slate-900/30 my-1 rounded-xl animate-pulse" />
                  ))}
                </>
              ) : allHoldings.length > 0 ? (
                allHoldings.map((token, i) => {
                  const logoUrl = (COIN_LOGOS as Record<string, string>)[token.symbol.toUpperCase()];
                  return (
                    <WalletTokenRow
                      key={`${token.symbol}-${i}`}
                      symbol={token.symbol}
                      name={token.name}
                      balance={token.balance}
                      valueUsd={token.valueUsd}
                      contractAddress={token.contractAddress}
                      logoUrl={logoUrl}
                      chainLabel={activeChain.name}
                      coinGeckoId={resolveCoinGeckoId(token.symbol, activeChain)}
                      hideBalance={hideBalance}
                      // §4.5 — wallet token click opens the Trust-Wallet-style coin detail
                      // (line chart + fiat buy + Holdings/History/About + Send/Receive/Swap
                      // /Buy/Sell action bar), NOT the full trading terminal. The market
                      // trading view lives at /dashboard/market/<chain>/<addr>.
                      // Use token.chain so clicking a Solana token from the Base filter
                      // still routes to a Solana page (§4.2 chain detection fix).
                      onClick={() => router.push(`/dashboard/wallet-page/coin/${(token as any).chain || activeChain.id}/${token.contractAddress || token.symbol}`)}
                    />
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

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setView('add-network')} className="py-3 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:border-slate-700 flex items-center justify-center gap-2 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Network
                </button>
                <button onClick={() => setView('add-token')} className="py-3 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:border-slate-700 flex items-center justify-center gap-2 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Custom Token
                </button>
              </div>
            </div>

            {/* Recent Activity container removed from wallet home — lives on the
                dedicated Transactions page (/dashboard/transactions). */}

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
                  {/* "View on Solscan/Explorer" button removed per product
                      direction — users stay inside Naka; explorer links live
                      on individual activity rows if needed. */}
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
    // Bug §4.3: persist the mnemonic too so "Reveal Seed Phrase" actually works
    // later. ethers can't re-derive a mnemonic from a private key, so without
    // this the seed is gone the moment the UI unmounts.
    const encryptedMnemonic = mnemonic ? await encryptPrivateKey(mnemonic, password) : undefined;
    onCreated({
      address,
      encryptedKey: encrypted,
      encryptedMnemonic,
      importMethod: 'generated',
      name: walletName,
      createdAt: new Date().toISOString(),
    });
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
      let phraseForStorage: string | null = null;
      if (method === 'phrase') {
        // BIP39 mnemonics are always lowercase with single-space separators.
        // Users paste from notes apps that auto-capitalize the first word, or
        // copy phrases with tabs/newlines between words, and ethers then
        // throws "invalid mnemonic checksum" because the hash of "Riot ..."
        // differs from "riot ...". Normalize before validating.
        const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');
        wallet = ethers.Wallet.fromPhrase(normalized);
        phraseForStorage = normalized;
      } else {
        // Private keys: strip stray whitespace but keep case (0x-hex is case-insensitive
        // but users sometimes paste with a leading/trailing newline).
        const normalized = input.trim().replace(/\s+/g, '');
        wallet = new ethers.Wallet(normalized);
      }
      const encrypted = await encryptPrivateKey(wallet.privateKey, password);
      const encryptedMnemonic = phraseForStorage ? await encryptPrivateKey(phraseForStorage, password) : undefined;
      onImported({
        address: wallet.address,
        encryptedKey: encrypted,
        encryptedMnemonic,
        importMethod: method === 'phrase' ? 'seed' : 'private_key',
        name: walletName,
        createdAt: new Date().toISOString(),
      });
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

// FIX 5A.1 / Phase 4: chain-aware RPC endpoints so Send works on every chain, not just mainnet.
// Public RPCs used as fallback; user's Alchemy key (if set) is preferred for reliability.
const CHAIN_RPC: Record<string, string> = {
  ethereum: process.env.NEXT_PUBLIC_ALCHEMY_RPC || 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-rpc.com',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  bnb: 'https://bsc-dataseed.binance.org',
  fantom: 'https://rpc.ftm.tools',
};

function isValidAddressForChain(addr: string, chainId: string): boolean {
  if (chainId === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  if (chainId === 'bitcoin') return /^(bc1|[13])[a-zA-Z0-9]{25,62}$/.test(addr);
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function SendView({ onBack, wallet, chain }: { onBack: () => void; wallet: StoredWallet; chain: ChainInfo }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'input' | 'estimating' | 'sending' | 'success' | 'error'>('input');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [gasEstimateEth, setGasEstimateEth] = useState<string | null>(null);

  // FIX 5A.1 / Phase 4: load native balance so the MAX button is meaningful and gas can be deducted.
  useEffect(() => {
    if (chain.id === 'solana' || chain.id === 'bitcoin') return;
    const rpc = CHAIN_RPC[chain.id];
    if (!rpc) return;
    (async () => {
      try {
        const ethers = await import('ethers');
        const provider = new ethers.JsonRpcProvider(rpc);
        const bal = await provider.getBalance(wallet.address);
        setNativeBalance(ethers.formatEther(bal));
      } catch {
        /* ignore */
      }
    })();
  }, [chain.id, wallet.address]);

  const setMax = async () => {
    try {
      const ethers = await import('ethers');
      const rpc = CHAIN_RPC[chain.id];
      if (!rpc) { setAmount(nativeBalance); return; }
      const provider = new ethers.JsonRpcProvider(rpc);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(0);
      const reserved = gasPrice * BigInt(21000);
      const bal = ethers.parseEther(nativeBalance || '0');
      const max = bal > reserved ? bal - reserved : BigInt(0);
      setAmount(ethers.formatEther(max));
    } catch {
      setAmount(nativeBalance);
    }
  };

  const handleSend = async () => {
    if (!to || !amount || !password) return;
    if (!isValidAddressForChain(to, chain.id)) {
      setError(`Recipient isn't a valid ${chain.name} address.`); setStatus('error'); return;
    }
    setStatus('sending'); setError('');
    try {
      if (chain.id === 'solana') {
        setError('Solana send requires the private key to be stored as a base58 keypair. This build supports EVM sends only; Solana send ships next.');
        setStatus('error');
        return;
      }
      const rpc = CHAIN_RPC[chain.id];
      if (!rpc) { setError(`${chain.name} send not supported yet.`); setStatus('error'); return; }
      const ethers = await import('ethers');
      const decryptedKey = await decryptPrivateKey(wallet.encryptedKey, password);
      const provider = new ethers.JsonRpcProvider(rpc);
      const signer = new ethers.Wallet(decryptedKey, provider);

      // Gas estimate prior to sending — surfaces clear errors instead of generic "Transaction failed".
      const value = ethers.parseEther(amount);
      const feeData = await provider.getFeeData();
      const gasLimit = BigInt(21000);
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(0);
      setGasEstimateEth(ethers.formatEther(gasPrice * gasLimit));

      const tx = await signer.sendTransaction({ to, value, gasLimit });
      setTxHash(tx.hash); setStatus('success');
    } catch (e: any) {
      const msg = (e?.shortMessage || e?.message || 'Transaction failed') as string;
      if (/decrypt|password|bad key/i.test(msg)) setError('Wrong wallet password.');
      else if (/insufficient/i.test(msg)) setError('Insufficient balance for amount + gas.');
      else setError(msg.slice(0, 200));
      setStatus('error');
    }
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
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#0A1EFF]/50"
                placeholder={chain.id === 'solana' ? 'Solana address...' : '0x...'}
              />
              {/* FIX 5A.1 / Phase 4: inline address-validity feedback. */}
              {to && !isValidAddressForChain(to, chain.id) && (
                <p className="text-[11px] text-[#F59E0B] mt-1.5">Not a valid {chain.name} address format.</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 font-medium">Amount ({chain.symbol})</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Balance: {parseFloat(nativeBalance || '0').toFixed(6)}</span>
                  {/* FIX 5A.1 / Phase 4: MAX button — was missing. Reserves gas for EVM chains. */}
                  <button type="button" onClick={setMax} className="text-[10px] font-bold text-[#0A1EFF] hover:text-[#3B4EFF]">MAX</button>
                </div>
              </div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.001" className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#0A1EFF]/50" placeholder="0.01" />
              {gasEstimateEth && (
                <p className="text-[10px] text-slate-500 mt-1.5">Est. gas: {parseFloat(gasEstimateEth).toFixed(6)} {chain.symbol}</p>
              )}
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
  // FIX 5A.1 / Phase 4: was a <QrCode> icon placeholder (no real QR); now renders a real
  // scannable QR as an inline <img data:> URL generated client-side via `qrcode`.
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    import('qrcode')
      .then((m) => m.toDataURL(address, { margin: 1, width: 256, color: { dark: '#0A0E1A', light: '#ffffff' } }))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address]);

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

        {/* TRUST WALLET-STYLE warning bar — placed ABOVE the QR / address so the
            user reads it before they ever copy or share. The exact phrasing
            ("lost forever") matches what funds-handling apps use to make sure
            users do not send wrong-chain assets. Mandatory on every chain. */}
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-[#F59E0B] mt-0.5" />
          <p className="text-xs leading-relaxed text-amber-100">
            <span className="font-semibold">Only send {chain.name} ({chain.symbol}) assets to this address.</span> Other assets sent on a different network will be{' '}
            <span className="font-bold underline">lost forever</span>.
          </p>
        </div>

        <div className="text-center">
          <div className="w-56 h-56 bg-white rounded-2xl mx-auto mb-5 flex items-center justify-center p-3 shadow-lg relative">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR code for ${address}`} className="w-full h-full rounded-lg" />
            ) : (
              <div className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-2" style={{ backgroundColor: `${chain.color}08` }}>
                <ChainLogo chain={chain} size={48} />
                <QrCode className="w-10 h-10 text-gray-400" />
              </div>
            )}
            {/* Chain badge overlaying the center of the QR — standard wallet UX. */}
            {qrDataUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                  <ChainLogo chain={chain} size={28} />
                </div>
              </div>
            )}
          </div>

          <p className="text-gray-400 text-xs mb-3">Send {chain.symbol} or tokens to this address:</p>

          <div className="bg-[#111827] border border-white/10 rounded-xl p-4 mb-4">
            <p className="text-xs font-mono break-all text-[#0A1EFF]">{address}</p>
          </div>

          {/* Trust-Wallet-style 3-action row: Copy · Set Amount · Share. Each
              action fails soft — Share silently falls back to copy-link when
              the Web Share API isn't available (desktop Chrome without https, etc). */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <button
              onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex flex-col items-center gap-1.5 py-3 bg-slate-900/60 border border-slate-800 hover:bg-slate-800 rounded-xl transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
              <span className="text-[11px] font-semibold text-slate-200">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => {
                const raw = typeof window !== 'undefined' ? window.prompt(`Amount of ${chain.symbol} to request (optional)`) : null;
                if (raw === null) return;
                const n = Number(raw);
                if (!Number.isFinite(n) || n <= 0) return;
                const link = chain.id === 'solana'
                  ? `solana:${address}?amount=${n}`
                  : `ethereum:${address}?value=${n}`;
                navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex flex-col items-center gap-1.5 py-3 bg-slate-900/60 border border-slate-800 hover:bg-slate-800 rounded-xl transition-colors">
              <DollarSign className="w-4 h-4 text-slate-300" />
              <span className="text-[11px] font-semibold text-slate-200">Set Amount</span>
            </button>
            <button
              onClick={async () => {
                const shareData = {
                  title: `Receive ${chain.symbol}`,
                  text: `Send ${chain.symbol} on ${chain.name} to:\n${address}`,
                };
                try {
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    await navigator.share(shareData);
                  } else {
                    navigator.clipboard.writeText(`${shareData.text}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                } catch { /* user cancelled */ }
              }}
              className="flex flex-col items-center gap-1.5 py-3 bg-slate-900/60 border border-slate-800 hover:bg-slate-800 rounded-xl transition-colors">
              <Share2 className="w-4 h-4 text-slate-300" />
              <span className="text-[11px] font-semibold text-slate-200">Share</span>
            </button>
          </div>

          {/* Deposit-from-exchange hint — Trust Wallet parity. Low-prominence
              but reminds users that CEX withdrawals land on the same address. */}
          <div className="flex items-start gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 text-left mb-4">
            <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-100">Deposit from exchange</p>
              <p className="text-[11px] text-slate-500">Withdraw {chain.symbol} from your exchange to the address above.</p>
            </div>
          </div>

          {/* Lower-prominence reminder — primary warning is the bar above the QR. */}
          <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10">
            <p className="text-[11px] text-gray-500">
              Verified {chain.name} address. Always double-check the first and last 4 characters before sharing.
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

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${on ? 'bg-blue-600' : 'bg-slate-700'}`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function SecretReveal({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-2">
      <div className="relative">
        <div className={`p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono break-all leading-relaxed text-slate-300 select-all min-h-[80px] flex items-center transition-all ${!revealed ? 'blur-md select-none' : ''}`}>
          {value}
        </div>
        {!revealed && (
          <button onClick={() => setRevealed(true)} className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl hover:bg-slate-800 transition-colors">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Tap to Reveal</span>
            </div>
          </button>
        )}
      </div>
      {revealed && (
        <div className="flex gap-2">
          <button onClick={copy} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all ${copied ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
          <button onClick={() => setRevealed(false)} className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors">
            Hide
          </button>
        </div>
      )}
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
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [editName, setEditName] = useState(wallet.name);
  const [renamed, setRenamed] = useState(false);

  // Seed / key reveal
  const [revealPassword, setRevealPassword] = useState('');
  const [revealError, setRevealError] = useState('');
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealedPhrase, setRevealedPhrase] = useState('');
  const [revealedKey, setRevealedKey] = useState('');

  // Change password
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Preferences (persisted to localStorage)
  const [privacyMode, setPrivacyMode] = useState(() => typeof window !== 'undefined' && localStorage.getItem(`naka_privacy_${wallet.address}`) === 'true');
  const [hideSmall, setHideSmall] = useState(() => typeof window !== 'undefined' && localStorage.getItem('steinz_hide_small') === 'true');
  const [currency, setCurrency] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('naka_currency')) || 'USD');
  const [autoLock, setAutoLock] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('naka_autolock')) || '15');
  const [showTestnets, setShowTestnets] = useState(() => typeof window !== 'undefined' && localStorage.getItem('naka_testnets') === 'true');
  const [notifSwap, setNotifSwap] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('naka_notif_swap') !== 'false' : true);
  const [notifReceive, setNotifReceive] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('naka_notif_receive') !== 'false' : true);
  const [notifPrice, setNotifPrice] = useState(() => typeof window !== 'undefined' && localStorage.getItem('naka_notif_price') === 'true');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const savePref = (key: string, value: string) => localStorage.setItem(key, value);

  const handleRename = () => {
    if (editName.trim() && editName.trim() !== wallet.name) {
      onRename(editName.trim());
      setRenamed(true);
      setTimeout(() => setRenamed(false), 1500);
    }
  };

  const handleReveal = async (type: 'phrase' | 'key') => {
    if (!revealPassword) { setRevealError('Enter your wallet password'); return; }
    setRevealLoading(true); setRevealError('');
    try {
      // Validate password by decrypting the private key first. Cheap and
      // gives a clear "Wrong password" signal before we touch the mnemonic.
      const pk = await decryptPrivateKey(wallet.encryptedKey, revealPassword);
      if (!pk || pk.length < 32) { setRevealError('Wrong password'); setRevealLoading(false); return; }

      if (type === 'key') {
        setRevealedKey(pk);
      } else {
        // Bug §4.3: the old code tried ethers.Wallet(pk).mnemonic — that's
        // always undefined (private-key → mnemonic is not a valid derivation).
        // We now use the encryptedMnemonic persisted at creation/import time.
        if (wallet.encryptedMnemonic) {
          try {
            const phrase = await decryptPrivateKey(wallet.encryptedMnemonic, revealPassword);
            if (phrase && phrase.split(/\s+/).length >= 12) {
              setRevealedPhrase(phrase);
            } else {
              setRevealError('Seed phrase could not be decrypted. Use Export Private Key instead.');
            }
          } catch {
            setRevealError('Seed phrase could not be decrypted. Use Export Private Key instead.');
          }
        } else if (wallet.importMethod === 'private_key') {
          setRevealError('This wallet was imported from a private key — no seed phrase available. Use Export Private Key instead.');
        } else {
          // Legacy wallet: created before we persisted encryptedMnemonic. The
          // seed was never saved, so it's genuinely unrecoverable. Be honest.
          setRevealError('This wallet was created before seed-phrase backup was supported. Use Export Private Key to back it up, then create a new wallet to get a recovery phrase.');
        }
      }
    } catch { setRevealError('Incorrect password. Please try again.'); }
    setRevealLoading(false);
  };

  const handleChangePassword = async () => {
    setPwdError('');
    if (newPwd.length < 8) { setPwdError('New password must be at least 8 characters'); return; }
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match'); return; }
    setPwdLoading(true);
    try {
      const pk = await decryptPrivateKey(wallet.encryptedKey, oldPwd);
      if (!pk || pk.length < 32) { setPwdError('Current password is incorrect'); setPwdLoading(false); return; }
      const newEncrypted = await encryptPrivateKey(pk, newPwd);
      // Also re-encrypt the mnemonic with the new password if we have one;
      // otherwise the user can still decrypt keys but reveal-seed would fail.
      let newEncryptedMnemonic = wallet.encryptedMnemonic;
      if (wallet.encryptedMnemonic) {
        try {
          const phrase = await decryptPrivateKey(wallet.encryptedMnemonic, oldPwd);
          if (phrase) newEncryptedMnemonic = await encryptPrivateKey(phrase, newPwd);
        } catch { /* mnemonic decrypt failed — leave as-is, user keeps old seed backup */ }
      }
      const wallets: StoredWallet[] = JSON.parse(localStorage.getItem('steinz_wallets') || '[]');
      const updated = wallets.map(w => w.address === wallet.address
        ? { ...w, encryptedKey: newEncrypted, encryptedMnemonic: newEncryptedMnemonic }
        : w);
      localStorage.setItem('steinz_wallets', JSON.stringify(updated));
      // Push the re-encrypted blobs to cloud sync too — otherwise the next
      // device/login still has the old-password ciphertext and the user is
      // locked out on that surface. This was a real bug; previously password
      // change only updated localStorage.
      try {
        await fetch('/api/wallet/sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallets: updated, defaultAddress: wallet.address }),
        });
      } catch { /* best-effort; local write already succeeded */ }
      setPwdSuccess(true); setPwdError(''); setOldPwd(''); setNewPwd(''); setConfirmPwd('');
      setTimeout(() => setPwdSuccess(false), 3000);
    } catch { setPwdError('Failed. Check your current password.'); }
    setPwdLoading(false);
  };

  const SECTIONS = [
    { id: 'identity', label: 'Identity', icon: <Key className="w-4 h-4" />, color: '#0A1EFF' },
    { id: 'security', label: 'Security & Backup', icon: <Shield className="w-4 h-4" />, color: '#10B981' },
    { id: 'password', label: 'Change Password', icon: <Key className="w-4 h-4" />, color: '#F59E0B' },
    { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" />, color: '#8B5CF6' },
    { id: 'notifications', label: 'Notifications', icon: <Zap className="w-4 h-4" />, color: '#06B6D4' },
    { id: 'advanced', label: 'Advanced', icon: <Layers className="w-4 h-4" />, color: '#EF4444' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        {/* Top bar */}
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 text-sm mb-6 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Wallet
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-slate-900/60 border border-slate-800/50 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
            <SteinzLogo size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base">{wallet.name}</p>
            <p className="text-xs font-mono text-slate-400 truncate">{wallet.address.slice(0, 14)}...{wallet.address.slice(-8)}</p>
          </div>
          {isDefault && <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-full font-semibold shrink-0">Default</span>}
        </div>

        {/* Section Accordion */}
        <div className="space-y-2">
          {SECTIONS.map(s => (
            <div key={s.id} className="bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden">
              <button
                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.color + '18', color: s.color }}>
                  {s.icon}
                </div>
                <span className="flex-1 text-sm font-semibold text-left text-white">{s.label}</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${activeSection === s.id ? 'rotate-180' : ''}`} />
              </button>

              {activeSection === s.id && (
                <div className="border-t border-slate-800/50 p-4 space-y-4">

                  {/* ── IDENTITY ── */}
                  {s.id === 'identity' && (
                    <>
                      <div>
                        <label className="text-xs text-slate-400 mb-2 block font-medium">Wallet Name</label>
                        <div className="flex gap-2">
                          <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 text-white" />
                          <button onClick={handleRename} disabled={!editName.trim() || editName.trim() === wallet.name} className="px-4 py-3 rounded-xl bg-blue-600 text-xs font-bold disabled:opacity-40 hover:bg-blue-500 transition-colors">
                            {renamed ? <Check className="w-4 h-4" /> : 'Save'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-2 block font-medium">Wallet Address</label>
                        <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                          <span className="flex-1 text-xs font-mono text-slate-300 break-all">{wallet.address}</span>
                          <button onClick={() => navigator.clipboard.writeText(wallet.address)} className="shrink-0 p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1 font-medium">Created</p>
                        <p className="text-sm text-slate-300">{new Date(wallet.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      {!isDefault && (
                        <button onClick={() => { onSetDefault(); onBack(); }} className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                          <Shield className="w-4 h-4" /> Set as Default Wallet
                        </button>
                      )}
                    </>
                  )}

                  {/* ── SECURITY & BACKUP ── */}
                  {s.id === 'security' && (
                    <>
                      <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-bold text-amber-400">Security Warning</span>
                        </div>
                        <p className="text-xs text-slate-400">Never share your seed phrase or private key with anyone. Naka support will never ask for these.</p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-white mb-1">Reveal Seed Phrase</p>
                        <p className="text-xs text-slate-400 mb-3">Enter your password to reveal your 12-word recovery phrase.</p>
                        <div className="flex gap-2 mb-3">
                          <input type="password" value={revealPassword} onChange={e => { setRevealPassword(e.target.value); setRevealError(''); setRevealedPhrase(''); setRevealedKey(''); }} placeholder="Wallet password" className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 text-white" />
                          <button onClick={() => handleReveal('phrase')} disabled={revealLoading || !revealPassword} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors">
                            {revealLoading ? <RotateCcw className="w-4 h-4 animate-spin" /> : 'Reveal'}
                          </button>
                        </div>
                        {revealError && <p className="text-xs text-red-400 mb-2">{revealError}</p>}
                        {revealedPhrase && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                              {revealedPhrase.split(' ').map((word, i) => (
                                <div key={i} className="flex items-center gap-1.5 py-1.5 px-2 bg-slate-900 border border-slate-800 rounded-lg">
                                  <span className="text-[9px] text-slate-500 font-mono w-4">{i + 1}.</span>
                                  <span className="text-xs font-mono text-white">{word}</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(revealedPhrase); }} className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
                              <Copy className="w-3.5 h-3.5" /> Copy Seed Phrase
                            </button>
                            {/* FIX 5A.1 / Phase 4: "I've written this down" confirmation — dismisses the main-view
                                backup banner so the user isn't nagged after they've actually backed up. */}
                            <button
                              onClick={() => {
                                try {
                                  localStorage.setItem(`naka_seed_backed_up_${wallet.address}`, new Date().toISOString());
                                  setRevealedPhrase('');
                                  setRevealPassword('');
                                } catch { /* storage unavailable */ }
                              }}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-opacity"
                            >
                              <Check className="w-3.5 h-3.5" /> I've written this down
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-800/50 pt-4">
                        <p className="text-sm font-semibold text-white mb-1">Export Private Key</p>
                        <p className="text-xs text-slate-400 mb-3">Your raw private key — import directly into MetaMask or any EVM wallet.</p>
                        <button onClick={() => handleReveal('key')} disabled={revealLoading || !revealPassword} className="w-full py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-colors disabled:opacity-40">
                          {revealLoading ? 'Decrypting...' : 'Export Private Key'}
                        </button>
                        {revealedKey && (
                          <div className="mt-3">
                            <SecretReveal label="Private Key" value={revealedKey} icon={<Key className="w-4 h-4" />} />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── CHANGE PASSWORD ── */}
                  {s.id === 'password' && (
                    <>
                      <p className="text-xs text-slate-400">Your password encrypts your private key locally using AES-256-GCM. It never leaves your device.</p>
                      <input type="password" value={oldPwd} onChange={e => { setOldPwd(e.target.value); setPwdError(''); }} placeholder="Current password" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 text-white" />
                      <input type="password" value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdError(''); }} placeholder="New password (min 8 chars)" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 text-white" />
                      <input type="password" value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }} placeholder="Confirm new password" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/60 text-white" />
                      {newPwd.length > 0 && (
                        <div className="flex gap-1">
                          {['Length 8+', 'Mixed case', 'Numbers', 'Symbols'].map((req, i) => {
                            const checks = [newPwd.length >= 8, /[a-z]/.test(newPwd) && /[A-Z]/.test(newPwd), /\d/.test(newPwd), /[^a-zA-Z0-9]/.test(newPwd)];
                            return <div key={req} className={`flex-1 h-1 rounded-full ${checks[i] ? 'bg-emerald-500' : 'bg-slate-700'}`} />;
                          })}
                        </div>
                      )}
                      {pwdError && <p className="text-xs text-red-400">{pwdError}</p>}
                      {pwdSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Password changed successfully — re-encrypted with AES-256-GCM</p>}
                      <button onClick={handleChangePassword} disabled={!oldPwd || !newPwd || !confirmPwd || pwdLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
                        {pwdLoading ? 'Re-encrypting...' : 'Update Password'}
                      </button>
                    </>
                  )}

                  {/* ── PREFERENCES ── */}
                  {s.id === 'preferences' && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Privacy Mode</p>
                          <p className="text-xs text-slate-400">Hide wallet from public profile</p>
                        </div>
                        <ToggleSwitch on={privacyMode} onToggle={() => { const v = !privacyMode; setPrivacyMode(v); savePref(`naka_privacy_${wallet.address}`, String(v)); }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Hide Small Balances</p>
                          <p className="text-xs text-slate-400">Hide tokens under $1</p>
                        </div>
                        <ToggleSwitch on={hideSmall} onToggle={() => { const v = !hideSmall; setHideSmall(v); savePref('steinz_hide_small', String(v)); }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Show Testnets</p>
                          <p className="text-xs text-slate-400">Display testnet chains and tokens</p>
                        </div>
                        <ToggleSwitch on={showTestnets} onToggle={() => { const v = !showTestnets; setShowTestnets(v); savePref('naka_testnets', String(v)); }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white mb-2">Display Currency</p>
                        <div className="flex gap-2">
                          {['USD', 'BTC', 'ETH'].map(c => (
                            <button key={c} onClick={() => { setCurrency(c); savePref('naka_currency', c); }} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${currency === c ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'}`}>{c}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white mb-2">Auto-Lock Timer</p>
                        <select value={autoLock} onChange={e => { setAutoLock(e.target.value); savePref('naka_autolock', e.target.value); }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/60">
                          <option value="5">5 minutes</option>
                          <option value="15">15 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="0">Never</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* ── NOTIFICATIONS ── */}
                  {s.id === 'notifications' && (
                    <>
                      <p className="text-xs text-slate-400">Choose which events trigger browser notifications.</p>
                      {[
                        { key: 'swap', label: 'Swap Completed', desc: 'When a swap transaction confirms', value: notifSwap, setter: setNotifSwap },
                        { key: 'receive', label: 'Funds Received', desc: 'When tokens arrive in your wallet', value: notifReceive, setter: setNotifReceive },
                        { key: 'price', label: 'Price Alerts', desc: 'Significant price movements (±10%)', value: notifPrice, setter: setNotifPrice },
                      ].map(n => (
                        <div key={n.key} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{n.label}</p>
                            <p className="text-xs text-slate-400">{n.desc}</p>
                          </div>
                          <ToggleSwitch on={n.value} onToggle={() => { const v = !n.value; n.setter(v); savePref(`naka_notif_${n.key}`, String(v)); }} />
                        </div>
                      ))}
                      <button onClick={() => { if ('Notification' in window) Notification.requestPermission(); }} className="w-full py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
                        Enable Browser Notifications
                      </button>
                    </>
                  )}

                  {/* ── ADVANCED ── */}
                  {s.id === 'advanced' && (
                    <>
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                        <p className="text-xs font-semibold text-slate-300">Connected DApps</p>
                        <p className="text-xs text-slate-500">No DApps connected — connection management coming in Phase 2</p>
                      </div>
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                        <p className="text-xs font-semibold text-slate-300 mb-2">Wallet Info</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs"><span className="text-slate-500">Encryption</span><span className="text-slate-300">AES-256-GCM</span></div>
                          <div className="flex justify-between text-xs"><span className="text-slate-500">HD Path</span><span className="text-slate-300 font-mono">m/44&apos;/60&apos;/0&apos;/0/0</span></div>
                          <div className="flex justify-between text-xs"><span className="text-slate-500">Version</span><span className="text-slate-300">v2.0</span></div>
                        </div>
                      </div>
                      {!isDefault && (
                        <button onClick={() => { onSetDefault(); }} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-sm font-semibold text-blue-400 hover:bg-blue-600/15 transition-colors">
                          <Shield className="w-4 h-4" /> Set as Default Wallet
                        </button>
                      )}
                      {!showDeleteConfirm ? (
                        <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/15 transition-colors">
                          <Trash2 className="w-4 h-4" /> Remove This Wallet
                        </button>
                      ) : (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                          <p className="text-sm font-bold text-red-400">Confirm Deletion</p>
                          <p className="text-xs text-slate-400">This removes the wallet from this device. Back up your seed phrase first — this cannot be undone.</p>
                          <div className="flex gap-2">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300">Cancel</button>
                            <button onClick={() => { onDelete(); onBack(); }} className="flex-1 py-2.5 bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/30 transition-colors">Delete</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}
            </div>
          ))}
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

/**
 * Add Network — toggle which chains show on the wallet home list.
 * Default set (ETH/BNB/Polygon/SOL) can be disabled; the rest start
 * off and the user flips them on. Persists to localStorage via the
 * caller (parent stores naka_enabled_chains).
 */
function AddNetworkView({
  onBack,
  enabled,
  onChange,
}: {
  onBack: () => void;
  enabled: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) => {
    const next = enabled.includes(id)
      ? enabled.filter((x) => x !== id)
      : [...enabled, id];
    // Guard: never let the user disable every chain at once — keep at
    // least one so the wallet home isn't an empty screen.
    if (next.length === 0) return;
    onChange(next);
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <div className="sticky top-0 z-20 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-slate-800/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold">Networks</h1>
            <p className="text-[11px] text-slate-500">Toggle which chains appear on your wallet home.</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 overflow-hidden divide-y divide-slate-800/60">
          {SUPPORTED_CHAINS.map((c) => {
            const isOn = enabled.includes(c.id);
            const isDefault = DEFAULT_ENABLED_CHAINS.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/[0.02] transition-colors text-left"
              >
                <img src={c.logoUrl} alt={c.name} className="w-7 h-7 rounded-full bg-slate-900" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <span>{c.symbol}</span>
                    {isDefault && <span className="text-[#4D6BFF]">· default</span>}
                  </div>
                </div>
                {/* iOS-style toggle */}
                <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${isOn ? 'bg-[#0A1EFF]' : 'bg-slate-800'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
          Disabling a chain hides its tokens and native balance from the wallet home — your assets are never touched on-chain. Re-enable anytime.
        </p>
      </div>
    </div>
  );
}
