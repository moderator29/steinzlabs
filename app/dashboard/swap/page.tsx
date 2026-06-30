'use client';

// Naka Labs brand icons — broad swap. ArrowDownUp, Zap stay on lucide (not yet in brand).
import { ChevronDown, Settings, Search, X, AlertTriangle, RefreshCw, ExternalLink, Info, Wallet, CheckCircle } from '@/components/icons/brand';
import { ArrowDownUp, Zap, Loader2 } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { notifySwapCompleted } from '@/lib/notifications';
import { getWalletSessionKey } from '@/lib/wallet/walletSession';
import { decryptPrivateKey } from '@/lib/wallet/encryption';
import { addressesEqual } from '@/lib/utils/addressNormalize';
import UnlockWalletModal from '@/components/wallet/UnlockWalletModal';
import { NakaLogo, WalletConnectLogo } from '@/components/wallet/WalletLogo';
import { WalletConnectHealthPanel } from '@/components/wallet/WalletConnectHealthPanel';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { SwapSecurityWarnings, shouldBlockSwap } from '@/components/swap/SwapSecurityWarnings';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { isMobile } from '@/lib/utils/detectDevice';
import { HAS_APPKIT } from '@/lib/wallet/appkit';
import { SecurityGate } from '@/components/security/SecurityGate';
import SwapRoutePreview from '@/components/swap/SwapRoutePreview';
import { RouteComparison } from '@/components/swap/RouteComparison';
import SwapDuneStrip from '@/components/trading/SwapDuneStrip';
import { OrderForm } from '@/components/trading/OrderForm';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { swapHowItWorks } from '@/lib/howItWorks/content/swap';

// §12 — Safari private mode and some locked-down enterprise browsers
// throw SecurityError on every localStorage read. The swap signing path
// reads `steinz_wallets` and `steinz_active_wallet_address` during the
// transaction-build step, so an unguarded throw there killed the swap
// flow with no usable error. These helpers are local because they have
// one consumer (this page) and the wider userScopedStorage layer doesn't
// expose a parse helper. Catches Error explicitly — not a wildcard —
// because we want logging for unexpected failure modes (e.g. parse).
function safeLocalGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn(`[swap] localStorage.getItem(${key}) failed:`, err);
    return null;
  }
}

function safeLocalParse<T>(key: string, fallback: T): T {
  const raw = safeLocalGet(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[swap] JSON.parse of localStorage ${key} failed:`, err);
    return fallback;
  }
}

function safeLocalSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[swap] localStorage.setItem(${key}) failed:`, err);
  }
}

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', symbol: 'ETH', color: '#627EEA', dex: 'Uniswap V3' },
  { id: 'base', label: 'Base', symbol: 'ETH', color: '#0052FF', dex: 'Aerodrome' },
  { id: 'solana', label: 'Solana', symbol: 'SOL', color: '#9945FF', dex: 'Raydium' },
  { id: 'bsc', label: 'BSC', symbol: 'BNB', color: '#F0B90B', dex: 'PancakeSwap' },
  { id: 'polygon', label: 'Polygon', symbol: 'MATIC', color: '#8247E5', dex: 'QuickSwap' },
  { id: 'avalanche', label: 'AVAX', symbol: 'AVAX', color: '#E84142', dex: 'TraderJoe' },
  { id: 'arbitrum', label: 'Arbitrum', symbol: 'ETH', color: '#28A0F0', dex: 'Camelot' },
];

interface TokenInfo {
  symbol: string;
  name: string;
  color: string;
  decimals: number;
  popular?: boolean;
  logo?: string;
  coingeckoId?: string;
}

const TOKEN_LIST: TokenInfo[] = [
  { symbol: 'ETH', name: 'Ethereum', color: '#627EEA', decimals: 18, popular: true, coingeckoId: 'ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { symbol: 'SOL', name: 'Solana', color: '#9945FF', decimals: 9, popular: true, coingeckoId: 'solana', logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { symbol: 'USDC', name: 'USD Coin', color: '#2775CA', decimals: 6, popular: true, coingeckoId: 'usd-coin', logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
  { symbol: 'USDT', name: 'Tether', color: '#26A17B', decimals: 6, popular: true, coingeckoId: 'tether', logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
  { symbol: 'BNB', name: 'BNB', color: '#F0B90B', decimals: 18, popular: true, coingeckoId: 'binancecoin', logo: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  { symbol: 'MATIC', name: 'Polygon', color: '#8247E5', decimals: 18, coingeckoId: 'matic-network', logo: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png' },
  { symbol: 'AVAX', name: 'Avalanche', color: '#E84142', decimals: 18, coingeckoId: 'avalanche-2', logo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', color: '#F7931A', decimals: 8, popular: true, coingeckoId: 'wrapped-bitcoin', logo: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
  { symbol: 'LINK', name: 'Chainlink', color: '#2A5ADA', decimals: 18, coingeckoId: 'chainlink', logo: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
  { symbol: 'UNI', name: 'Uniswap', color: '#FF007A', decimals: 18, coingeckoId: 'uniswap', logo: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png' },
  { symbol: 'ARB', name: 'Arbitrum', color: '#28A0F0', decimals: 18, coingeckoId: 'arbitrum', logo: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg' },
  { symbol: 'OP', name: 'Optimism', color: '#FF0420', decimals: 18, coingeckoId: 'optimism', logo: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png' },
  { symbol: 'AAVE', name: 'Aave', color: '#B6509E', decimals: 18, coingeckoId: 'aave', logo: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png' },
  { symbol: 'DAI', name: 'Dai', color: '#F5AC37', decimals: 18, coingeckoId: 'dai', logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png' },
  { symbol: 'CRV', name: 'Curve', color: '#F4E532', decimals: 18, coingeckoId: 'curve-dao-token', logo: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png' },
  { symbol: 'MKR', name: 'Maker', color: '#1AAB9B', decimals: 18, coingeckoId: 'maker', logo: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png' },
  { symbol: 'PEPE', name: 'Pepe', color: '#479C47', decimals: 18, coingeckoId: 'pepe', logo: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg' },
  { symbol: 'WIF', name: 'dogwifhat', color: '#B7844F', decimals: 6, coingeckoId: 'dogwifcoin', logo: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg' },
  { symbol: 'BONK', name: 'Bonk', color: '#F2A900', decimals: 5, coingeckoId: 'bonk', logo: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg' },
  { symbol: 'JUP', name: 'Jupiter', color: '#52D5B7', decimals: 6, coingeckoId: 'jupiter-exchange-solana', logo: 'https://assets.coingecko.com/coins/images/34188/small/jup.png' },
  { symbol: 'RAY', name: 'Raydium', color: '#4F67E4', decimals: 6, coingeckoId: 'raydium', logo: 'https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg' },
  { symbol: 'NAKA', name: 'Nakamoto Games', color: '#00D4AA', decimals: 18, coingeckoId: 'nakamoto-games', logo: 'https://assets.coingecko.com/coins/images/18041/small/naka.png' },
  { symbol: 'DOGE', name: 'Dogecoin', color: '#C2A633', decimals: 8, popular: true, coingeckoId: 'dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
  { symbol: 'SHIB', name: 'Shiba Inu', color: '#FFA409', decimals: 18, coingeckoId: 'shiba-inu', logo: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png' },
  { symbol: 'XRP', name: 'XRP', color: '#346AA9', decimals: 6, coingeckoId: 'ripple', logo: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  { symbol: 'ADA', name: 'Cardano', color: '#0033AD', decimals: 6, coingeckoId: 'cardano', logo: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
];

// Runtime registry of user-imported tokens (pasted contract addresses),
// keyed by uppercase symbol. Stores the on-chain address + decimals per chain
// so the quote/execution path resolves the real token, not a guess.
interface ImportedToken extends TokenInfo { address: string; chain: string; }
const IMPORTED_TOKENS: Record<string, ImportedToken> = {};

function registerImportedToken(t: ImportedToken): void {
  IMPORTED_TOKENS[t.symbol.toUpperCase()] = t;
}

function getTokenInfo(symbol: string): TokenInfo {
  return (
    TOKEN_LIST.find(t => t.symbol === symbol) ||
    IMPORTED_TOKENS[(symbol || '').toUpperCase()] ||
    { symbol, name: symbol, color: '#6B7280', decimals: 18 }
  );
}

const NATIVE_TOKEN_0X = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  USDC: { ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  USDT: { ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7', bsc: '0x55d398326f99059fF775485246999027B3197955', arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
  WBTC: { ethereum: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', arbitrum: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f' },
  LINK: { ethereum: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
  UNI: { ethereum: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
  AAVE: { ethereum: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
  DAI: { ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
};

function getTokenAddresses(sellSymbol: string, buySymbol: string, chainId: string): { sellToken: string; buyToken: string } {
  const nativeTokens = ['ETH', 'MATIC', 'BNB', 'AVAX', 'SOL'];
  const resolve = (sym: string): string => {
    if (nativeTokens.includes(sym)) return NATIVE_TOKEN_0X;
    // User-imported token (pasted address) takes precedence on its chain.
    const imp = IMPORTED_TOKENS[(sym || '').toUpperCase()];
    if (imp && imp.chain === chainId) return imp.address;
    return TOKEN_ADDRESSES[sym]?.[chainId] || sym;
  };
  return { sellToken: resolve(sellSymbol), buyToken: resolve(buySymbol) };
}

function TokenBadge({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const token = getTokenInfo(symbol);
  const [imgError, setImgError] = useState(false);

  if (token.logo && !imgError) {
    return (
      <img
        src={token.logo}
        alt={symbol}
        className="rounded-full"
        style={{ width: size, height: size, minWidth: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shadow-lg"
      style={{ width: size, height: size, minWidth: size, background: `linear-gradient(135deg, ${token.color}, ${token.color}99)`, fontSize: size * 0.36 }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

function TokenSelectModal({ isOpen, onClose, onSelect, exclude, chain }: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
  exclude: string;
  chain: string;
}) {
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportedToken | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
      setImported(null);
      setImportError(null);
    }
  }, [isOpen]);

  // When the query is a contract address not already in the list, resolve its
  // real metadata (symbol/name/decimals/logo) so the user can import + swap it.
  const isEvmAddr = /^0x[a-fA-F0-9]{40}$/.test(search.trim());
  const isSolAddr = chain.toLowerCase() === 'solana' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(search.trim());
  const looksLikeAddress = isEvmAddr || isSolAddr;

  useEffect(() => {
    if (!looksLikeAddress) { setImported(null); setImportError(null); return; }
    const addr = search.trim();
    if (TOKEN_LIST.some(t => t.symbol.toLowerCase() === addr.toLowerCase())) return;
    let cancelled = false;
    setImporting(true); setImportError(null); setImported(null);
    (async () => {
      try {
        const res = await fetch(`/api/swap/token-meta?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(addr)}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && typeof data.decimals === 'number') {
          setImported({ symbol: data.symbol, name: data.name, decimals: data.decimals, logo: data.logo ?? undefined, color: '#6B7280', address: data.address, chain: data.chain ?? chain });
        } else {
          setImportError('Token not found on this chain');
        }
      } catch {
        if (!cancelled) setImportError('Could not resolve token');
      } finally {
        if (!cancelled) setImporting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, chain, looksLikeAddress]);

  if (!isOpen) return null;

  const filtered = TOKEN_LIST.filter(t =>
    t.symbol !== exclude &&
    (t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  const popular = filtered.filter(t => t.popular);

  const chooseImported = () => {
    if (!imported) return;
    registerImportedToken(imported);
    onSelect(imported.symbol);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-[420px] nl-glass rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h3 className="font-bold text-sm text-white">Select a token</h3>
          <button onClick={onClose} aria-label="Close token picker" className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-400" aria-hidden="true" /></button>
        </div>

        <div className="p-4 space-y-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 bg-[#060A12] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0066FF]/40 transition-colors">
            <Search className="w-4 h-4 text-gray-600" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or paste address"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600 text-white"
            />
          </div>

          {!search && popular.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {popular.map(t => (
                <button
                  key={t.symbol}
                  onClick={() => { onSelect(t.symbol); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#060A12] border border-white/[0.06] rounded-full hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 transition-all"
                >
                  <TokenBadge symbol={t.symbol} size={18} />
                  <span className="text-xs font-semibold text-white">{t.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {looksLikeAddress && (
            <div className="px-2 pb-1">
              {importing && <p className="text-center text-xs text-gray-500 py-4">Resolving token…</p>}
              {importError && <p className="text-center text-xs text-amber-400 py-4">{importError}</p>}
              {imported && (
                <button
                  onClick={chooseImported}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] border border-[#0066FF]/30 transition-colors"
                >
                  {imported.logo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={imported.logo} alt="" className="w-9 h-9 rounded-full object-cover" />
                    : <div className="w-9 h-9 rounded-full bg-[#0066FF]/20 flex items-center justify-center text-xs font-bold text-white">{imported.symbol.slice(0, 2)}</div>}
                  <div className="text-start flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                      {imported.symbol}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 uppercase">Unverified</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{imported.name}</div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0066FF]">Import</span>
                </button>
              )}
            </div>
          )}
          {filtered.length === 0 && !looksLikeAddress ? (
            <p className="text-center text-sm text-gray-500 py-10">No tokens found</p>
          ) : (
            filtered.map(t => (
              <button
                key={t.symbol}
                onClick={() => { onSelect(t.symbol); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <TokenBadge symbol={t.symbol} size={36} />
                <div className="text-start flex-1">
                  <div className="text-sm font-semibold text-white">{t.symbol}</div>
                  <div className="text-xs text-gray-500">{t.name}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ slippage, setSlippage, mevProtect, setMevProtect, mevAutoForLarge, isOpen, onClose }: {
  slippage: string;
  setSlippage: (s: string) => void;
  mevProtect: boolean;
  setMevProtect: (v: boolean) => void;
  mevAutoForLarge: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [customSlippage, setCustomSlippage] = useState('');

  if (!isOpen) return null;

  return (
    <div className="nl-glass rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-white">Transaction Settings</span>
        </div>
        <button onClick={onClose} aria-label="Close transaction settings" className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" /></button>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-400 font-medium">Slippage Tolerance</span>
          <Info className="w-3 h-3 text-gray-600" />
        </div>
        <div className="flex gap-2">
          {['0.1', '0.5', '1.0', '3.0'].map(s => (
            <button
              key={s}
              onClick={() => { setSlippage(s); setCustomSlippage(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                slippage === s && !customSlippage
                  ? 'nl-button'
                  : 'nl-button--ghost'
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={customSlippage}
          onChange={(e) => {
            setCustomSlippage(e.target.value);
            if (e.target.value) setSlippage(e.target.value);
          }}
          placeholder="Custom"
          className="flex-1 bg-[#060A12] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40 transition-colors text-white placeholder-gray-600"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
      {parseFloat(slippage) > 5 && (
        <div className="flex items-center gap-2 bg-[#F59E0B]/10 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span className="text-xs text-[#F59E0B]">High slippage may result in unfavorable trades</span>
        </div>
      )}

      {/* §MEV-toggle — server-side support exists (Flashbots Protect on
          ETH, BloxRoute on BSC, Jito bundles on Solana). The UI never
          had a switch; only localStorage on the inline form. Surface it
          in the swap-page Settings so users can opt into private-mempool
          routing for high-value trades. Auto-on for trades ≥ $1K (see
          page-level useEffect that sets mevProtect from fromAmount). */}
      <div className="pt-2 border-t border-white/[0.04]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">MEV Protection</span>
            <Info className="w-3 h-3 text-gray-600" />
          </div>
          <button
            type="button"
            onClick={() => setMevProtect(!mevProtect)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              mevProtect ? 'bg-[#0066FF]' : 'bg-slate-700'
            }`}
            aria-pressed={mevProtect}
            aria-label="Toggle MEV protection"
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                mevProtect ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Routes via private mempool (Flashbots / Jito) to block sandwich bots.
          {mevAutoForLarge && ' Auto-enabled for trades ≥ $1,000.'}
        </p>
      </div>
    </div>
  );
}

type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export default function SwapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address: walletAddress } = useWallet();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [slippage, setSlippage] = useState('0.5');
  const [chain, setChain] = useState('ethereum');
  const [showSettings, setShowSettings] = useState(false);
  const [showTokenSelect, setShowTokenSelect] = useState<'from' | 'to' | null>(null);
  // §multi-aggregator — /api/swap/routes already fans out to 1inch +
  // KyberSwap + OpenOcean in parallel and returns them sorted by
  // netOutputUsd. The selected provider drives the eventual execution
  // path (UI hint today; execution wiring lands next sprint).
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  // §swap-1: capture full route quote (raw blob included) so execute path
  // can submit the provider-specific tx without re-quoting.
  const [selectedRoute, setSelectedRoute] = useState<import('@/lib/services/swap-aggregator').RouteQuote | null>(null);
  // §MEV-protect — Solana defaults ON (Jito is industry standard, no
  // friction). EVM defaults OFF but auto-flips ON whenever the trade
  // size estimates ≥ $1K (mevAutoForLarge logic below). User can still
  // toggle manually via SettingsPanel.
  const [mevProtect, setMevProtect] = useState<boolean>(false);
  const [sandwichRisk, setSandwichRisk] = useState<number | null>(null);
  // §advanced-orders — Limit / DCA / Stop-loss orderform is purpose-built
  // at components/trading/OrderForm.tsx (4 tabs). Collapsed by default
  // so the market-swap UX stays the lead surface.
  const [showAdvancedOrders, setShowAdvancedOrders] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [showReview, setShowReview] = useState(false);
  // Industry-standard pre-confirm security gating — when the review
  // modal opens we fire GoPlus on the destination token and read back a
  // structured safety summary. Block on honeypot / tax >= 30% /
  // pausable / blacklist; warn on tax 10-30% / cannot-sell-all /
  // slippage outside the 0.1-10% safe band. Mirrors Trojan/Maestro.
  const [tokenSecurity, setTokenSecurity] = useState<null | {
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    safetyLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
    cannotSellAll?: boolean;
    transferPausable?: boolean;
    isBlacklisted?: boolean;
  }>(null);
  const [tokenSecurityLoading, setTokenSecurityLoading] = useState(false);
  // Audit B4 / P1 #8 — Naka built-in wallet unlock. setWalletSessionKey
  // was previously orphaned (defined but never invoked anywhere), so
  // every Naka-wallet swap reached the signing path with no cached
  // password and threw "Wallet session expired." The modal below is
  // the missing UI that actually unlocks the session.
  const [unlockState, setUnlockState] = useState<null | { encryptedKey: string; addressShort?: string }>(null);
  const pendingPostUnlock = useRef<(() => void) | null>(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [swapRotate, setSwapRotate] = useState(0);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [swapError, setSwapError] = useState('');
  const [walletBalance, setWalletBalance] = useState<Record<string, number>>({});
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [detectedWallet, setDetectedWallet] = useState<'solana' | 'ethereum' | 'builtin' | null>(null);
  const [walletMode, setWalletMode] = useState<'naka' | 'metamask' | 'phantom'>(() => {
    const stored = safeLocalGet('swap_wallet_mode');
    return stored === 'metamask' || stored === 'phantom' || stored === 'naka' ? stored : 'naka';
  });

  // §10 — Reown AppKit hooks. `open()` triggers the wallet picker
  // modal (extension + WalletConnect QR + mobile deep-links). The
  // useAppKitAccount hook fires when the user finishes connecting via
  // any AppKit-mediated wallet; we mirror that into the existing
  // metamask/phantom address state below so the rest of the swap
  // page continues to work without further refactor.
  const { open: openAppKitModal } = useAppKit();
  const { address: appKitAddress, isConnected: appKitConnected, caipAddress } = useAppKitAccount();
  const onMobileDevice = typeof window !== 'undefined' ? isMobile() : false;
  const [metamaskAddress, setMetamaskAddress] = useState('');
  const [phantomAddress, setPhantomAddress] = useState('');
  const quoteTimeout = useRef<NodeJS.Timeout | null>(null);

  const nakaAddress = walletAddress || safeLocalGet('steinz_active_wallet_address');
  const connectedAddress = walletMode === 'metamask' ? metamaskAddress : walletMode === 'phantom' ? phantomAddress : nakaAddress;

  // Detect wallet provider and fetch native balance
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detectAndFetch = async () => {
      const win = window;
      if (win.solana?.isPhantom || (win.solana as { isConnected?: boolean } | undefined)?.isConnected) {
        setDetectedWallet('solana');
        try {
          const resp = await win.solana!.connect();
          const pubkey = resp.publicKey?.toString();
          if (pubkey) {
            const res = await fetch(`/api/wallet-intelligence?address=${pubkey}&chain=solana`);
            if (res.ok) {
              const data = await res.json();
              const balances: Record<string, number> = {};
              (data.holdings || []).forEach((h: any) => { balances[h.symbol?.toUpperCase()] = parseFloat(h.balance) || 0; });
              setWalletBalance(prev => ({ ...prev, ...balances }));
            }
          }
        } catch (err) {
          console.error('[swap] Fetch Solana wallet balance failed:', err);
        }
      } else if (win.ethereum) {
        setDetectedWallet('ethereum');
        try {
          const accounts = await win.ethereum.request({ method: 'eth_accounts' }) as string[];
          if (accounts.length > 0) {
            const hexBal = await win.ethereum.request({ method: 'eth_getBalance', params: [accounts[0], 'latest'] }) as string;
            const ethBal = parseInt(hexBal, 16) / 1e18;
            setWalletBalance(prev => ({ ...prev, ETH: ethBal }));
          }
        } catch { /* Provider rejected — silently ignore */ }
      } else if (safeLocalGet('steinz_active_wallet_address')) {
        setDetectedWallet('builtin');
      }
    };
    detectAndFetch();
  }, []);

  useEffect(() => {
    if (!connectedAddress) return;
    const fetchBalance = async () => {
      try {
        const res = await fetch(`/api/wallet-intelligence?address=${connectedAddress}`);
        if (res.ok) {
          const data = await res.json();
          const balances: Record<string, number> = {};
          if (data.holdings) {
            data.holdings.forEach((h: any) => {
              balances[h.symbol?.toUpperCase()] = parseFloat(h.balance) || 0;
            });
          }
          if (data.totalBalanceUsd) {
            balances['_totalUsd'] = data.totalBalanceUsd;
          }
          setWalletBalance(prev => ({ ...prev, ...balances }));
        }
      } catch (err) {
        console.error('[swap] Fetch connected wallet balance failed:', err);
      }
    };
    fetchBalance();
  }, [connectedAddress]);

  useEffect(() => {
    const symbol = searchParams.get('symbol');
    const buyToken = searchParams.get('buyToken');
    const sellToken = searchParams.get('sellToken');
    const chainParam = searchParams.get('chain');
    const effectiveChain = chainParam || chain;
    const isEvmAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

    if (chainParam) {
      setChain(chainParam);
      const c = CHAINS.find(ch => ch.id === chainParam);
      if (c && !sellToken) setFromToken(c.symbol);
    }

    // Resolve an address-shaped deep-link param into a real imported token
    // (the sniper drawer links by contract address). Uppercasing an address —
    // as the old code did — produced an unresolvable symbol and broke quotes.
    const resolveParam = async (raw: string, set: (sym: string) => void) => {
      if (isEvmAddress(raw)) {
        try {
          const res = await fetch(`/api/swap/token-meta?chain=${encodeURIComponent(effectiveChain)}&address=${encodeURIComponent(raw)}`);
          const data = await res.json();
          if (res.ok && typeof data.decimals === 'number') {
            registerImportedToken({ symbol: data.symbol, name: data.name, decimals: data.decimals, logo: data.logo ?? undefined, color: '#6B7280', address: data.address, chain: effectiveChain });
            set(data.symbol.toUpperCase());
            return;
          }
        } catch { /* fall through to raw */ }
      }
      set(raw.toUpperCase());
    };

    if (sellToken) {
      if (sellToken.toUpperCase() === 'NATIVE') {
        const c = CHAINS.find(ch => ch.id === effectiveChain);
        if (c) setFromToken(c.symbol);
      } else {
        void resolveParam(sellToken, setFromToken);
      }
    }
    if (buyToken) {
      void resolveParam(buyToken, setToToken);
    } else if (symbol) {
      setToToken(symbol.toUpperCase());
    }
  }, [searchParams, chain]);

  const [walletConnectError, setWalletConnectError] = useState('');

  // Only the built-in Naka Wallet is a directly-selectable mode now —
  // external wallets (MetaMask, Phantom, etc.) connect exclusively through
  // the WalletConnect / AppKit modal, whose connected account is mirrored
  // into metamask/phantom state by the effect below.
  const handleSelectNakaWallet = () => {
    setWalletConnectError('');
    safeLocalSet('swap_wallet_mode', 'naka');
    setWalletMode('naka');
    setDetectedWallet('builtin');
  };

  // §10 — When AppKit connects a wallet (via WalletConnect QR or mobile
  // deep-link), mirror the address into the existing per-wallet state so
  // the rest of the swap page (quote fetcher, balance loader, sign flow)
  // continues to use its own state machine. CAIP namespace tells us
  // whether to treat it as EVM (metamask slot) or Solana (phantom slot).
  //
  // Audit fixes:
  //  - explicit eip155 / solana matching (was: else => metamask, which
  //    silently mishandled cosmos / polkadot / tron / etc. addresses);
  //  - track whether the source of the most recent connect was AppKit,
  //    so the disconnect effect below can roll back the mirrored
  //    addresses without stomping on a fresh direct-extension connect.
  const lastAppKitMirror = useRef<{ address: string; ns: 'eip155' | 'solana' } | null>(null);
  useEffect(() => {
    if (!HAS_APPKIT) return;
    if (!appKitConnected || !appKitAddress) return;
    const ns = caipAddress?.split(':')[0];
    if (ns === 'solana') {
      setPhantomAddress(appKitAddress);
      setDetectedWallet('solana');
      if (walletMode !== 'phantom') {
        setWalletMode('phantom');
        safeLocalSet('swap_wallet_mode', 'phantom');
        setChain('solana');
      }
      lastAppKitMirror.current = { address: appKitAddress, ns: 'solana' };
    } else if (ns === 'eip155') {
      setMetamaskAddress(appKitAddress);
      setDetectedWallet('ethereum');
      if (walletMode !== 'metamask') {
        setWalletMode('metamask');
        safeLocalSet('swap_wallet_mode', 'metamask');
      }
      lastAppKitMirror.current = { address: appKitAddress, ns: 'eip155' };
    } else {
      // Unknown CAIP namespace (cosmos / polkadot / tron / etc.). Don't
      // pretend it's MetaMask — that would route signing through an
      // EVM-only sign path on a non-EVM address. Just log; the user
      // can still see the connected state in the AppKit modal itself.
      console.warn('[swap] AppKit connected with unsupported CAIP namespace:', ns, caipAddress);
    }
  }, [appKitAddress, appKitConnected, caipAddress, walletMode]);

  // §10 audit — when AppKit disconnects, roll back the mirrored
  // address state so the swap page doesn't keep showing a stale
  // connected wallet. Only clears the slot we mirrored (eip155 vs
  // solana) so a fresh direct-extension connect is preserved.
  useEffect(() => {
    if (!HAS_APPKIT) return;
    if (appKitConnected) return;
    const last = lastAppKitMirror.current;
    if (!last) return;
    if (last.ns === 'solana') {
      setPhantomAddress('');
    } else {
      setMetamaskAddress('');
    }
    lastAppKitMirror.current = null;
  }, [appKitConnected]);

  // Check if external wallets are already connected on mount + subscribe to events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window;

    // MetaMask: check existing connection
    if (win.ethereum) {
      void (win.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>).then(accs => {
        if (accs[0]) { setMetamaskAddress(accs[0]); }
      }).catch(() => {});

      // Listen for account changes
      const onAccChange = (accs: unknown) => {
        const accounts = accs as string[];
        if (accounts[0]) { setMetamaskAddress(accounts[0]); }
        else { setMetamaskAddress(''); if (walletMode === 'metamask') setWalletMode('naka'); }
      };
      const onChainChange = (chainId: unknown) => {
        const chainIdNum = parseInt(chainId as string, 16);
        const chainMap: Record<number, string> = { 1: 'ethereum', 8453: 'base', 137: 'polygon', 42161: 'arbitrum', 56: 'bsc', 43114: 'avalanche', 10: 'optimism' };
        if (chainMap[chainIdNum] && walletMode === 'metamask') setChain(chainMap[chainIdNum]);
      };
      (win.ethereum as unknown as { on: (ev: string, fn: (v: unknown) => void) => void }).on('accountsChanged', onAccChange);
      (win.ethereum as unknown as { on: (ev: string, fn: (v: unknown) => void) => void }).on('chainChanged', onChainChange);
    }

    // Phantom: check if already connected (eager connection)
    if (win.solana?.isPhantom) {
      try {
        const pk = (win.solana as { publicKey?: { toString(): string } }).publicKey?.toString();
        if (pk) { setPhantomAddress(pk); }
      } catch { /* not connected */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChain = CHAINS.find(c => c.id === chain) || CHAINS[0];
  const [gaslessEnabled, setGaslessEnabled] = useState(true);
  const isGaslessAvailable = chain !== 'solana' && !['ETH', 'MATIC', 'BNB', 'AVAX'].includes(fromToken);
  const [quoteData, setQuoteData] = useState<any>(null);
  // Audit P0 #3 — quote auto-refresh. Each successful price fetch records
  // a timestamp; an interval below refreshes the quote every QUOTE_TTL_MS
  // and a 1s tick drives the countdown UI in the review modal so the user
  // can see how fresh the rate they're about to sign actually is.
  // Industry parity: Uniswap / Jupiter both refresh every 12-15s; 1inch
  // shows an explicit "expires in Xs" badge.
  const QUOTE_TTL_MS = 15_000;
  const [quoteFetchedAt, setQuoteFetchedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const simulateQuote = useCallback((amount: string, from?: string, to?: string, ch?: string) => {
    const f = from || fromToken;
    const t = to || toToken;
    const c = ch || chain;
    if (!amount || parseFloat(amount) <= 0) {
      setToAmount('');
      setQuoteData(null);
      return;
    }
    setFetchingQuote(true);
    if (quoteTimeout.current) clearTimeout(quoteTimeout.current);
    quoteTimeout.current = setTimeout(async () => {
      try {
        const tokenAddresses = getTokenAddresses(f, t, c);
        const decimals = getTokenInfo(f).decimals;
        const rawAmount = BigInt(Math.round(parseFloat(amount) * (10 ** decimals))).toString();
        const params = new URLSearchParams({
          chain: c,
          sellToken: tokenAddresses.sellToken,
          buyToken: tokenAddresses.buyToken,
          sellAmount: rawAmount,
          // decimals hints so the server can resolve imported/arbitrary tokens
          // (its symbol table only covers the curated set).
          fromDecimals: String(getTokenInfo(f).decimals),
          toDecimals: String(getTokenInfo(t).decimals),
        });
        if (connectedAddress) params.set('taker', connectedAddress);
        const res = await fetch(`/api/swap/price?${params}`);
        const data = await res.json();
        if (res.ok && data.buyAmount) {
          const buyDecimals = getTokenInfo(t).decimals;
          const toAmt = Number(BigInt(data.buyAmount)) / (10 ** buyDecimals);
          setToAmount(toAmt.toFixed(6));
          setQuoteData({
            ...data,
            toAmount: toAmt,
            fromAmountUsd: null,
            toAmountUsd: null,
            priceImpact: data.estimatedPriceImpact || '0.01',
            gasEstimateUsd: data.gas ? Number(data.gas) * 30 / 1e9 : 2.4,
            minReceived: (toAmt * (1 - parseFloat(slippage) / 100)).toFixed(6),
          });
          // Mark this quote as fresh so the countdown UI + auto-refresh
          // loop below have a definitive anchor timestamp.
          setQuoteFetchedAt(Date.now());
        }
      } catch (err) {
        console.error('[Swap] Price fetch failed:', err);
      }
      setFetchingQuote(false);
    }, 400);
  }, [fromToken, toToken, chain, slippage, connectedAddress]);

  const handleFromAmountChange = (val: string) => {
    setFromAmount(val);
    simulateQuote(val);
  };

  // Audit P0 #3 — auto-refresh stale quotes. Runs only while the review
  // modal is open (quote-staleness only matters at the moment the user is
  // about to sign). 1-second tick drives the countdown, and we
  // re-simulate the quote whenever it crosses QUOTE_TTL_MS.
  useEffect(() => {
    if (!showReview) return;
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [showReview]);

  // Industry-standard pre-sign security probe — fire GoPlus the moment
  // the review modal opens. Fall back to null (no panel shown) on any
  // error so a security-service outage never blocks a legitimate swap.
  useEffect(() => {
    if (!showReview) return;
    let cancelled = false;
    setTokenSecurity(null);
    setTokenSecurityLoading(true);
    (async () => {
      try {
        const { buyToken } = getTokenAddresses(fromToken, toToken, chain);
        if (!buyToken || buyToken.toLowerCase() === 'native' || /^[a-z]{2,6}$/i.test(buyToken)) {
          return;
        }
        const res = await fetch('/api/security/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scan_type: 'token', target: buyToken, chain }),
        });
        if (!res.ok) return;
        const body = await res.json();
        const raw = (body?.raw ?? body) as Record<string, unknown> | null;
        if (!raw || cancelled) return;
        const safety = (raw as { safetyLevel?: string }).safetyLevel;
        setTokenSecurity({
          isHoneypot: !!(raw as { isHoneypot?: boolean }).isHoneypot,
          buyTax: typeof (raw as { buyTax?: number }).buyTax === 'number' ? (raw as { buyTax: number }).buyTax : 0,
          sellTax: typeof (raw as { sellTax?: number }).sellTax === 'number' ? (raw as { sellTax: number }).sellTax : 0,
          safetyLevel: (safety === 'SAFE' || safety === 'CAUTION' || safety === 'WARNING' || safety === 'DANGER') ? safety : 'CAUTION',
          cannotSellAll: !!(raw as { cannotSellAll?: boolean }).cannotSellAll,
          transferPausable: !!(raw as { transferPausable?: boolean }).transferPausable,
          isBlacklisted: !!(raw as { isBlacklisted?: boolean }).isBlacklisted,
        });
      } catch {
        /* security service unavailable — leave panel hidden, never block on outage */
      } finally {
        if (!cancelled) setTokenSecurityLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showReview, fromToken, toToken, chain]);

  useEffect(() => {
    if (!showReview) return;
    if (!quoteFetchedAt) return;
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    const age = Date.now() - quoteFetchedAt;
    if (age < QUOTE_TTL_MS) return;
    // Quote expired — refetch with the same input. setFetchingQuote
    // already toggles the spinner inside simulateQuote so the user sees
    // the rate refresh in-place rather than the modal flickering.
    simulateQuote(fromAmount);
  }, [showReview, quoteFetchedAt, nowTick, fromAmount, simulateQuote]);

  const handleSwapTokens = () => {
    setSwapRotate(prev => prev + 180);
    const tmpToken = fromToken;
    const tmpAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tmpToken);
    setFromAmount(toAmount);
    simulateQuote(toAmount, toToken, tmpToken);
  };

  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    setSwapError('');
    setSwapSuccess(false);
    setTxHash('');
    setTxStatus('idle');

    if (!connectedAddress) {
      setSwapError('No wallet connected. Create or import a wallet first.');
      return;
    }

    const balance = walletBalance[fromToken];
    if (balance !== undefined && parseFloat(fromAmount) > balance) {
      setSwapError(`Insufficient ${fromToken} balance. You have ${balance.toFixed(6)} ${fromToken}.`);
      return;
    }

    setSwapping(true);
    setTxStatus('pending');
    try {
      if (!connectedAddress) throw new Error('Please connect a wallet to execute swaps.');

      // §swap-1: Honor the route the user picked in RouteComparison.
      // When they selected a non-0x aggregator (1inch / KyberSwap /
      // OpenOcean), submit through /api/market/trade/execute which
      // already knows how to settle the provider-specific quoteData.
      // 0x stays on the original /api/swap/quote → wallet-sign path.
      if (selectedProvider && selectedProvider !== '0x' && selectedRoute) {
        const executeRes = await fetch('/api/market/trade/execute', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            selectedProvider,
            routeQuoteData: selectedRoute,
            taker: connectedAddress,
            chain,
            fromToken,
            toToken,
            mevProtect, // §swap-2 — server uses this to route to private mempool when set
          }),
        });
        const out = await executeRes.json();
        if (!executeRes.ok) throw new Error(out.error || `${selectedProvider} swap failed`);
        if (out.txHash) {
          setTxHash(out.txHash);
          setTxStatus('confirmed');
          setSwapSuccess(true);
        }
        return;
      }

      // Step 1: Get firm swap quote from 0x API
      const tokenAddresses = getTokenAddresses(fromToken, toToken, chain);
      const decimals = getTokenInfo(fromToken).decimals;
      const rawAmount = BigInt(Math.round(parseFloat(fromAmount) * (10 ** decimals))).toString();
      // Carry the user's slippage tolerance through to the quote so it
      // actually applies on-chain. `slippage` is a percent string (e.g.
      // "0.5"); the server caps it again.
      const slippageBps = Math.max(1, Math.min(5000, Math.round((parseFloat(slippage) || 0.5) * 100)));
      const quoteParams = new URLSearchParams({
        chain,
        sellToken: tokenAddresses.sellToken,
        buyToken: tokenAddresses.buyToken,
        sellAmount: rawAmount,
        taker: connectedAddress,
        slippageBps: String(slippageBps),
        // decimals hints so imported/arbitrary tokens resolve server-side.
        fromDecimals: String(getTokenInfo(fromToken).decimals),
        toDecimals: String(getTokenInfo(toToken).decimals),
      });
      const useGasless = gaslessEnabled && isGaslessAvailable;
      const quoteEndpoint = useGasless ? '/api/gasless/quote' : '/api/swap/quote';
      const res = await fetch(`${quoteEndpoint}?${quoteParams}`);
      const swapData = await res.json();

      if (!res.ok) throw new Error(swapData.error || 'Failed to get swap quote');

      let hash = '';

      // Step 2: Send transaction via connected wallet
      const win = typeof window !== 'undefined' ? window : null;

      if (useGasless && swapData.trade) {
        // Gasless flow: EIP-712 signature + submit
        if (!win?.ethereum) throw new Error('Gasless swaps require MetaMask or compatible EVM wallet.');
        const accounts = (await win.ethereum.request({ method: 'eth_accounts' })) as string[];
        if (!accounts.length) throw new Error('No Ethereum wallet connected');
        // Sign the trade typed data
        const tradeSignature = await win.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [accounts[0], JSON.stringify(swapData.trade)],
        });
        // Sign approval if needed
        let approvalSignature: string | undefined;
        if (swapData.approval) {
          approvalSignature = (await win.ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [accounts[0], JSON.stringify(swapData.approval)],
          })) as string;
        }
        // Submit to 0x gasless endpoint
        const submitRes = await fetch('/api/gasless/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trade: swapData.trade,
            tradeSignature,
            ...(approvalSignature ? { approval: swapData.approval, approvalSignature } : {}),
          }),
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) throw new Error(submitData.error || 'Gasless submission failed');
        // Poll for status
        const tradeHash = submitData.tradeHash;
        let attempts = 0;
        while (attempts < 30) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await fetch(`/api/gasless/status?tradeHash=${tradeHash}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'confirmed' && statusData.txHash) { hash = statusData.txHash; break; }
          if (statusData.status === 'failed') throw new Error('Gasless transaction failed on-chain');
          attempts++;
        }
        if (!hash) throw new Error('Gasless transaction timed out. Check your wallet for status.');
      } else if (swapData.transaction && win?.ethereum && detectedWallet === 'ethereum') {
        // EVM wallet (MetaMask etc) — standard swap
        const accounts = (await win.ethereum.request({ method: 'eth_accounts' })) as string[];
        if (!accounts.length) throw new Error('No Ethereum wallet connected');
        const txParams = { from: accounts[0], to: swapData.transaction.to, data: swapData.transaction.data, value: swapData.transaction.value, gas: swapData.transaction.gas };
        hash = (await win.ethereum.request({ method: 'eth_sendTransaction', params: [txParams] })) as string;
      } else if (win?.solana && detectedWallet === 'solana') {
        // Solana wallet (Phantom etc)
        if (swapData.swapTransaction) {
          const { Transaction } = await import('@solana/web3.js');
          const txBytes = Buffer.from(swapData.swapTransaction, 'base64');
          const tx = Transaction.from(txBytes);
          const signed = await win.solana.signAndSendTransaction(tx);
          hash = signed.signature;
        } else {
          throw new Error('No Solana transaction data received from API.');
        }
      } else if (detectedWallet === 'builtin') {
        // Builtin Naka wallet: sign via ethers with the stored encrypted
        // key. The key is persisted by the Wallet page via
        // encryptPrivateKey (AES-256-GCM, PBKDF2, v2 JSON payload), so we
        // MUST decrypt with the matching shared helper — the previous
        // bespoke decrypt assumed a legacy iv-separated format with a raw
        // password-as-key, which never matched the real payload and
        // failed every built-in swap.
        const storedWallets = safeLocalParse<Array<{ address?: string; encryptedKey?: string; importMethod?: string; derivationPath?: string }>>('steinz_wallets', []);
        const activeAddr = safeLocalGet('steinz_active_wallet_address') || connectedAddress;
        // Solana is case-sensitive — compare via the shared normalizer
        // rather than raw toLowerCase.
        const storedWallet = storedWallets.find(w => w.address && activeAddr && addressesEqual(w.address, activeAddr, 'ethereum'));
        if (!storedWallet) {
          throw new Error('No Naka wallet found on this device. Re-import your wallet from the Wallet page to sign transactions.');
        }
        if (!swapData.transaction) {
          // The built-in signer here is EVM-only; Solana swaps need a
          // Solana keypair + versioned-tx flow (Phantom path above).
          throw new Error(
            chain === 'solana'
              ? 'Swapping on Solana with the built-in Naka wallet isn’t supported yet — connect Phantom for Solana swaps.'
              : 'The router did not return a transaction to sign. Refresh the quote and try again.',
          );
        }
        const chainRpcsForLedger: Record<string, string> = {
          ethereum: 'https://eth.llamarpc.com', base: 'https://mainnet.base.org',
          arbitrum: 'https://arb1.arbitrum.io/rpc', polygon: 'https://polygon-rpc.com',
          bsc: 'https://bsc-dataseed.binance.org', avalanche: 'https://api.avax.network/ext/bc/C/rpc',
          optimism: 'https://mainnet.optimism.io',
        };
        // #44 — Ledger hardware wallet: sign the swap on the device (no
        // stored key to decrypt).
        if (storedWallet.importMethod === 'ledger') {
          const { sendLedgerEvmTx } = await import('@/lib/wallet/ledger');
          hash = await sendLedgerEvmTx({
            path: storedWallet.derivationPath ?? "44'/60'/0'/0/0",
            rpcUrl: chainRpcsForLedger[chain] || chainRpcsForLedger.ethereum,
            tx: {
              to: swapData.transaction.to,
              data: swapData.transaction.data,
              value: swapData.transaction.value ? BigInt(swapData.transaction.value) : undefined,
            },
          });
          // Skip the password/decrypt path below — Ledger already broadcast.
        } else {
        if (!storedWallet.encryptedKey) {
          throw new Error('No Naka wallet keys found on this device. Re-import your wallet from the Wallet page to sign transactions.');
        }
        const { ethers } = await import('ethers');
        const pwd = getWalletSessionKey() || '';
        if (!pwd) {
          // Audit B4 / P1 #8 — surface the unlock modal instead of
          // throwing. handleSwap re-runs after the user enters their
          // password; this keeps the swap flow continuous from the
          // user's perspective rather than dumping them back to the
          // form with an opaque "session expired" toast.
          setSwapping(false);
          pendingPostUnlock.current = () => { void handleSwap(); };
          setUnlockState({
            encryptedKey: storedWallet.encryptedKey,
            addressShort: storedWallet.address ? `${storedWallet.address.slice(0, 6)}…${storedWallet.address.slice(-4)}` : undefined,
          });
          return;
        }
        // AES-256-GCM decryption via the shared wallet-encryption helper
        // (same format the Wallet page wrote).
        let pk: string;
        try {
          pk = await decryptPrivateKey(storedWallet.encryptedKey, pwd);
        } catch {
          throw new Error('Failed to decrypt wallet key — wrong password, or this wallet predates AES-256-GCM (re-import the seed phrase from the Wallet page).');
        }
        const chainRpcs: Record<string, string> = {
          ethereum: 'https://eth.llamarpc.com',
          base: 'https://mainnet.base.org',
          arbitrum: 'https://arb1.arbitrum.io/rpc',
          polygon: 'https://polygon-rpc.com',
          bsc: 'https://bsc-dataseed.binance.org',
          avalanche: 'https://api.avax.network/ext/bc/C/rpc',
          optimism: 'https://mainnet.optimism.io',
        };
        const rpcUrl = chainRpcs[chain] || 'https://eth.llamarpc.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = new ethers.Wallet(pk, provider);
        const tx = await signer.sendTransaction(swapData.transaction);
        hash = tx.hash;
        } // end non-Ledger built-in signing
      } else {
        throw new Error('Please connect a wallet (MetaMask, Phantom, or built-in) to execute swaps.');
      }

      if (!hash) throw new Error('Transaction was not signed. Please try again.');

      setTxHash(hash);
      setTxStatus('confirmed');
      notifySwapCompleted(fromToken, toToken, fromAmount);
      setSwapSuccess(true);
      import('@/lib/posthog').then(({ track }) => {
        track('swap_executed', {
          from_token: fromToken,
          to_token: toToken,
          chain,
          from_amount: fromAmount,
          tx_hash: hash,
        });
      }).catch(() => { /* PostHog not configured */ });
      setTimeout(() => { setSwapSuccess(false); setTxStatus('idle'); setTxHash(''); }, 10000);

      // Save amounts before clearing
      const savedFromAmount = fromAmount;
      const savedToAmount = toAmount;
      setFromAmount('');
      setToAmount('');
      setQuoteData(null);

      // Dispatch global balance refresh event
      window.dispatchEvent(new Event('steinz:balance-changed'));

      // Log to Supabase (non-blocking)
      try {
        await fetch('/api/swap/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: connectedAddress,
            txHash: hash,
            chain,
            fromToken,
            toToken,
            fromAmount: parseFloat(savedFromAmount),
            toAmount: parseFloat(savedToAmount),
            status: 'confirmed',
          }),
        });
      } catch (logErr) {
        console.error('[Swap] Failed to log to Supabase:', logErr);
      }

      // Also save to localStorage as backup
      const txRecord = {
        id: `swap-${Date.now()}`,
        type: 'swap',
        from: fromToken,
        to: toToken,
        fromAmount: parseFloat(savedFromAmount),
        toAmount: parseFloat(savedToAmount),
        chain,
        txHash: hash,
        timestamp: Date.now(),
        address: connectedAddress,
      };
      const existing = safeLocalParse<Array<typeof txRecord>>('steinz_swap_history', []);
      existing.unshift(txRecord);
      safeLocalSet('steinz_swap_history', JSON.stringify(existing.slice(0, 50)));
    } catch (err: any) {
      setTxStatus('failed');
      setSwapError(err?.message || 'Swap failed. Please try again.');
    }
    setSwapping(false);
  };

  const estimatedGas = quoteData ? `$${quoteData.gasEstimateUsd.toFixed(2)}` : chain === 'solana' ? '$0.001' : chain === 'base' ? '$0.02' : '$2.40';
  const priceImpact = quoteData ? quoteData.priceImpact : '0.01';
  const hasQuote = fromAmount && toAmount && parseFloat(fromAmount) > 0;
  const rate = hasQuote ? (parseFloat(toAmount) / parseFloat(fromAmount)) : 0;

  // §MEV — auto-on Solana (Jito is friction-free) and auto-on for any
  // trade ≥ $1,000 USD on any chain. User can still flip via the
  // Settings toggle and that override is respected for the rest of the
  // session.
  const fromAmountUsd = quoteData?.fromAmountUsd ?? null;
  const mevAutoForLarge = fromAmountUsd !== null && fromAmountUsd >= 1000;
  const userOverroteMev = useRef(false);
  useEffect(() => {
    if (userOverroteMev.current) return;
    const shouldBeOn = chain === 'solana' || mevAutoForLarge;
    if (shouldBeOn && !mevProtect) setMevProtect(true);
    if (!shouldBeOn && chain !== 'solana' && mevProtect) {
      // only auto-OFF if we previously auto-turned it on (small trades EVM)
      setMevProtect(false);
    }
  }, [chain, mevAutoForLarge, mevProtect]);
  const setMevProtectManual = (v: boolean) => {
    userOverroteMev.current = true;
    setMevProtect(v);
  };

  // Pre-trade sandwich-risk fetch when user has a token + amount.
  // Cheap, 30s cache via the API's withCache. Useful for the in-page
  // pill warning when MEV is OFF on a risky trade.
  useEffect(() => {
    if (!hasQuote || !toToken) { setSandwichRisk(null); return; }
    const ctrl = new AbortController();
    const usd = fromAmountUsd && fromAmountUsd > 0 ? fromAmountUsd : 1000;
    fetch(`/api/mev-protection?token=${encodeURIComponent(toToken)}&chain=${chain}&amount=${usd}`, { signal: ctrl.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { sandwichRisk?: number } | null) => {
        if (d && typeof d.sandwichRisk === 'number') setSandwichRisk(d.sandwichRisk);
      })
      .catch(() => { /* non-fatal */ });
    return () => ctrl.abort();
  }, [hasQuote, toToken, chain, fromAmountUsd]);

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#0066FF]/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 pt-6 sm:pt-12 pb-20 min-h-screen">
        <div className="w-full max-w-[460px]">
          <div className="flex items-center justify-between mb-6">
            {/*
              Bug §2 — when the user opened Swap from inside the Naka
              Wallet (router.push('/dashboard/swap?from=wallet')), the
              default router.back() behaviour was unreliable — for users
              who arrived via a hard refresh or a deep link, history.back
              landed them outside the wallet. Reading ?from= and giving
              BackButton an explicit href makes the round-trip
              deterministic and matches what the user actually wants:
              return to wherever they launched Swap from.
            */}
            {(() => {
              const from = searchParams?.get('from');
              const backHref = from === 'wallet'
                ? '/dashboard/wallet-page'
                : from === 'home'
                  ? '/dashboard'
                  : undefined;
              return <BackButton href={backHref} />;
            })()}
            <h1 className="text-lg font-heading font-bold text-white">Swap</h1>
            <div className="flex items-center gap-1.5">
              <HowItWorksButton content={swapHowItWorks} className="ms-auto shrink-0" />
              {/* Multi-leg batch flow — queue several swaps, sign each separately. */}
              <button
                onClick={() => router.push('/dashboard/swap/batch')}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all inline-flex items-center gap-1.5"
              >
                <ArrowDownUp className="w-3.5 h-3.5" /> Batch
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-[#0066FF]/20 text-[#0066FF]' : 'hover:bg-white/5 text-gray-400'}`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Wallet selector — Naka Wallet (built-in) + WalletConnect only. */}
          {walletConnectError && (
            <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-red-400">{walletConnectError}</span>
                <button onClick={() => setWalletConnectError('')} aria-label="Dismiss wallet error" className="ms-auto text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" aria-hidden="true" /></button>
              </div>
              <WalletConnectHealthPanel />
            </div>
          )}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Naka Wallet (built-in) — selecting it surfaces the create /
                unlock flow and mirrors the active address live. */}
            <button
              onClick={handleSelectNakaWallet}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                walletMode === 'naka'
                  ? 'bg-[#0066FF]/15 text-blue-400 border-[#0066FF]/40'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800/60 hover:border-slate-700 hover:text-slate-300'
              }`}
              aria-pressed={walletMode === 'naka'}
            >
              <NakaLogo size={16} />
              Naka Wallet
              {walletMode === 'naka' && !nakaAddress && (
                <span className="text-[9px] text-amber-400 font-normal ms-0.5">Connect</span>
              )}
              {!!nakaAddress && walletMode === 'naka' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 ms-0.5" />
              )}
            </button>

            {/* §10 — WalletConnect pill: opens the AppKit modal which
                handles browser extensions, the WC v2 QR (desktop), and
                mobile deep-links to external wallets (Android/iOS). The
                connected account is mirrored into wallet state by the
                useEffect above; no further wiring needed.
                Hidden when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not
                configured — the AppKit instance and wagmi adapter are
                both null in that case so the modal would be a no-op. */}
            {HAS_APPKIT && (
              <button
                onClick={() => openAppKitModal()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border bg-[#0066FF]/10 text-blue-200 border-[#0066FF]/40 hover:bg-[#0066FF]/20 hover:text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                aria-label="Connect via WalletConnect (mobile-friendly)"
              >
                <WalletConnectLogo size={16} />
                {onMobileDevice ? 'Mobile / WalletConnect' : 'WalletConnect'}
                {appKitConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ms-0.5" />}
              </button>
            )}
          </div>

          {/* Network selector — single dropdown with real chain logos
              instead of a scattered, overflowing chip row. */}
          <div className="mb-4">
            <SelectMenu
              value={chain}
              prefix="Network"
              options={CHAINS.map(c => ({ id: c.id, label: c.label, chain: c.id }))}
              onChange={(id) => {
                const c = CHAINS.find(x => x.id === id);
                if (!c) return;
                setChain(c.id);
                setFromToken(c.symbol);
                simulateQuote(fromAmount, c.symbol, toToken, c.id);
              }}
            />
          </div>

          <SettingsPanel
            slippage={slippage}
            setSlippage={setSlippage}
            mevProtect={mevProtect}
            setMevProtect={setMevProtectManual}
            mevAutoForLarge={mevAutoForLarge || chain === 'solana'}
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
          {showSettings && <div className="h-3" />}

          <div className="nl-glass rounded-2xl overflow-hidden shadow-2xl shadow-black/20" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 26px rgba(0,102,255,.18), 0 18px 50px rgba(0,0,0,.45)' }}>
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">You pay</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600">Balance: {connectedAddress ? (walletBalance[fromToken]?.toFixed(4) || '0.00') : '--'}</span>
                  {connectedAddress && walletBalance[fromToken] > 0 && (
                    <>
                      <button onClick={() => handleFromAmountChange(walletBalance[fromToken].toString())} className="text-[10px] text-[#0066FF] font-bold hover:text-[#0066FF]/80 transition-colors px-1.5 py-0.5 rounded bg-[#0066FF]/10">MAX</button>
                      <button onClick={() => handleFromAmountChange((walletBalance[fromToken] / 2).toString())} className="text-[10px] text-gray-500 font-bold hover:text-gray-400 transition-colors px-1.5 py-0.5 rounded bg-white/5">HALF</button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => handleFromAmountChange(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent text-3xl sm:text-[32px] font-bold focus:outline-none placeholder-gray-700/50 min-w-0 text-white"
                />
                <button
                  onClick={() => setShowTokenSelect('from')}
                  className="nl-card flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all shrink-0 group"
                >
                  <TokenBadge symbol={fromToken} size={24} />
                  <span className="text-white">{fromToken}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                </button>
              </div>
              {fromAmount && quoteData && (
                <div className="text-xs text-gray-500 mt-2">
                  ~${quoteData.fromAmountUsd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}
                </div>
              )}
            </div>

            <div className="relative h-0 z-10">
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
                <button
                  onClick={handleSwapTokens}
                  className="w-10 h-10 bg-[#1a2332] border-[3px] border-[#0A0E1A] rounded-xl flex items-center justify-center hover:bg-[#0066FF] transition-all duration-300 group shadow-lg"
                  style={{ transform: `rotate(${swapRotate}deg)`, transition: 'transform 0.3s ease, background-color 0.2s ease' }}
                >
                  <ArrowDownUp className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>

            <div className="nl-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">You receive</span>
                <span className="text-xs text-gray-600">Balance: {connectedAddress ? (walletBalance[toToken]?.toFixed(4) || '0.00') : '--'}</span>
              </div>
              <div className="flex items-center gap-3">
                {fetchingQuote ? (
                  <div className="flex-1 flex items-center gap-2.5">
                    <Loader2 className="w-5 h-5 text-[#0066FF] animate-spin" />
                    <span className="text-sm text-gray-500">Finding best route...</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={toAmount}
                    readOnly
                    placeholder="0"
                    className="flex-1 bg-transparent text-3xl sm:text-[32px] font-bold focus:outline-none placeholder-gray-700/50 min-w-0 text-white"
                  />
                )}
                <button
                  onClick={() => setShowTokenSelect('to')}
                  className="nl-card flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all shrink-0 group"
                >
                  <TokenBadge symbol={toToken} size={24} />
                  <span className="text-white">{toToken}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                </button>
              </div>
              {toAmount && quoteData && (
                <div className="text-xs text-gray-500 mt-2">
                  ~${quoteData.toAmountUsd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}
                </div>
              )}
            </div>

            {hasQuote && (
              <div className="border-t border-white/[0.04]">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full px-4 sm:px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <RefreshCw className="w-3 h-3" />
                    <span>1 {fromToken} = {rate.toFixed(fromToken === 'ETH' || fromToken === 'WBTC' ? 2 : 6)} {toToken}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
                </button>

                {showDetails && (
                  <div className="px-4 sm:px-5 pb-4 space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Price Impact</span>
                      <span className={`font-medium ${(() => {
                        const pi = parseFloat(priceImpact);
                        if (pi < 1) return 'text-green-400';
                        if (pi < 5) return 'text-yellow-400';
                        if (pi < 15) return 'text-orange-400';
                        return 'text-red-400';
                      })()}`}>
                        {priceImpact}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Slippage</span>
                      <span className="text-gray-300">{slippage}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Minimum received</span>
                      <span className="text-gray-300">
                        {quoteData ? quoteData.minReceived : (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Network fee</span>
                      <span className="text-gray-300">{estimatedGas}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Route</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeChain.color }} />
                        <span className="font-medium" style={{ color: activeChain.color }}>{activeChain.dex}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gasless Toggle */}
          {chain !== 'solana' && (
            <div className="mt-3 flex items-center justify-between nl-glass rounded-xl px-4 py-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <div>
                  <span className="text-xs font-medium text-white">Gasless Mode</span>
                  <p className="text-[10px] text-gray-500">
                    {gaslessEnabled && isGaslessAvailable
                      ? 'No gas fees — cost absorbed into trade'
                      : !isGaslessAvailable && gaslessEnabled
                        ? `Not available for native tokens. Standard swap.`
                        : 'Standard swap — you pay network gas'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGaslessEnabled(!gaslessEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${gaslessEnabled ? 'bg-[#0066FF]' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${gaslessEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )}

          <div className="mt-3">
            {/* Transaction Status Overlay */}
            {txStatus !== 'idle' && (
              <div className={`mb-3 rounded-2xl p-4 flex flex-col gap-2 border ${
                txStatus === 'pending' ? 'bg-[#0066FF]/10 border-[#0066FF]/30' :
                txStatus === 'confirmed' ? 'bg-green-500/10 border-green-500/30' :
                'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  {txStatus === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-[#0066FF]" />}
                  {txStatus === 'confirmed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {txStatus === 'failed' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <span className={`text-xs font-bold ${
                    txStatus === 'pending' ? 'text-[#0066FF]' :
                    txStatus === 'confirmed' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {txStatus === 'pending' ? 'Transaction Pending...' :
                     txStatus === 'confirmed' ? 'Swap Confirmed!' : 'Transaction Failed'}
                  </span>
                </div>
                {txHash && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500 font-mono truncate flex-1">
                      {txHash.slice(0, 20)}...{txHash.slice(-8)}
                    </span>
                    <a
                      href={chain === 'solana' ? `https://solscan.io/tx/${txHash}` : chain === 'base' ? `https://basescan.org/tx/${txHash}` : `https://etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#0066FF] hover:underline shrink-0"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Connect Wallet prompt if no wallet detected */}
            {!connectedAddress && (
              <div className="mb-3 rounded-2xl p-4 nl-glass flex items-center gap-3">
                <Wallet className="w-5 h-5 text-gray-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-300">
                    {walletMode === 'metamask' ? 'MetaMask not connected' : walletMode === 'phantom' ? 'Phantom not connected' : 'No Naka Wallet found'}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {walletMode === 'naka' ? 'Create or import a wallet to swap' : 'Reconnect via WalletConnect to continue'}
                  </p>
                </div>
                {walletMode === 'naka' ? (
                  <button
                    onClick={() => router.push('/dashboard/wallet-page')}
                    className="nl-button shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                  >
                    Create
                  </button>
                ) : HAS_APPKIT ? (
                  <button
                    onClick={() => openAppKitModal()}
                    className="nl-button shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                  >
                    Connect
                  </button>
                ) : null}
              </div>
            )}

            {/* §12 — Pre-trade security gate. Resolves the destination
                token's contract address via the existing CHAIN+symbol
                map and pre-fetches Trust Score. High-risk tokens
                replace the CTA with a "Review risk" modal that the
                user must explicitly acknowledge before swap. Fail-open
                if the chain/address can't be resolved (native tokens,
                non-listed pairs) so we never hard-block a legitimate
                trade because the score endpoint doesn't have data. */}
            <SecurityGate
              action="swap"
              chain={chain}
              token={getTokenAddresses(fromToken, toToken, chain).buyToken}
              className="w-full"
            >
            <button
              onClick={() => {
                if (!connectedAddress) { handleSwap(); return; }
                if (!fromAmount || parseFloat(fromAmount) <= 0) return;
                setShowReview(true);
              }}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0 || swapping || fetchingQuote}
              className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                fromAmount && parseFloat(fromAmount) > 0 && !swapping && !fetchingQuote
                  ? 'nl-button active:scale-[0.98]'
                  : 'nl-card text-gray-600 cursor-not-allowed'
              }`}
            >
              {swapping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {txStatus === 'pending' ? 'Submitting to blockchain...' : 'Swapping...'}
                </>
              ) : fetchingQuote ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding route...
                </>
              ) : !connectedAddress ? (
                <>
                  <Wallet className="w-4 h-4" />
                  Connect Wallet to Swap
                </>
              ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
                'Enter an amount'
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Swap
                </>
              )}
            </button>
            </SecurityGate>

            {swapError && (
              <div className="mt-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-red-400">{swapError}</span>
              </div>
            )}

            {swapSuccess && (
              <div className="mt-2 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-green-400">
                  Swap executed successfully
                  {txHash && (
                    <a
                      href={chain === 'solana' ? `https://solscan.io/tx/${txHash}` : `https://etherscan.io/tx/${txHash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="ms-2 underline inline-flex items-center gap-1"
                    >
                      View tx <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </span>
              </div>
            )}

            {/* §advanced-orders — Limit / DCA / Stop+TP order types are
                implemented as full API + cron monitor stacks (/api/trading/
                limit-orders, dca-bots, stop-loss). The UI module
                (components/trading/OrderForm) was already built with 4
                tabs but had no entry point. Surface it here as a
                collapsible block so the user can place advanced orders
                without leaving the swap page. */}
            <div className="mt-3 nl-glass rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedOrders((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                aria-expanded={showAdvancedOrders}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#0066FF]" />
                  <span className="text-xs text-gray-300 font-semibold">Advanced orders</span>
                  <span className="text-[10px] text-gray-500">Limit · DCA · Stop · Take-profit</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showAdvancedOrders ? 'rotate-180' : ''}`}
                />
              </button>
              {showAdvancedOrders && (
                <div className="border-t border-white/[0.04] max-h-[600px] overflow-y-auto">
                  <OrderForm
                    chain={chain}
                    tokenAddress={getTokenAddresses(fromToken, toToken, chain).buyToken}
                    tokenSymbol={toToken}
                  />
                </div>
              )}
            </div>
          </div>

          {hasQuote && (
            <div className="mt-3 nl-glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-[#0066FF]" />
                <span className="text-xs text-gray-400 font-medium">Order routing</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TokenBadge symbol={fromToken} size={28} />
                  <div>
                    <div className="text-sm font-bold text-white">{fromToken}</div>
                    <div className="text-[10px] text-gray-500">{fromAmount}</div>
                  </div>
                </div>

                <div className="flex-1 mx-4 flex items-center">
                  <div className="flex-1 border-t border-dashed border-[#1a1f2e]" />
                  <div className="mx-2 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/[0.06]" style={{ backgroundColor: activeChain.color + '15', color: activeChain.color }}>
                    {activeChain.dex}
                  </div>
                  <div className="flex-1 border-t border-dashed border-[#1a1f2e]" />
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="text-end">
                    <div className="text-sm font-bold text-white">{toToken}</div>
                    <div className="text-[10px] text-gray-500">{toAmount}</div>
                  </div>
                  <TokenBadge symbol={toToken} size={28} />
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-1.5 text-gray-600">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeChain.color }} />
            <span className="text-[11px]">Powered by {activeChain.dex}</span>
          </div>
        </div>
      </div>

      <TokenSelectModal
        isOpen={showTokenSelect !== null}
        onClose={() => setShowTokenSelect(null)}
        onSelect={(symbol) => {
          if (showTokenSelect === 'from') {
            if (symbol === toToken) setToToken(fromToken);
            setFromToken(symbol);
            simulateQuote(fromAmount, symbol);
          } else {
            if (symbol === fromToken) setFromToken(toToken);
            setToToken(symbol);
            simulateQuote(fromAmount, undefined, symbol);
          }
        }}
        exclude={showTokenSelect === 'from' ? toToken : fromToken}
        chain={chain}
      />

      {showReview && (() => {
        const pi = parseFloat(priceImpact || '0');
        const piColor =
          pi < 1 ? 'text-green-400' :
          pi < 5 ? 'text-yellow-400' :
          pi < 15 ? 'text-orange-400' :
          'text-red-400';
        const piLabel = pi < 1 ? 'Low' : pi < 5 ? 'Moderate' : pi < 15 ? 'High' : 'Severe';
        // Industry-standard sign-blocker — single source of truth shared
        // with SwapSecurityWarnings so the warning copy and the Confirm
        // button's disabled state never disagree.
        const securityCheck = shouldBlockSwap({
          data: tokenSecurity,
          priceImpact: pi,
          slippagePct: parseFloat(slippage) || 0,
        });
        const securityBlocking = securityCheck.blocking;
        // Audit P0 #4 — Uniswap blocks at 15%, we previously allowed
        // anything under 30%. A 15-30% impact almost always indicates a
        // honeypot, drained liquidity pool, or a routing pathology — the
        // user is far better served by a hard block than by a confirm
        // button that costs them most of their input. Industry parity
        // with Uniswap V3.
        const piBlocked = pi >= 15;
        // Audit P0 #3 — quote staleness countdown. nowTick refreshes
        // every second while the modal is open; secondsLeft drives the
        // pill UI. Intentionally floor + max(0) so the user never sees
        // negative time during the brief refetch window.
        const quoteAgeMs = quoteFetchedAt ? nowTick - quoteFetchedAt : 0;
        const secondsLeft = Math.max(0, Math.ceil((QUOTE_TTL_MS - quoteAgeMs) / 1000));
        const refreshingQuote = fetchingQuote || (quoteFetchedAt !== null && quoteAgeMs >= QUOTE_TTL_MS);
        return (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowReview(false)}>
            <div
              className="w-full max-w-[460px] nl-glass rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
              style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Review swap</h2>
                <div className="flex items-center gap-2">
                  {/*
                    Audit P0 #3 — quote freshness pill. Green while quote
                    is fresh, amber as it approaches expiry, spinner while
                    we're refetching. Mirrors 1inch's "expires in Xs"
                    badge so users don't sign stale quotes.
                  */}
                  {quoteFetchedAt && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
                        refreshingQuote
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          : secondsLeft <= 3
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}
                      title="Quote refreshes automatically every 15 seconds"
                    >
                      {refreshingQuote
                        ? (<><RefreshCw className="w-3 h-3 animate-spin" /> Refreshing</>)
                        : (<>Refresh in {secondsLeft}s</>)}
                    </span>
                  )}
                  <button onClick={() => setShowReview(false)} className="p-1.5 rounded-lg hover:bg-white/5">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="nl-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold">{fromToken.slice(0, 2)}</div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">You pay</div>
                      <div className="text-base font-mono text-white">{fromAmount} {fromToken}</div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center"><ChevronDown className="w-4 h-4 text-gray-600" /></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold">{toToken.slice(0, 2)}</div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">You receive</div>
                      <div className="text-base font-mono text-white">{toAmount} {toToken}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Rate</span>
                  <span className="text-gray-200 font-mono">1 {fromToken} = {rate.toFixed(6)} {toToken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Price impact</span>
                  <span className={`font-semibold ${piColor}`}>{priceImpact}% <span className="text-[10px] font-normal opacity-80">({piLabel})</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Slippage tolerance</span>
                  <span className="text-gray-200">{slippage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Minimum received</span>
                  <span className="text-gray-200 font-mono">{quoteData ? quoteData.minReceived : (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Network fee</span>
                  <span className="text-gray-200">{estimatedGas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Route</span>
                  <span style={{ color: activeChain.color }} className="font-medium">{activeChain.dex}</span>
                </div>
              </div>

              {/* Audit B7 / P1 #13 — full route preview. Reads route
                  data straight off quoteData; supports both 0x (EVM)
                  and Jupiter (Solana) shapes via the component's
                  internal normalizer. Falls back to the chain's default
                  DEX label when no structured route is present so
                  "Powered by Uniswap V3" still has somewhere to live. */}
              <SwapRoutePreview
                fromSymbol={fromToken}
                toSymbol={toToken}
                fallbackVenue={activeChain.dex}
                zeroExRoute={(quoteData?.route as { fills?: Array<{ source?: string; proportionBps?: number; from?: string; to?: string }>; tokens?: Array<{ address: string; symbol: string }> } | undefined) ?? undefined}
                jupiterRoutePlan={(quoteData?.routePlan as Array<{ protocol?: string; inputMint?: string; outputMint?: string; percent?: number }> | undefined) ?? undefined}
              />

              {/* §multi-aggregator best-of-3 — calls /api/swap/routes which
                  fans out to 1inch + KyberSwap + OpenOcean in parallel.
                  Shows the best provider by netOutputUsd with a toggle
                  so the user can see the alternatives. The endpoint was
                  built but the UI never called it (dead code until now). */}
              {fromAmount && parseFloat(fromAmount) > 0 && (
                <RouteComparison
                  chain={chain}
                  fromToken={fromToken}
                  toToken={toToken}
                  amountIn={fromAmount}
                  selectedProvider={selectedProvider ?? undefined}
                  onSelect={(r) => { setSelectedProvider(r.provider); setSelectedRoute(r); }}
                />
              )}

              {/* §5.6 Swap UI Dune intelligence — sandwich risk (real,
                  not wash-trade proxy), honeypot flag (GoPlus cache),
                  smart-money last-hour direction, observed buy/sell tax,
                  liquidity cliff, recommended slippage. Quietly hides
                  when none of the signals have data yet. */}
              {fromAmount && parseFloat(fromAmount) > 0 && (
                <SwapDuneStrip
                  chain={chain}
                  token_in={fromToken}
                  token_out={toToken}
                  size_usd={parseFloat(fromAmount)}
                  className="mt-2"
                />
              )}

              {/* §MEV pre-trade pill — surfaces sandwichRisk 0-100 from
                  /api/mev-protection so the user can see the actual risk
                  before signing. Color codes: <25 green, 25-50 amber,
                  >50 red. When risk is high AND mevProtect is OFF, we
                  also prompt to flip the toggle on. */}
              {sandwichRisk !== null && hasQuote && (
                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs border ${
                    sandwichRisk >= 50
                      ? 'bg-red-500/10 border-red-500/30 text-red-200'
                      : sandwichRisk >= 25
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">MEV risk</span>
                    <span className="font-mono">{sandwichRisk}/100</span>
                  </div>
                  {sandwichRisk >= 50 && !mevProtect && (
                    <button
                      type="button"
                      onClick={() => setMevProtectManual(true)}
                      className="px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-100 text-[10px] font-bold uppercase tracking-wide"
                    >
                      Enable Protection
                    </button>
                  )}
                  {mevProtect && (
                    <span className="text-[10px] font-bold uppercase tracking-wide">Protected</span>
                  )}
                </div>
              )}

              {pi >= 5 && (
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${piBlocked ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${piBlocked ? 'text-red-400' : 'text-amber-400'}`} />
                  <div className={`text-[11px] ${piBlocked ? 'text-red-300' : 'text-amber-300'}`}>
                    {piBlocked
                      ? `Price impact of ${priceImpact}% is too high. This swap is blocked to protect your funds.`
                      : `High price impact of ${priceImpact}%. You'll receive noticeably less than the market rate.`}
                  </div>
                </div>
              )}

              {/* Industry-standard security panel — Trojan / Maestro parity.
                  Blocks on honeypot / tax >= 30% / pausable / blacklist;
                  warns on tax 10-30% / cannot-sell-all / slippage outside
                  0.1-10% safe band. */}
              <SwapSecurityWarnings
                data={tokenSecurity}
                loading={tokenSecurityLoading}
                priceImpact={pi}
                slippagePct={parseFloat(slippage) || 0}
                tokenAddress={getTokenAddresses(fromToken, toToken, chain).buyToken}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowReview(false)}
                  className="nl-button--ghost flex-1 py-3.5 rounded-2xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowReview(false); handleSwap(); }}
                  disabled={piBlocked || swapping || securityBlocking}
                  className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                    piBlocked || securityBlocking
                      ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                      : 'nl-button active:scale-[0.98]'
                  }`}
                >
                  {piBlocked || securityBlocking ? 'Blocked' : 'Confirm swap'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {unlockState && (
        <UnlockWalletModal
          encryptedKey={unlockState.encryptedKey}
          addressShort={unlockState.addressShort}
          walletName="Naka Wallet"
          onUnlocked={() => {
            setUnlockState(null);
            const next = pendingPostUnlock.current;
            pendingPostUnlock.current = null;
            // Re-run the original swap flow now that getWalletSessionKey()
            // will return the verified password the modal just cached.
            if (next) next();
          }}
          onClose={() => {
            setUnlockState(null);
            pendingPostUnlock.current = null;
          }}
        />
      )}
    </div>
  );
}
