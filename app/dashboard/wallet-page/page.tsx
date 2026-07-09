'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFeatureUsageLog } from '@/lib/hooks/useFeatureUsageLog';
// Naka Labs brand icons — broad swap of available glowing-geometric versions.
// Icons not yet in the brand library stay on lucide for now.
import {
  Plus, Download, Send, Copy, Eye, EyeOff, Trash2, ChevronRight, Wallet,
  Shield, CheckCircle as Check, AlertTriangle, ExternalLink, Settings, Search,
  X, RefreshCw, ChevronDown, Share2, TrendingUp, TrendingDown,
  ArrowLeft, RotateCcw, Key, Globe, Layers, ArrowUpRight, ArrowDownLeft,
  Repeat, DollarSign, QrCode, ShoppingCart, Zap, Loader2, BarChart3, Info,
} from 'lucide-react';
import Link from 'next/link';
import BackButton from '@/components/ui/BackButton';
import SteinzLogo from '@/components/SteinzLogo';
import { notifyWalletCreated, notifyWalletImported, notifySeedBackupReminder } from '@/lib/notifications';
import { WalletTokenRow } from '@/components/wallet/WalletTokenRow';
import { WatchlistTab } from '@/components/wallet/WatchlistTab';
import { ScanQrModal } from '@/components/wallet/ScanQrModal';
import { NftTab } from '@/components/wallet/NftTab';
import { DappDirectory } from '@/components/wallet/DappDirectory';
import { BiometricUnlockRow } from '@/components/wallet/BiometricUnlockRow';
// Audit B4 — shared AES-GCM crypto, lifted from this file so the new
// UnlockWalletModal can verify a typed password without duplicating
// the Web Crypto plumbing. Original inline definitions removed below.
import { encryptPrivateKey, decryptPrivateKey, verifyWalletPassword } from '@/lib/wallet/encryption';
import { normalizeAddress, isEvmChain, isSolanaAddress, addressesEqual } from '@/lib/utils/addressNormalize';
import { getOnrampUrl } from '@/lib/wallet/onramp';
import { setActiveBuiltinWallet } from '@/lib/wallet/builtinWallet';
import { DappConnect } from '@/components/wallet/DappConnect';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { walletHowItWorks } from '@/lib/howItWorks/content/wallet-page';

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
  importMethod?: 'generated' | 'seed' | 'private_key' | 'ledger';
  // #42 — hardware wallet. For 'ledger' wallets there is NO encryptedKey
  // (the key lives on the device); signing routes to the Ledger via WebHID at
  // the stored BIP-44 path. EVM only.
  derivationPath?: string;
  // Audit B3 / P0 #1 — Solana base58 public key derived from the same
  // BIP-39 seed at Phantom's default path m/44'/501'/0'/0'. Populated
  // at wallet-create or wallet-import time when a mnemonic is present.
  // Wallets imported via raw private key never get this; the Receive
  // view falls back to its "no SOL address" panel for those.
  solanaAddress?: string;
  // BIP-44 account index this wallet was derived at (#38). The first
  // wallet from a seed is index 0 (EVM m/44'/60'/0'/0/0, Solana
  // m/44'/501'/0'/0'); "Add account" derives the next free index from
  // the SAME seed so one phrase backs many accounts, MetaMask/Phantom-
  // style. Absent on legacy records → treated as 0.
  accountIndex?: number;
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
  testnet?: boolean;
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
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', color: '#28A0F0', explorerUrl: 'https://arbiscan.io', explorerName: 'Arbiscan', apiChain: 'arbitrum', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/arbitrum.png', coinGeckoId: 'ethereum' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH', color: '#FF0420', explorerUrl: 'https://optimistic.etherscan.io', explorerName: 'OpScan', apiChain: 'optimism', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/optimism.png', coinGeckoId: 'ethereum' },
  // Robinhood Chain — Arbitrum-Orbit L2, native gas ETH (chain id 4663), priced
  // as ethereum by the EVM intelligence pipeline. Live for holding / receiving /
  // native ETH send; DEX swap routing is not wired yet (see swap page).
  { id: 'robinhood', name: 'Robinhood Chain', symbol: 'ETH', color: '#00C805', explorerUrl: 'https://explorer.chain.robinhood.com', explorerName: 'Robinhood Explorer', apiChain: 'robinhood', logoUrl: '/chains/robinhood.png', coinGeckoId: 'ethereum' },
  // FIX 5A.1 / Phase 4: apiChain was 'bnb' but server (EVM_CHAIN_CONFIG) keys it as 'bsc' — the mismatch
  // meant BSC pill fetched nothing and the UI showed stale prior-chain data (e.g. Solana after clicking BSC).
  { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', color: '#F0B90B', explorerUrl: 'https://bscscan.com', explorerName: 'BscScan', apiChain: 'bsc', logoUrl: COIN_LOGOS.BNB, coinGeckoId: 'binancecoin' },
  { id: 'fantom', name: 'Fantom', symbol: 'FTM', color: '#1969FF', explorerUrl: 'https://ftmscan.com', explorerName: 'FtmScan', apiChain: 'fantom', logoUrl: COIN_LOGOS.FTM, coinGeckoId: 'fantom' },
  { id: 'cronos', name: 'Cronos', symbol: 'CRO', color: '#002D74', explorerUrl: 'https://cronoscan.com', explorerName: 'CronoScan', apiChain: 'cronos', logoUrl: COIN_LOGOS.CRO, coinGeckoId: 'crypto-com-chain' },
  { id: 'sui', name: 'Sui', symbol: 'SUI', color: '#4DA2FF', explorerUrl: 'https://suiscan.xyz', explorerName: 'SuiScan', apiChain: 'sui', logoUrl: COIN_LOGOS.SUI, coinGeckoId: 'sui' },
  // #53 — additional popular EVM networks. Opt-in via Add Network. Native
  // balance reads through the generic RPC path (CHAIN_RPC below); token
  // indexing depends on backend support per chain.
  { id: 'linea', name: 'Linea', symbol: 'ETH', color: '#61DFFF', explorerUrl: 'https://lineascan.build', explorerName: 'LineaScan', apiChain: 'linea', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/linea.png', coinGeckoId: 'ethereum' },
  { id: 'scroll', name: 'Scroll', symbol: 'ETH', color: '#FFEEDA', explorerUrl: 'https://scrollscan.com', explorerName: 'ScrollScan', apiChain: 'scroll', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/scroll.png', coinGeckoId: 'ethereum' },
  { id: 'zksync', name: 'zkSync Era', symbol: 'ETH', color: '#8C8DFC', explorerUrl: 'https://explorer.zksync.io', explorerName: 'zkSync Explorer', apiChain: 'zksync', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/zksync.png', coinGeckoId: 'ethereum' },
  { id: 'mantle', name: 'Mantle', symbol: 'MNT', color: '#000000', explorerUrl: 'https://explorer.mantle.xyz', explorerName: 'Mantle Explorer', apiChain: 'mantle', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/mantle.png', coinGeckoId: 'mantle' },
  { id: 'blast', name: 'Blast', symbol: 'ETH', color: '#FCFC03', explorerUrl: 'https://blastscan.io', explorerName: 'BlastScan', apiChain: 'blast', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/blast.png', coinGeckoId: 'ethereum' },
  { id: 'mode', name: 'Mode', symbol: 'ETH', color: '#DFFE00', explorerUrl: 'https://explorer.mode.network', explorerName: 'Mode Explorer', apiChain: 'mode', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/mode.png', coinGeckoId: 'ethereum' },
  { id: 'gnosis', name: 'Gnosis', symbol: 'XDAI', color: '#3E6957', explorerUrl: 'https://gnosisscan.io', explorerName: 'GnosisScan', apiChain: 'gnosis', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/gnosischain.png', coinGeckoId: 'xdai' },
  { id: 'celo', name: 'Celo', symbol: 'CELO', color: '#FCFF52', explorerUrl: 'https://celoscan.io', explorerName: 'CeloScan', apiChain: 'celo', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/celo.png', coinGeckoId: 'celo' },
  { id: 'metis', name: 'Metis', symbol: 'METIS', color: '#00DACC', explorerUrl: 'https://explorer.metis.io', explorerName: 'Metis Explorer', apiChain: 'metis', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/metis.png', coinGeckoId: 'metis-token' },
  { id: 'moonbeam', name: 'Moonbeam', symbol: 'GLMR', color: '#53CBC8', explorerUrl: 'https://moonscan.io', explorerName: 'MoonScan', apiChain: 'moonbeam', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/moonbeam.png', coinGeckoId: 'moonbeam' },
  { id: 'opbnb', name: 'opBNB', symbol: 'BNB', color: '#F0B90B', explorerUrl: 'https://opbnbscan.com', explorerName: 'opBNBScan', apiChain: 'opbnb', logoUrl: COIN_LOGOS.BNB, coinGeckoId: 'binancecoin' },
  { id: 'manta', name: 'Manta Pacific', symbol: 'ETH', color: '#0091FF', explorerUrl: 'https://pacific-explorer.manta.network', explorerName: 'Manta Explorer', apiChain: 'manta', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/manta.png', coinGeckoId: 'ethereum' },
  { id: 'zora', name: 'Zora', symbol: 'ETH', color: '#000000', explorerUrl: 'https://explorer.zora.energy', explorerName: 'Zora Explorer', apiChain: 'zora', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/zora.png', coinGeckoId: 'ethereum' },
  { id: 'aurora', name: 'Aurora', symbol: 'ETH', color: '#70D44B', explorerUrl: 'https://explorer.aurora.dev', explorerName: 'Aurora Explorer', apiChain: 'aurora', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/aurora.png', coinGeckoId: 'ethereum' },
  { id: 'kava', name: 'Kava', symbol: 'KAVA', color: '#FF564F', explorerUrl: 'https://kavascan.com', explorerName: 'KavaScan', apiChain: 'kava', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/kava.png', coinGeckoId: 'kava' },
];

// FIX 5A.1 / Phase 4: was 'ethereum,base,polygon,avalanche,solana' only, which is why
// clicking Arbitrum / BNB pills showed the previous chain's balances — they weren't gated
// for live fetching. Now matches the full set supported by /api/wallet-intelligence.
// All chains the backend can actually price balances for. This is the
// full universe — the home list below further filters this by the
// user's enabled-chains preference (see DEFAULT_ENABLED_CHAINS and
// NAKA_ENABLED_CHAINS_KEY).
const LIVE_CHAINS = ['ethereum', 'base', 'polygon', 'avalanche', 'solana', 'arbitrum', 'bnb', 'robinhood'];
const EVM_LIVE_CHAINS = ['ethereum', 'base', 'polygon', 'avalanche', 'arbitrum', 'bnb', 'robinhood'];

// Test networks — opt-in via the "Show test networks" toggle on the Networks
// screen (persisted to naka_testnet_mode). These are real public testnets with
// real RPCs + explorers; native balance is read directly via RPC and shown with
// NO USD value (testnet coins are worthless — we never price them as mainnet).
const TESTNET_MODE_KEY = 'naka_testnet_mode';
const TESTNET_CHAINS: ChainInfo[] = [
  { id: 'sepolia', name: 'Ethereum Sepolia', symbol: 'ETH', color: '#627EEA', explorerUrl: 'https://sepolia.etherscan.io', explorerName: 'Etherscan', apiChain: 'sepolia', logoUrl: COIN_LOGOS.ETH, coinGeckoId: '', testnet: true },
  { id: 'base-sepolia', name: 'Base Sepolia', symbol: 'ETH', color: '#0052FF', explorerUrl: 'https://sepolia.basescan.org', explorerName: 'BaseScan', apiChain: 'base-sepolia', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/base.png', coinGeckoId: '', testnet: true },
  { id: 'arbitrum-sepolia', name: 'Arbitrum Sepolia', symbol: 'ETH', color: '#28A0F0', explorerUrl: 'https://sepolia.arbiscan.io', explorerName: 'Arbiscan', apiChain: 'arbitrum-sepolia', logoUrl: 'https://dd.dexscreener.com/ds-data/chains/arbitrum.png', coinGeckoId: '', testnet: true },
  { id: 'polygon-amoy', name: 'Polygon Amoy', symbol: 'POL', color: '#8247E5', explorerUrl: 'https://amoy.polygonscan.com', explorerName: 'PolygonScan', apiChain: 'polygon-amoy', logoUrl: COIN_LOGOS.MATIC, coinGeckoId: '', testnet: true },
  { id: 'bnb-testnet', name: 'BNB Testnet', symbol: 'tBNB', color: '#F0B90B', explorerUrl: 'https://testnet.bscscan.com', explorerName: 'BscScan', apiChain: 'bnb-testnet', logoUrl: COIN_LOGOS.BNB, coinGeckoId: '', testnet: true },
];

function isTestnetChain(id: string): boolean {
  return TESTNET_CHAINS.some((c) => c.id === id);
}
// Lookup across both mainnet + testnet universes (testnets aren't in SUPPORTED_CHAINS).
function chainById(id: string): ChainInfo | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === id) ?? TESTNET_CHAINS.find((c) => c.id === id);
}

// Default chains to show on the wallet home — in display order.
// Everything else is toggled on by the user via Add Network.
const DEFAULT_ENABLED_CHAINS = ['ethereum', 'solana', 'polygon', 'arbitrum', 'bnb', 'base', 'robinhood'];
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
  // Chain-aware: EVM contracts fold to lowercase (matching the seeded
  // entries), Solana addresses keep their case. Never bare .toLowerCase().
  const c = contract ? normalizeAddress(contract, chain) : '';
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

// Whole-portfolio net worth across every priced chain the multi-chain fan-out
// fetched. Sums each chain's REAL total (never fabricated); if the active chain
// wasn't covered by the fan-out (an opt-in L2 we can't price yet) its standalone
// total is added so its balance still counts. Falls back to the active chain
// alone until the fan-out resolves, so first paint is never blank.
function computePortfolioTotal(
  multiChainBalances: Record<string, WalletData | null>,
  walletData: WalletData | null,
  activeChainId: string,
): { hasMulti: boolean; total: number } {
  const vals = Object.values(multiChainBalances);
  const hasMulti = vals.some((d) => d !== null);
  const multiSum = vals.reduce((s, d) => s + (d ? parseFloat(d.totalBalanceUsd || '0') : 0), 0);
  const activeCovered = multiChainBalances[activeChainId] != null;
  const activeTotal = walletData ? parseFloat(walletData.totalBalanceUsd || '0') : 0;
  return { hasMulti, total: hasMulti ? multiSum + (activeCovered ? 0 : activeTotal) : activeTotal };
}

// encryptPrivateKey + decryptPrivateKey were defined here as file-locals.
// They now live in lib/wallet/encryption.ts; see the top-of-file import.

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
// Naka is an EVM-first wallet — default the active chain to Ethereum so Send /
// Receive / the big-4 actions open on ETH, not Solana.
const ETHEREUM_CHAIN = SUPPORTED_CHAINS.find(c => c.id === 'ethereum') || SUPPORTED_CHAINS[0];

export default function WalletPage() {
  useFeatureUsageLog('wallet');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'main' | 'create' | 'import' | 'send' | 'receive' | 'add-token' | 'add-network' | 'wallet-settings' | 'customize' | 'approvals' | 'analytics'>('main');
  // Per-user hidden tokens (Manage/Customize). Token key = chain:contract|symbol.
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set());
  // Fiat Buy on-ramp (Transak) — "coming soon" until the provider is live.
  const [buyComingSoon, setBuyComingSoon] = useState(false);
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  // Bug §5.1 — without this flag the empty-state "Create Wallet" CTA renders
  // on first paint for ~500ms even when localStorage has wallets, because the
  // initial `wallets=[]` state lands before the hydrate() effect reads local.
  // Render a skeleton instead until hydrate has touched local + cloud once.
  const [hydrated, setHydrated] = useState(false);
  const [activeWallet, setActiveWallet] = useState<StoredWallet | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  // Keep the canonical active-wallet key in sync so every trading surface
  // (swap / sniper / whale / market-maker / view-proof) auto-detects this
  // built-in wallet and pendingSigner signs with the same one. Fixes the
  // "No Naka Wallet found — create a wallet" re-prompt (batch 3, IMG_1933).
  useEffect(() => {
    if (activeWallet?.address) setActiveBuiltinWallet(activeWallet.address);
  }, [activeWallet?.address]);
  const [loading, setLoading] = useState(false);
  const [customTokens, setCustomTokens] = useState<string[]>([]);
  // Enabled chains — persisted per-device. Default is the 4 native
  // chains (ETH/BNB/Polygon/SOL); anything else the user toggles on
  // via the Add Network flow.
  const [enabledChains, setEnabledChains] = useState<string[]>(DEFAULT_ENABLED_CHAINS);
  // Test-network mode (opt-in, default off → mainnet behaviour unchanged).
  const [testnetMode, setTestnetMode] = useState(false);
  // Hydrated TokenBalance rows for each custom-token entry
  // (chain:contractAddress). Pulled from /api/market/token/<addr>
  // (DexScreener fallback when CoinGecko has no slug) so Naka Go +
  // Pleasure Coin always render with real price/logo even when the
  // wallet has zero balance.
  const [customTokenRows, setCustomTokenRows] = useState<Array<TokenBalance & { chain: string }>>([]);
  const [activeChain, setActiveChain] = useState<ChainInfo>(ETHEREUM_CHAIN);
  const [multiChainBalances, setMultiChainBalances] = useState<Record<string, WalletData | null>>({});
  const [multiChainLoading, setMultiChainLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'crypto' | 'watchlist' | 'nfts' | 'activity' | 'dapps'>('crypto');
  const [hideBalance, setHideBalance] = useState(false);
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [tokenSort, setTokenSort] = useState<'value' | 'name' | 'balance'>('value');
  const [prices, setPrices] = useState<Record<string, { usd: number; usd_24h_change: number }>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [defaultWalletAddress, setDefaultWalletAddress] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<string>('');
  // #38 — "Add account" (derive next BIP-44 index from the active seed).
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addAcctPwd, setAddAcctPwd] = useState('');
  const [addAcctBusy, setAddAcctBusy] = useState(false);
  const [addAcctError, setAddAcctError] = useState<string | null>(null);
  // #42 — hardware wallet connect status.
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
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
        // Shape-aware key: EVM folds to lowercase, Solana keeps its case, so
        // two distinct Solana wallets can't collide into one map entry.
        for (const w of cloudWallets) byAddr.set(normalizeAddress(w.address), w);
        for (const w of localWallets) byAddr.set(normalizeAddress(w.address), w);
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
      } finally {
        if (!cancelled) setHydrated(true);
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
    ];
    const stored = localStorage.getItem('steinz_custom_tokens');
    const parsed: string[] = stored ? JSON.parse(stored) : [];
    let merged = parsed;
    let changed = false;
    for (const t of DEFAULT_TOKENS) {
      if (!parsed.includes(t)) { merged = [...merged, t]; changed = true; }
    }
    // One-time cleanup: an earlier build seeded "Pleasure Coin" (NSFW) as a
    // default token. Strip it from the local list AND the server so it stops
    // re-appearing via cross-device sync. Case-insensitive (EVM addrs).
    const NSFW_RE = /0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19/i;
    const nsfwKeys = merged.filter((t) => NSFW_RE.test(t));
    if (nsfwKeys.length) {
      merged = merged.filter((t) => !NSFW_RE.test(t));
      changed = true;
      for (const key of nsfwKeys) {
        void fetch(`/api/wallet/custom-tokens?key=${encodeURIComponent(key)}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
      }
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
    try {
      if (localStorage.getItem(TESTNET_MODE_KEY) === '1') setTestnetMode(true);
    } catch { /* ignore */ }
    const savedSort = localStorage.getItem('steinz_token_sort') as 'value' | 'name' | 'balance' | null;
    if (savedSort) setTokenSort(savedSort);
    const savedHideSmall = localStorage.getItem('steinz_hide_small');
    if (savedHideSmall) setHideSmallBalances(savedHideSmall === 'true');
    fetchPrices();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-device sync for custom tokens. localStorage is the offline cache;
  // user_custom_tokens (server) is the durable record. On mount we union the
  // two, render the union, and push any local-only additions up to the server
  // so a token added on one device shows up on the next.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/wallet/custom-tokens', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const { tokens } = (await res.json()) as { tokens: string[] };
        // NSFW purge must apply here too: this union effect races the mount
        // cleanup's server DELETE, so without this filter the server copy of
        // Pleasure Coin re-entered the list on every load (owner has asked
        // twice for it to be gone).
        const NSFW_RE = /0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19/i;
        const serverTokens = (Array.isArray(tokens) ? tokens : []).filter((t) => !NSFW_RE.test(t));
        const localRaw = localStorage.getItem('steinz_custom_tokens');
        const localTokens: string[] = localRaw ? JSON.parse(localRaw) : [];
        const union = Array.from(new Set([...localTokens, ...serverTokens]));
        if (cancelled) return;
        setCustomTokens(union);
        localStorage.setItem('steinz_custom_tokens', JSON.stringify(union));
        for (const key of localTokens.filter((t) => !serverTokens.includes(t))) {
          void fetch('/api/wallet/custom-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ key }),
          });
        }
      } catch {
        /* offline or signed out — the localStorage cache still works */
      }
    })();
    return () => { cancelled = true; };
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
    // Test networks aren't covered by /api/wallet-intelligence (mainnet only),
    // so read the native balance straight from the testnet RPC. Value is always
    // $0 — testnet coins have no market price and we never fake one.
    if (isTestnetChain(chain.id)) {
      try {
        const rpc = CHAIN_RPC[chain.id];
        const ethers = await import('ethers');
        const provider = new ethers.JsonRpcProvider(rpc);
        const balWei = await provider.getBalance(address);
        const balance = ethers.formatEther(balWei);
        setWalletData({
          address,
          totalBalanceUsd: '0',
          holdings: [{ symbol: chain.symbol, name: chain.name, balance, valueUsd: '0', contractAddress: null }],
          tokenCount: 1,
          chain: chain.id,
          nativeBalance: balance,
        });
      } catch (err) {
        console.error('[wallet-page] testnet balance fetch failed:', err);
        setWalletData({ address, totalBalanceUsd: '0', holdings: [], tokenCount: 0, chain: chain.id });
      } finally { setLoading(false); }
      return;
    }
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

  const fetchMultiChainBalances = useCallback(async (evmAddress: string, solanaAddress?: string) => {
    setMultiChainLoading(true);
    // Only chains the intelligence pipeline can actually price (LIVE_CHAINS),
    // intersected with the user's enabled set. Everything else stays a native-
    // placeholder row below, so the aggregate total is only ever REAL priced
    // data — never a fabricated or mislabeled figure.
    const chainsToFetch = SUPPORTED_CHAINS.filter(
      (c) => enabledChains.includes(c.id) && LIVE_CHAINS.includes(c.id),
    );
    if (chainsToFetch.length === 0) {
      setMultiChainBalances({});
      setMultiChainLoading(false);
      return;
    }
    // Single lightweight fan-out (one request → all chains) via the wallet
    // portfolio endpoint. Response is keyed by server `apiChain` (bnb → bsc,
    // Solana under the derived base58 pubkey passed as `sol`); map each entry
    // back to the client chain id so multiChainBalances stays id-keyed.
    const apiChains = chainsToFetch.map((c) => c.apiChain).join(',');
    const params = new URLSearchParams({ chains: apiChains });
    if (evmAddress) params.set('evm', evmAddress);
    if (solanaAddress) params.set('sol', solanaAddress);
    const results: Record<string, WalletData | null> = {};
    try {
      const res = await fetch(`/api/wallet/portfolio?${params.toString()}`, {
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { chains?: Record<string, { totalBalanceUsd: string; holdings: WalletData['holdings'] } | null> };
        for (const c of chainsToFetch) {
          const entry = data.chains?.[c.apiChain] ?? null;
          results[c.id] = entry
            ? ({ address: evmAddress, totalBalanceUsd: entry.totalBalanceUsd, holdings: entry.holdings ?? [], tokenCount: (entry.holdings ?? []).length, chain: c.id } as WalletData)
            : null;
        }
      } else {
        for (const c of chainsToFetch) results[c.id] = null;
      }
    } catch {
      for (const c of chainsToFetch) results[c.id] = null;
    }
    setMultiChainBalances(results);
    setMultiChainLoading(false);
  }, [enabledChains]);

  useEffect(() => {
    if (activeWallet) fetchBalances(activeWallet.address, activeChain);
  }, [activeWallet, activeChain, fetchBalances]);

  // Multi-chain net-worth fan-out. Runs once per wallet (and whenever the
  // enabled-chains set changes) rather than on every chain-pill switch, so
  // the hero "Total Balance" and the holdings list reflect the REAL combined
  // portfolio across every priced chain — EVM chains via the 0x address and
  // Solana via the derived base58 pubkey — instead of only the active chain.
  useEffect(() => {
    if (activeWallet) fetchMultiChainBalances(activeWallet.address, activeWallet.solanaAddress);
  }, [activeWallet, fetchMultiChainBalances]);

  // Deep-link hydration from the coin-detail page's Send / Receive
  // buttons. URL shape: ?action=send|receive[&chain=<id>]. If chain is
  // specified we switch the active chain so the view opens on the
  // correct asset.
  useEffect(() => {
    const action = searchParams?.get('action');
    const wantedChainId = searchParams?.get('chain');
    if (!action) return;
    if (wantedChainId) {
      // Normalize common chain-id aliases so deep-links from the market
      // detail page (which uses `bsc`, `eth`, `avax`, `matic`, `op`,
      // `arb`) resolve to the wallet page's canonical ids. Without this
      // the SUPPORTED_CHAINS.find(...) returned undefined for `bsc` and
      // the activeChain stayed as Solana — so a Deposit click on a BSC
      // token landed the user on the Solana receive view.
      const aliasMap: Record<string, string> = {
        bsc: 'bnb',
        eth: 'ethereum',
        avax: 'avalanche',
        matic: 'polygon',
        op: 'optimism',
        arb: 'arbitrum',
        ftm: 'fantom',
        cro: 'cronos',
        sol: 'solana',
        btc: 'bitcoin',
      };
      const canonical = aliasMap[wantedChainId.toLowerCase()] ?? wantedChainId;
      const c = SUPPORTED_CHAINS.find((x) => x.id === canonical);
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

  // Load hidden tokens (Manage/Customize) from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('steinz_hidden_tokens');
      if (raw) setHiddenTokens(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

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
      // Hardcoded brand metadata for the two seeded platform tokens so the
      // row always has a real logo + name even when DexScreener returns
      // empty (low-liquidity pairs can have no indexed pair on their API).
      // Any field DexScreener does supply wins over these defaults.
      const SEEDED_META: Record<string, { symbol: string; name: string; logo: string }> = {
        '0x6967b9a8c0b14849cfe8f9e5732b401433fd2898': {
          symbol: 'NAKA',
          name: 'Naka Go',
          logo: 'https://assets.coingecko.com/coins/images/32878/small/nakamoto.png',
        },
      };
      const rows = await Promise.all(customTokens.map(async (entry) => {
        const [chainId, contract] = entry.split(':');
        if (!chainId || !contract) return null;
        const seed = SEEDED_META[normalizeAddress(contract, chainId)];
        try {
          const res = await fetch(`/api/market/token/${contract}`);
          const data = res.ok ? await res.json() as {
            symbol?: string; name?: string;
            image?: { small?: string; thumb?: string };
            market_data?: { current_price?: { usd?: number } };
          } : null;
          const price = data?.market_data?.current_price?.usd ?? 0;
          const symbol = (data?.symbol ?? seed?.symbol ?? 'TKN').toUpperCase();
          const name = data?.name ?? seed?.name ?? 'Custom Token';
          const logo = data?.image?.small ?? data?.image?.thumb ?? seed?.logo;
          return {
            symbol,
            name,
            balance: '0',
            valueUsd: price > 0 ? '0' : null,
            contractAddress: contract,
            logo,
            chain: chainId,
          } as TokenBalance & { chain: string };
        } catch {
          // Full fetch failure — still surface the seeded row so users see
          // their NAKA / NSFW placeholders rather than an empty list.
          if (!seed) return null;
          return {
            symbol: seed.symbol,
            name: seed.name,
            balance: '0',
            valueUsd: null,
            contractAddress: contract,
            logo: seed.logo,
            chain: chainId,
          } as TokenBalance & { chain: string };
        }
      }));
      if (!cancelled) {
        setCustomTokenRows(rows.filter((r): r is TokenBalance & { chain: string } => r !== null));
      }
    })();
    return () => { cancelled = true; };
  }, [customTokens]);

  // CountUp animation: animates to the whole-portfolio net worth (all priced
  // chains), re-running when either the active-chain data or the multi-chain
  // fan-out resolves so the headline lands on the combined total, not one chain.
  useEffect(() => {
    const target = computePortfolioTotal(multiChainBalances, walletData, activeChain.id).total;
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
  }, [walletData, multiChainBalances, activeChain.id]);

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

  // #38 — the seed we derive new accounts from. Prefer the active wallet
  // if it's HD-seed-backed (so "Add account" grows the seed you're
  // looking at); otherwise the first seed-backed wallet. Private-key
  // imports have no mnemonic, so they can't spawn derived accounts.
  const isHdWallet = (w: StoredWallet) =>
    !!w.encryptedMnemonic && w.importMethod !== 'private_key';
  const seedSource = useMemo<StoredWallet | null>(() => {
    if (activeWallet && isHdWallet(activeWallet)) return activeWallet;
    return wallets.find(isHdWallet) ?? null;
  }, [activeWallet, wallets]);

  const openAddAccount = () => {
    setAddAcctPwd('');
    setAddAcctError(null);
    // No seed-backed wallet yet (or only private-key imports) → fall back
    // to the full create-a-new-seed flow.
    if (!seedSource) { setView('create'); return; }
    setShowAddAccount(true);
  };

  /**
   * Derive the next free BIP-44 account from the active seed and persist
   * it. Verifies the password against the source wallet, decrypts the
   * shared mnemonic, then scans indices until it finds one whose EVM
   * address collides with no existing wallet (collision-proof even if a
   * seed was imported more than once).
   */
  const addDerivedAccount = async () => {
    if (!seedSource?.encryptedMnemonic) return;
    if (wallets.length >= MAX_WALLETS) {
      setAddAcctError(`Max ${MAX_WALLETS} wallets. Remove one to add more.`);
      return;
    }
    if (!addAcctPwd) { setAddAcctError('Enter your wallet password.'); return; }
    setAddAcctBusy(true);
    setAddAcctError(null);
    try {
      const okPwd = await verifyWalletPassword(seedSource.encryptedKey, addAcctPwd);
      if (!okPwd) {
        setAddAcctError('Wrong password for this wallet. Try again.');
        return;
      }
      const mnemonic = await decryptPrivateKey(seedSource.encryptedMnemonic, addAcctPwd);
      const { deriveEvmAccount, deriveSolanaPublicKey, isValidMnemonic } = await import('@/lib/wallet/derive');
      if (!isValidMnemonic(mnemonic)) {
        setAddAcctError('Stored seed phrase is invalid; cannot derive a new account.');
        return;
      }
      // Find the first index not already represented by an existing wallet.
      let chosen: { idx: number; address: string; privateKey: string } | null = null;
      for (let idx = 0; idx < 50; idx++) {
        const acct = deriveEvmAccount(mnemonic, idx);
        const taken = wallets.some((w) => addressesEqual(w.address, acct.address, 'ethereum'));
        if (!taken) { chosen = { idx, ...acct }; break; }
      }
      if (!chosen) {
        setAddAcctError('No free account slot found for this seed.');
        return;
      }
      const encryptedKey = await encryptPrivateKey(chosen.privateKey, addAcctPwd);
      let solanaAddress: string | undefined;
      try {
        solanaAddress = deriveSolanaPublicKey(mnemonic, chosen.idx);
      } catch (err) {
        console.warn('[wallet] Solana derivation failed for derived account:', err);
      }
      const newWallet: StoredWallet = {
        address: chosen.address,
        encryptedKey,
        // Same seed as the source — copy the ciphertext so the whole
        // group shares one phrase (and one backup).
        encryptedMnemonic: seedSource.encryptedMnemonic,
        importMethod: 'generated',
        accountIndex: chosen.idx,
        name: `Account ${chosen.idx + 1}`,
        createdAt: new Date().toISOString(),
        solanaAddress,
      };
      const updated = [...wallets, newWallet];
      saveWallets(updated);
      setActiveWallet(newWallet);
      setShowAddAccount(false);
      setAddAcctPwd('');
      notifyWalletCreated(newWallet.name);
    } catch (e) {
      setAddAcctError(e instanceof Error ? e.message : 'Failed to add account.');
    } finally {
      setAddAcctBusy(false);
    }
  };

  // #42 — connect a Ledger as an EVM wallet (key stays on the device).
  const connectLedgerWallet = async () => {
    if (wallets.length >= MAX_WALLETS) {
      setLedgerError(`Max ${MAX_WALLETS} wallets. Remove one to add more.`);
      return;
    }
    setLedgerBusy(true);
    setLedgerError(null);
    try {
      const { connectLedger } = await import('@/lib/wallet/ledger');
      const { address, path } = await connectLedger();
      if (wallets.some((w) => addressesEqual(w.address, address, 'ethereum'))) {
        setLedgerError('That Ledger account is already added.');
        return;
      }
      const lw: StoredWallet = {
        address,
        encryptedKey: '',
        importMethod: 'ledger',
        derivationPath: path,
        name: `Ledger ${address.slice(0, 6)}…${address.slice(-4)}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [...wallets, lw];
      saveWallets(updated);
      setActiveWallet(lw);
      notifyWalletImported(lw.name);
      setView('main');
    } catch (e) {
      setLedgerError(e instanceof Error ? e.message : 'Could not connect Ledger. Unlock it and open the Ethereum app.');
    } finally {
      setLedgerBusy(false);
    }
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

  // Whole-portfolio net worth (all priced chains) — the same figure the hero
  // CountUp animates to. `hasMulti` gates the multi-chain 24h blend below.
  const { hasMulti: hasMultiChain, total: currentBalance } =
    computePortfolioTotal(multiChainBalances, walletData, activeChain.id);

  // Portfolio 24h change. Value-weights each priced chain's native-asset 24h%
  // (real CoinGecko data already in `prices`) by that chain's balance, giving a
  // blended figure across everything the wallet holds rather than applying one
  // chain's move to the whole balance. Falls back to the active chain's native
  // change until the multi-chain fan-out resolves. This is a native-asset proxy
  // (per-ERC20 24h deltas aren't fetched), consistent across the portfolio.
  let priceChange = prices[activeChain.id]?.usd_24h_change || 0;
  if (hasMultiChain) {
    let weighted = 0;
    let weight = 0;
    for (const [cid, data] of Object.entries(multiChainBalances)) {
      if (!data) continue;
      const tot = parseFloat(data.totalBalanceUsd || '0');
      const chg = prices[cid]?.usd_24h_change;
      if (tot > 0 && typeof chg === 'number') { weighted += tot * chg; weight += tot; }
    }
    if (weight > 0) priceChange = weighted / weight;
  }

  if (view === 'create') return <CreateWalletView onBack={() => setView('main')} onCreated={handleWalletCreated} />;
  if (view === 'import') return <ImportWalletView onBack={() => setView('main')} onImported={handleWalletImported} />;
  if (view === 'send' && activeWallet) return <SendView onBack={() => setView('main')} wallet={activeWallet} chain={activeChain} />;
  if (view === 'receive' && activeWallet) return (
    <ReceiveView
      onBack={() => setView('main')}
      // Bug §3b — when the active chain is Solana, pass the derived
      // base58 pubkey instead of the EVM 0x address. ReceiveView's
      // `addressMatchesChain` guard catches this too, but routing the
      // correct address up-front means the QR + warning logic show the
      // right thing on the first paint, not after a re-render.
      address={
        activeChain.id === 'solana'
          ? (activeWallet.solanaAddress ?? '')
          : activeWallet.address
      }
      chain={activeChain}
      // Bug §1 — let the user pick a chain right inside the receive
      // screen so they don't have to back out and reopen the flow when
      // the deep-link landed on the wrong chain. The picker only shows
      // chains the user has enabled (matches the home pill row).
      availableChains={SUPPORTED_CHAINS.filter((c) => enabledChains.includes(c.id))}
      onChangeChain={(c) => setActiveChain(c)}
    />
  );
  if (view === 'add-token') return <AddTokenView onBack={() => setView('main')} tokens={customTokens} onAdd={(t) => {
    const updated = [...customTokens, t];
    setCustomTokens(updated);
    localStorage.setItem('steinz_custom_tokens', JSON.stringify(updated));
    // Persist server-side too so the token survives a cache clear / new device.
    void fetch('/api/wallet/custom-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: t }),
    });
    setView('main');
  }} />;
  if (view === 'add-network') return <AddNetworkView
    onBack={() => setView('main')}
    enabled={enabledChains}
    chains={testnetMode ? [...SUPPORTED_CHAINS, ...TESTNET_CHAINS] : SUPPORTED_CHAINS}
    testnetMode={testnetMode}
    onTestnetModeChange={(on) => {
      setTestnetMode(on);
      try { localStorage.setItem(TESTNET_MODE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
      if (!on) {
        // Turning testnets off: drop any enabled testnet chains and bounce the
        // active chain back to a mainnet if it was a testnet.
        const cleaned = enabledChains.filter((id) => !isTestnetChain(id));
        const next = cleaned.length ? cleaned : DEFAULT_ENABLED_CHAINS;
        setEnabledChains(next);
        try { localStorage.setItem(NAKA_ENABLED_CHAINS_KEY, JSON.stringify(next)); } catch { /* quota */ }
        if (isTestnetChain(activeChain.id)) {
          const fallback = SUPPORTED_CHAINS.find((c) => c.id === 'ethereum') ?? SUPPORTED_CHAINS[0];
          setActiveChain(fallback);
          setChainFilter('all');
        }
      }
    }}
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

  // Stable token identity for hidden/customize (chain-aware, matches the IIFE).
  const tokenKeyOf = (chain: string, contractAddress: string | null | undefined, symbol: string) =>
    `${chain}:${contractAddress ? normalizeAddress(contractAddress, chain) : symbol.toLowerCase()}`;
  const isHidden = (t: { chain: string; contractAddress?: string | null; symbol: string }) =>
    hiddenTokens.has(tokenKeyOf(t.chain, t.contractAddress, t.symbol));
  const toggleHiddenToken = (t: { chain: string; contractAddress?: string | null; symbol: string }) => {
    const key = tokenKeyOf(t.chain, t.contractAddress, t.symbol);
    setHiddenTokens((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('steinz_hidden_tokens', JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  const allHoldings = (() => {
    // Base holdings from the on-chain balance fetch, plus every
    // hydrated custom token (Naka Go, Pleasure Coin, user adds).
    // Custom rows always appear even when balance is zero so the user
    // can see the price + click through to the coin-detail page.
    // Identity key for a holding: chain + contract (chain-aware normalized so
    // Solana keeps its case) or, for native assets with no contract, the
    // lowercased symbol (matches the native-placeholder key below).
    const tokenKey = (chain: string, contractAddress: string | null | undefined, symbol: string) =>
      `${chain}:${contractAddress ? normalizeAddress(contractAddress, chain) : symbol.toLowerCase()}`;
    // REAL holdings from every priced chain the multi-chain fan-out fetched,
    // not just the active chain. This is what turns the list into a true
    // cross-chain portfolio: SOL / MATIC / ARB / BNB balances all show at once
    // with their real amounts + USD values, instead of $0 native placeholders.
    // Active chain first (freshest, just re-fetched by fetchBalances), then the
    // rest of the fan-out; de-duped so a chain never double-counts.
    const onChain: Array<TokenBalance & { chain: string }> = [];
    const onChainSeen = new Set<string>();
    const pushHoldings = (chainId: string, holdings: TokenBalance[] | undefined) => {
      for (const h of holdings || []) {
        const k = tokenKey(chainId, h.contractAddress, h.symbol);
        if (onChainSeen.has(k)) continue;
        onChainSeen.add(k);
        onChain.push({ ...h, chain: chainId });
      }
    };
    pushHoldings(activeChain.id, walletData?.holdings);
    for (const [cid, data] of Object.entries(multiChainBalances)) {
      if (cid === activeChain.id || !data) continue;
      pushHoldings(cid, data.holdings);
    }
    const seen = new Set(onChain.map((t) => tokenKey(t.chain, t.contractAddress, t.symbol)));
    const customOnly = customTokenRows.filter((t) =>
      !seen.has(tokenKey(t.chain, t.contractAddress, t.symbol))
    );
    // Native-asset placeholders for every enabled chain that hasn't been
    // fetched yet (user hasn't activated that chain pill). Without this,
    // enabling Solana / Arbitrum on the Add Network screen does nothing
    // visible on the home list — the only on-chain data we have is for
    // the currently-active chain, so SOL / ARB never appeared.
    const nativePlaceholders: Array<TokenBalance & { chain: string }> = [];
    for (const chainId of enabledChains) {
      if (chainId === activeChain.id) continue;
      const c = chainById(chainId);
      if (!c) continue;
      const key = tokenKey(chainId, null, c.symbol);
      if (seen.has(key)) continue;
      nativePlaceholders.push({
        symbol: c.symbol,
        name: c.name,
        balance: '0',
        valueUsd: null,
        contractAddress: null,
        chain: chainId,
      });
      seen.add(key);
    }
    let tokens: Array<TokenBalance & { chain: string }> = [...onChain, ...customOnly, ...nativePlaceholders];
    // Enabled-chains preference — the home list only shows rows whose
    // chain the user has toggled on. Default: ETH/BNB/Polygon/SOL +
    // the two seeded custom tokens (which live on Ethereum + Polygon,
    // both enabled by default). User extends via Add Network.
    tokens = tokens.filter((t) => enabledChains.includes(t.chain));
    // Hard guard: never show testnet rows when testnet mode is off (protects
    // against a stale enabled-chains list carrying testnet ids).
    if (!testnetMode) tokens = tokens.filter((t) => !isTestnetChain(t.chain));
    // Spam-token auto-hide: airdropped scam tokens name themselves with URLs /
    // "claim" / "airdrop" / "voucher" etc. Drop those UNLESS the user added the
    // token themselves (custom list) — native + user-added tokens are never
    // touched, so this can't hide a real holding. Reversible via Add Token.
    {
      const SPAM_RE = /(https?:|www\.|\.com|\.xyz|\.io\b|\.org|t\.me|claim|airdrop|reward|voucher|visit|free\s|giveaway|\$\s)/i;
      // Build the allow-set with the SAME chain-aware key as the rows so we
      // never lowercase a raw address (Solana is case-sensitive).
      const customSet = new Set(
        customTokens
          .map((entry) => {
            const [chainId, contract] = entry.split(':');
            return chainId && contract ? tokenKeyOf(chainId, contract, '') : null;
          })
          .filter((k): k is string => k !== null),
      );
      tokens = tokens.filter((t) => {
        if (!t.contractAddress) return true; // native asset
        if (customSet.has(tokenKeyOf(t.chain, t.contractAddress, t.symbol))) return true; // user added it
        return !SPAM_RE.test(`${t.symbol} ${t.name}`);
      });
    }
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
    // Final de-dupe: a token can arrive from both the on-chain fetch and the
    // custom-token list with slightly different keys (contract vs symbol, case),
    // which surfaced as a duplicate NAKA row. Collapse by chain-aware identity,
    // keeping the first (highest-priority/highest-value) occurrence.
    const dedupeSeen = new Set<string>();
    const deduped = withPriority.map((x) => x.t).filter((t) => {
      const k = tokenKey(t.chain, t.contractAddress, t.symbol);
      if (dedupeSeen.has(k)) return false;
      dedupeSeen.add(k);
      return true;
    });
    return deduped;
  })();

  const pnlAmount = currentBalance * (priceChange / 100);
  const pnlPositive = priceChange >= 0;

  const copyAddress = () => {
    navigator.clipboard.writeText(activeWallet?.address || '');
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (view === 'customize') return (
    <CustomizeTokensView
      onBack={() => setView('main')}
      tokens={allHoldings}
      isHidden={isHidden}
      onToggle={toggleHiddenToken}
      onAddToken={() => setView('add-token')}
    />
  );

  if (view === 'approvals' && activeWallet) return (
    <ApprovalsView onBack={() => setView('main')} wallet={activeWallet} chain={activeChain} />
  );

  if (view === 'analytics' && activeWallet) return (
    <PortfolioAnalyticsView onBack={() => setView('main')} wallet={activeWallet} />
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      {buyComingSoon && (() => {
        // #30 — real fiat on-ramp when a provider is configured (env-gated),
        // else an honest "coming soon" state. Delivers to the address on the
        // active chain's correct network (Solana uses the derived SOL address).
        const onrampAddress = activeChain.id === 'solana' ? (activeWallet?.solanaAddress ?? '') : (activeWallet?.address ?? '');
        const onrampUrl = onrampAddress ? getOnrampUrl({ address: onrampAddress, chain: activeChain.id }) : null;
        return (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setBuyComingSoon(false)}>
            <div className="w-full max-w-sm nl-glass rounded-2xl p-6 text-center" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 26px rgba(0,102,255,.25)' }} onClick={(e) => e.stopPropagation()}>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#1233AE)', boxShadow: '0 0 18px rgba(0,102,255,.5)' }}>
                <ShoppingCart className="w-7 h-7 text-white" />
              </div>
              {onrampUrl ? (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">Buy crypto with card</h3>
                  <p className="text-sm text-slate-400 mb-2">
                    You&apos;ll be taken to our payment partner to buy {activeChain.symbol} with a card or bank transfer, delivered straight to this wallet on {activeChain.name}.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mb-5 break-all">{onrampAddress.slice(0, 8)}…{onrampAddress.slice(-6)}</p>
                  <a
                    href={onrampUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setBuyComingSoon(false)}
                    className="block w-full py-3 rounded-xl font-bold text-white text-sm mb-2"
                    style={{ background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 18px rgba(0,102,255,.5)' }}
                  >
                    Continue to payment ↗
                  </a>
                  <button onClick={() => setBuyComingSoon(false)} className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">Buy with card — Coming soon</h3>
                  <p className="text-sm text-slate-400 mb-5">
                    {onrampAddress
                      ? `Card / bank on-ramp isn't available for ${activeChain.name} yet. It's launching shortly, delivered straight to your wallet.`
                      : 'Fiat on-ramp is launching shortly. You’ll be able to buy crypto with a card or bank transfer, delivered straight to your wallet.'}
                  </p>
                  <button onClick={() => setBuyComingSoon(false)} className="w-full py-3 rounded-xl font-bold text-white text-sm" style={{ background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 18px rgba(0,102,255,.5)' }}>Got it</button>
                </>
              )}
            </div>
          </div>
        );
      })()}
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-600/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4">

        {!hydrated ? (
          /* Bug §5.1 — skeleton until hydrate finishes, so we never flash
             the Create-Wallet CTA at a user who already has wallets. */
          <div className="pt-12 space-y-4">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-slate-900/40 animate-pulse" />
            <div className="h-6 w-40 mx-auto rounded bg-slate-900/40 animate-pulse" />
            <div className="h-4 w-56 mx-auto rounded bg-slate-900/40 animate-pulse" />
            <div className="h-14 w-full rounded-2xl bg-slate-900/40 animate-pulse mt-8" />
            <div className="h-14 w-full rounded-2xl bg-slate-900/40 animate-pulse" />
          </div>
        ) : wallets.length === 0 ? (
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
              <button onClick={() => setView('import')} className="w-full py-4 nl-glass rounded-2xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-slate-800/80">
                <Download className="w-5 h-5" /> Import Existing Wallet
              </button>
            </div>
            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-start">
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
              <BackButton />
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
                <HowItWorksButton content={walletHowItWorks} className="ms-auto shrink-0" />
              </div>
            </div>

            {/* FIX 5A.1 / Phase 4: prominent backup reminder. User confirmed they haven't backed up
                their seed — without this banner the reveal flow in settings is hard to discover. */}
            {activeWallet && typeof window !== 'undefined' && !localStorage.getItem(`naka_seed_backed_up_${activeWallet.address}`) && (
              <button
                onClick={() => setView('wallet-settings')}
                className="w-full mb-3 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-start hover:bg-amber-500/15 transition-colors"
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
                  {!hideBalance && (hasMultiChain || LIVE_CHAINS.includes(activeChain.id)) && priceChange !== 0 && (
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
                <button onClick={() => { if (activeWallet) { fetchBalances(activeWallet.address, activeChain); fetchMultiChainBalances(activeWallet.address, activeWallet.solanaAddress); fetchPrices(); } }} disabled={loading} className="p-2 hover:bg-white/5 rounded-xl transition-colors ms-2 mt-1">
                  <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* ── 4 ACTION BUTTONS ─────────────────────────── */}
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Send', icon: <ArrowUpRight className="w-6 h-6" />, color: 'var(--nl-blue)', action: () => setView('send'), enabled: EVM_LIVE_CHAINS.includes(activeChain.id) || activeChain.id === 'solana' || isTestnetChain(activeChain.id) },
                { label: 'Receive', icon: <ArrowDownLeft className="w-6 h-6" />, color: 'var(--nl-success)', action: () => setView('receive'), enabled: true },
                { label: 'Swap', icon: <Repeat className="w-6 h-6" />, color: '#8B5CF6', action: () => router.push('/dashboard/swap?from=wallet'), enabled: true },
                { label: 'Buy', icon: <ShoppingCart className="w-6 h-6" />, color: 'var(--nl-warning)', action: () => setBuyComingSoon(true), enabled: true },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  disabled={!btn.enabled}
                  style={btn.enabled ? { boxShadow: '0 0 0 1px rgba(0,102,255,.45), 0 0 16px rgba(0,102,255,.2)' } : undefined}
                  className={`nl-glass flex flex-col items-center justify-center gap-2 rounded-2xl min-h-[80px] p-3 transition-all duration-200 ${
                    btn.enabled
                      ? 'hover:-translate-y-0.5 active:scale-95'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div style={{ color: btn.enabled ? btn.color : '#64748b' }}>{btn.icon}</div>
                  <span className="text-xs font-semibold text-white">{btn.label}</span>
                  {!btn.enabled && <span className="text-[8px] text-slate-500 -mt-1">Soon</span>}
                </button>
              ))}
            </div>

            {/* Chain-filter chip row removed per product direction — each coin
                row already shows its chain, so the chips were redundant. The
                `chainFilter` state stays 'all'; search + the holdings list
                cover discovery. */}

            {/* ── SEARCH + SORT BAR ────────────────────────── */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 flex items-center gap-2 nl-glass rounded-xl px-3 py-2.5">
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
                className="nl-glass rounded-xl px-3 py-2.5 text-xs text-slate-400 focus:outline-none focus:border-blue-500/40 shrink-0"
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

            {/* ── TAB SWITCHER: Holdings / NFTs / Activity ─────────── */}
            <div className="flex items-center gap-1 mb-3 rounded-xl nl-glass p-1" role="tablist" aria-label="Wallet content">
              {([
                { id: 'crypto' as const, label: 'Holdings' },
                { id: 'watchlist' as const, label: 'Watchlist' },
                { id: 'nfts' as const, label: 'NFTs' },
                { id: 'activity' as const, label: 'Activity' },
                { id: 'dapps' as const, label: 'dApps' },
              ]).map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  aria-controls={`wallet-panel-${t.id}`}
                  id={`wallet-tab-${t.id}`}
                  onClick={() => setActiveTab(t.id)}
                  style={activeTab === t.id ? { background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 14px rgba(0,102,255,.5), inset 0 1px 0 rgba(255,255,255,.2)' } : undefined}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === t.id ? 'text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'watchlist' && (
              <div role="tabpanel" id="wallet-panel-watchlist" aria-labelledby="wallet-tab-watchlist" className="mb-6">
                <WatchlistTab />
              </div>
            )}

            {activeTab === 'dapps' && (
              <div role="tabpanel" id="wallet-panel-dapps" aria-labelledby="wallet-tab-dapps" className="mb-6">
                <DappDirectory solanaAddress={activeWallet?.solanaAddress} />
              </div>
            )}

            {activeTab === 'nfts' && activeWallet && (
              <div
                role="tabpanel"
                id="wallet-panel-nfts"
                aria-labelledby="wallet-tab-nfts"
                className="mb-6 rounded-xl nl-glass overflow-hidden"
              >
                <NftTab evmAddress={activeWallet.address} solanaAddress={activeWallet.solanaAddress} />
              </div>
            )}

            {activeTab === 'activity' && activeWallet && (
              <div
                role="tabpanel"
                id="wallet-panel-activity"
                aria-labelledby="wallet-tab-activity"
                className="mb-6 rounded-xl nl-glass p-3"
              >
                <ActivityTab address={activeWallet.address} chain={activeChain} enabledChains={enabledChains} />
              </div>
            )}

            {/* ── ASSETS LIST (Trust Wallet-style vertical rows) ──────── */}
            <div
              role="tabpanel"
              id="wallet-panel-crypto"
              aria-labelledby="wallet-tab-crypto"
              hidden={activeTab !== 'crypto'}
              // The Tailwind `flex` class overrides the native [hidden] display:none
              // (equal specificity, utilities win), which leaked the holdings list
              // under the Watchlist/NFTs/Activity tabs. Force display via inline
              // style so each tab is a true full page.
              style={{ display: activeTab === 'crypto' ? 'flex' : 'none' }}
              className="flex flex-col mb-6 divide-y divide-slate-900/60"
            >
              {loading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-[64px] bg-slate-900/30 my-1 rounded-xl animate-pulse" />
                  ))}
                </>
              ) : allHoldings.filter((t) => !isHidden(t)).length > 0 ? (
                allHoldings.filter((t) => !isHidden(t)).map((token, i) => {
                  // Logo resolution order: native-symbol map (ETH/SOL/…), then
                  // per-token logo the hydrator pulled from CoinGecko (gives
                  // Naka Go / Pleasure Coin their real branded icons), then
                  // per-contract overrides as a final safety net.
                  const contractKey = token.contractAddress ? normalizeAddress(token.contractAddress, token.chain) : '';
                  const CONTRACT_LOGOS: Record<string, string> = {
                    '0x6967b9a8c0b14849cfe8f9e5732b401433fd2898':
                      'https://assets.coingecko.com/coins/images/32878/small/nakamoto.png',
                  };
                  const rowChain = chainById(token.chain);
                  // Owner spec (2026-07-03): L2 natives (ETH on Arbitrum / Base /
                  // Optimism…) show the CHAIN's own logo as the main icon with a
                  // small Ethereum badge overlaid — matching how BNB / MATIC rows
                  // carry their chain badge. Ethereum-mainnet ETH keeps the plain
                  // ETH logo with no badge.
                  const isL2Native = token.symbol.toUpperCase() === 'ETH'
                    && !!rowChain && rowChain.id !== 'ethereum' && !token.contractAddress;
                  // The balance API ships holdings[].logoUrl (Alchemy metadata /
                  // DexScreener image) — the old read of `.logo` only matched
                  // custom-token rows, so every on-chain ERC-20 outside the
                  // COIN_LOGOS map fell back to a letter avatar.
                  const logoUrl = isL2Native
                    ? rowChain.logoUrl
                    : (COIN_LOGOS as Record<string, string>)[token.symbol.toUpperCase()]
                      || (token as { logo?: string }).logo
                      || (token as { logoUrl?: string }).logoUrl
                      || CONTRACT_LOGOS[contractKey];
                  return (
                    <WalletTokenRow
                      key={`${token.chain}-${token.symbol}-${i}`}
                      symbol={token.symbol}
                      name={token.name}
                      balance={token.balance}
                      valueUsd={token.valueUsd}
                      contractAddress={token.contractAddress}
                      logoUrl={logoUrl}
                      chainLabel={rowChain?.name ?? ''}
                      // L2 natives carry the ETH badge on the chain logo (owner
                      // spec); every other token keeps its network badge.
                      chainLogoUrl={isL2Native ? COIN_LOGOS.ETH : rowChain?.logoUrl}
                      // Testnet tokens get NO price lookup (empty id) so we never
                      // render a mainnet USD price against a worthless test coin.
                      coinGeckoId={isTestnetChain(token.chain)
                        ? ''
                        : resolveCoinGeckoId(token.symbol, chainById(token.chain) ?? activeChain)}
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
                <FundWalletEmpty onFund={() => setView('receive')} onManage={() => setView('customize')} />
              )}

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setView('add-network')} className="nl-glass py-3 rounded-xl text-[11px] text-slate-200 hover:-translate-y-px flex items-center justify-center gap-1.5 transition-all" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}>
                  <Plus className="w-3.5 h-3.5 text-blue-300" /> Network
                </button>
                <button onClick={() => setView('add-token')} className="nl-glass py-3 rounded-xl text-[11px] text-slate-200 hover:-translate-y-px flex items-center justify-center gap-1.5 transition-all" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}>
                  <Plus className="w-3.5 h-3.5 text-blue-300" /> Add Token
                </button>
              </div>
            </div>

            {/* Recent Activity container removed from wallet home — lives on the
                dedicated Transactions page (/dashboard/transactions). */}

            {/* ── SECURITY SECTION ─────────────────────────── */}
            <div className="mb-5 nl-glass rounded-xl overflow-hidden">
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
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">Token approvals</p>
                        <p className="text-xs text-slate-500">Review &amp; revoke spending permissions</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setView('approvals')}
                      disabled={!EVM_LIVE_CHAINS.includes(activeChain.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-colors"
                    >
                      {EVM_LIVE_CHAINS.includes(activeChain.id) ? 'Review' : 'EVM only'}
                    </button>
                  </div>
                  {activeWallet && <BiometricUnlockRow encryptedKey={activeWallet.encryptedKey} />}
                  {/* "View on Solscan/Explorer" button removed per product
                      direction — users stay inside Naka; explorer links live
                      on individual activity rows if needed. */}
                </div>
              )}
            </div>

            {/* ── ADVANCED ─────────────────────────────────── */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Advanced</h2>
              {/* #43 — connect this wallet to external dApps (WalletConnect). */}
              <DappConnect />
              <button
                onClick={() => setView('analytics')}
                className="w-full mb-2 py-3 nl-glass rounded-xl text-xs font-semibold hover:-translate-y-px flex items-center justify-center gap-1.5 transition-all"
                style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Portfolio Analytics
              </button>
              <div className="flex gap-2">
                <button
                  onClick={openAddAccount}
                  disabled={wallets.length >= MAX_WALLETS}
                  className="flex-1 py-3 nl-glass rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Account
                </button>
                <button
                  onClick={() => setView('import')}
                  disabled={wallets.length >= MAX_WALLETS}
                  className="flex-1 py-3 nl-glass rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" /> Import Wallet
                </button>
              </div>
              {wallets.length >= MAX_WALLETS && (
                <p className="text-xs text-amber-400 mt-2 text-center">Max {MAX_WALLETS} wallets. Remove one to add more.</p>
              )}
              {/* #42 — hardware wallet (Ledger, EVM). Key never leaves the device. */}
              <button
                onClick={() => void connectLedgerWallet()}
                disabled={ledgerBusy || wallets.length >= MAX_WALLETS}
                className="w-full mt-2 py-3 nl-glass rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {ledgerBusy
                  ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting Ledger…</>)
                  : (<><Shield className="w-3.5 h-3.5 text-blue-400" /> Connect Ledger (hardware)</>)}
              </button>
              {ledgerError && (
                <p className="text-xs text-amber-400 mt-2 text-center">{ledgerError}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── ADD ACCOUNT (DERIVE NEXT SEED INDEX) MODAL ───── */}
      {showAddAccount && seedSource && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => { if (!addAcctBusy) setShowAddAccount(false); }} />
          <div className="relative w-full max-w-[360px] mx-4 nl-glass rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#0066FF]/10 border border-[#0066FF]/30 flex items-center justify-center">
                <Plus className="w-4 h-4 text-[#0066FF]" />
              </div>
              <h3 className="text-sm font-bold text-white">Add account</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Derives the next account from <span className="text-slate-300 font-medium">{seedSource.name}</span>&rsquo;s
              seed phrase — one backup covers every account. Enter that
              wallet&rsquo;s password to continue.
            </p>
            <input
              type="password"
              value={addAcctPwd}
              onChange={(e) => { setAddAcctPwd(e.target.value); if (addAcctError) setAddAcctError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !addAcctBusy) void addDerivedAccount(); }}
              autoComplete="current-password"
              placeholder="Wallet password"
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0066FF]/50"
            />
            {addAcctError && (
              <p className="text-[11px] text-[#EF4444] mt-2 bg-[#EF4444]/5 px-3 py-2 rounded-lg border border-[#EF4444]/15" role="alert">
                {addAcctError}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAddAccount(false)}
                disabled={addAcctBusy}
                className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void addDerivedAccount()}
                disabled={addAcctBusy || !addAcctPwd}
                className="flex-1 py-2.5 bg-[#0066FF] hover:bg-[#0818CC] rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                {addAcctBusy ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deriving…</>) : 'Add account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ─────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-[320px] mx-4 nl-glass rounded-2xl p-5 shadow-2xl">
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
      <div className="text-end">
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
  // Seed-backup verification (industry standard: re-pick a few words before the
  // wallet is finalized, so the user proves they actually wrote it down).
  const [verifyTargets, setVerifyTargets] = useState<{ index: number; options: string[] }[]>([]);
  const [verifyPicks, setVerifyPicks] = useState<Record<number, string>>({});

  // Build 3 challenges from 3 distinct random word positions; each offers the
  // correct word plus 3 decoys drawn from the rest of the phrase, shuffled.
  const startVerification = () => {
    const words = mnemonic.split(' ');
    const shuffle = <T,>(a: T[]) => a.map((v) => ({ v, r: Math.random() })).sort((x, y) => x.r - y.r).map((o) => o.v);
    const indices = shuffle(words.map((_, i) => i)).slice(0, 3).sort((a, b) => a - b);
    const targets = indices.map((index) => {
      const correct = words[index];
      const decoys = shuffle(words.filter((w) => w !== correct)).slice(0, 3);
      return { index, options: shuffle([correct, ...decoys]) };
    });
    setVerifyTargets(targets);
    setVerifyPicks({});
    setStep('confirm');
  };

  const verifyAllCorrect =
    verifyTargets.length === 3 &&
    verifyTargets.every((t) => verifyPicks[t.index] === mnemonic.split(' ')[t.index]);

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
    // Audit B3 / P0 #1 — derive the Solana address at create time from
    // the same BIP-39 seed so Receive on Solana works without a second
    // wallet. Phantom-compatible path m/44'/501'/0'/0'.
    let solanaAddress: string | undefined;
    if (mnemonic) {
      try {
        const { deriveSolanaPublicKey } = await import('@/lib/wallet/derive');
        solanaAddress = deriveSolanaPublicKey(mnemonic);
      } catch (err) {
        // Non-fatal — wallet creation still succeeds; the user just
        // won't have a SOL address (Receive panel will show its
        // honest "no SOL address derived" state).
        console.warn('[wallet] Solana derivation failed at create:', err);
      }
    }
    onCreated({
      address,
      encryptedKey: encrypted,
      encryptedMnemonic,
      importMethod: 'generated',
      accountIndex: 0,
      name: walletName,
      createdAt: new Date().toISOString(),
      solanaAddress,
    });
  };

  const handleCopyPhrase = () => {
    navigator.clipboard.writeText(mnemonic);
    setPhraseCopied(true);
    setTimeout(() => setPhraseCopied(false), 2500);
  };

  return (
    <div className="min-h-screen text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-sm hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#0066FF]/20 to-[#7C3AED]/20 rounded-3xl flex items-center justify-center border border-[#0066FF]/20">
            <SteinzLogo size={48} />
          </div>
          <h1 className="text-2xl font-heading font-bold mb-1">Create New Wallet</h1>
          <p className="text-gray-400 text-sm">Your keys, your crypto</p>
        </div>

        {step === 'password' && (
          <div className="space-y-5">
            <div>
              <label className="text-sm text-gray-300 mb-2 block font-medium">Wallet Name</label>
              <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-[#0066FF]/50 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-2 block font-medium">Set Password (min 8 chars)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-[#0066FF]/50 transition-colors" placeholder="Secure password to encrypt your keys" />
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
            <button onClick={createWallet} disabled={password.length < 8 || creating} className="w-full py-4 bg-[#0066FF] hover:bg-[#0818CC] rounded-xl font-bold text-base disabled:opacity-50 transition-colors shadow-lg shadow-[#0066FF]/20">
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
              <p className="text-sm font-mono text-[#0066FF] break-all">{address}</p>
            </div>

            <button type="button" onClick={() => setConfirmed(!confirmed)} className="flex items-center gap-3 cursor-pointer p-3 bg-[#111827] rounded-xl border border-white/5 w-full text-start">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${confirmed ? 'bg-[#0066FF] border-[#0066FF]' : 'border-white/20 bg-transparent'}`}>
                {confirmed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm text-gray-300">I have saved my recovery phrase securely</span>
            </button>

            <button onClick={startVerification} disabled={!confirmed} className="w-full py-4 bg-[#0066FF] hover:bg-[#0818CC] rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#0066FF]/20">
              <Check className="w-5 h-5" /> Continue
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 bg-[#0066FF]/5 border border-[#0066FF]/15 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-[#0066FF]" />
                <span className="text-sm font-bold text-[#0066FF]">Confirm your recovery phrase</span>
              </div>
              <p className="text-xs text-gray-400">Select the correct word for each position to prove you saved it. This is the only way to recover your wallet.</p>
            </div>

            {verifyTargets.map((t) => (
              <div key={t.index} className="p-3 bg-[#111827] rounded-xl border border-white/5">
                <p className="text-xs text-gray-400 mb-2 font-medium">Word #{t.index + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  {t.options.map((opt) => {
                    const picked = verifyPicks[t.index] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setVerifyPicks((p) => ({ ...p, [t.index]: opt }))}
                        className={`py-2.5 rounded-lg text-sm font-mono font-semibold border transition-all ${
                          picked ? 'bg-[#0066FF]/20 border-[#0066FF]/60 text-white' : 'bg-white/[0.03] border-white/10 text-gray-300 hover:border-white/25'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={() => setStep('phrase')} className="px-4 py-3.5 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 text-gray-300 transition-colors">
                Back
              </button>
              <button onClick={confirmAndSave} disabled={!verifyAllCorrect} className="flex-1 py-3.5 bg-[#0066FF] hover:bg-[#0818CC] rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#0066FF]/20">
                <Check className="w-5 h-5" /> Confirm &amp; Create
              </button>
            </div>
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
      // Audit B3 / P0 #1 — when the user imported a real BIP-39 seed,
      // derive the Solana account from the same phrase so a single
      // import gives them every chain. Raw private-key imports cannot
      // derive Solana (no seed to walk down BIP-44 from), so those
      // continue to surface the "no SOL address" Receive panel.
      let solanaAddress: string | undefined;
      if (phraseForStorage) {
        try {
          const { deriveSolanaPublicKey } = await import('@/lib/wallet/derive');
          solanaAddress = deriveSolanaPublicKey(phraseForStorage);
        } catch (err) {
          console.warn('[wallet] Solana derivation failed at import:', err);
        }
      }
      onImported({
        address: wallet.address,
        encryptedKey: encrypted,
        encryptedMnemonic,
        importMethod: method === 'phrase' ? 'seed' : 'private_key',
        // Seed imports land at BIP-44 index 0 (ethers' default path), so
        // "Add account" derives index 1+ from here. Private-key imports
        // have no seed and stay index-less.
        accountIndex: method === 'phrase' ? 0 : undefined,
        name: walletName,
        createdAt: new Date().toISOString(),
        solanaAddress,
      });
    } catch (e: any) { setError(e.message || 'Invalid input. Check your recovery phrase or private key.'); }
    finally { setImporting(false); }
  };

  return (
    <div className="min-h-screen text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0066FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Import Wallet</h1>
            <p className="text-gray-400 text-xs">Recovery phrase or private key</p>
          </div>
        </div>

        <div className="flex gap-2 mb-5 bg-[#111827] rounded-xl p-1">
          <button onClick={() => setMethod('phrase')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${method === 'phrase' ? 'bg-gradient-to-r from-[#0066FF] to-[#7C3AED] text-white' : 'text-gray-400'}`}>
            Recovery Phrase
          </button>
          <button onClick={() => setMethod('key')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${method === 'key' ? 'bg-gradient-to-r from-[#0066FF] to-[#7C3AED] text-white' : 'text-gray-400'}`}>
            Private Key
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Wallet Name</label>
            <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0066FF]/50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">{method === 'phrase' ? 'Recovery Phrase (12 or 24 words)' : 'Private Key'}</label>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              rows={method === 'phrase' ? 4 : 2}
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#0066FF]/50 resize-none"
              placeholder={method === 'phrase' ? 'word1 word2 word3 ...' : '0x...'} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Set Password (min 8 chars)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0066FF]/50" placeholder="Encrypt your keys" />
          </div>
          {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/5 p-3 rounded-xl border border-[#EF4444]/10">{error}</p>}
          <button onClick={handleImport} disabled={importing || !input.trim() || password.length < 8} className="w-full py-3.5 bg-gradient-to-r from-[#0066FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
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
  // Robinhood Chain — native ETH send + balance read via the chain's own RPC.
  robinhood: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    ? `https://robinhood-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    : 'https://rpc.mainnet.chain.robinhood.com',
  fantom: 'https://rpc.ftm.tools',
  // #53 — additional EVM networks (public RPCs).
  linea: 'https://rpc.linea.build',
  scroll: 'https://rpc.scroll.io',
  zksync: 'https://mainnet.era.zksync.io',
  mantle: 'https://rpc.mantle.xyz',
  blast: 'https://rpc.blast.io',
  mode: 'https://mainnet.mode.network',
  gnosis: 'https://rpc.gnosischain.com',
  celo: 'https://forno.celo.org',
  metis: 'https://andromeda.metis.io/?owner=1088',
  moonbeam: 'https://rpc.api.moonbeam.network',
  opbnb: 'https://opbnb-mainnet-rpc.bnbchain.org',
  manta: 'https://pacific-rpc.manta.network/http',
  zora: 'https://rpc.zora.energy',
  aurora: 'https://mainnet.aurora.dev',
  kava: 'https://evm.kava.io',
  // Test networks (real public RPCs).
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  'base-sepolia': 'https://sepolia.base.org',
  'arbitrum-sepolia': 'https://sepolia-rollup.arbitrum.io/rpc',
  'polygon-amoy': 'https://rpc-amoy.polygon.technology',
  'bnb-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
};

function isValidAddressForChain(addr: string, chainId: string): boolean {
  if (chainId === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  if (chainId === 'bitcoin') return /^(bc1|[13])[a-zA-Z0-9]{25,62}$/.test(addr);
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// Native-asset CoinGecko id per chain — for the ≈USD amount preview.
const NATIVE_CG_ID: Record<string, string> = {
  ethereum: 'ethereum', base: 'ethereum', arbitrum: 'ethereum', optimism: 'ethereum',
  polygon: 'matic-network', avalanche: 'avalanche-2', bnb: 'binancecoin', fantom: 'fantom',
  solana: 'solana', robinhood: 'ethereum',
};

const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

function shortAddr(a: string): string {
  return a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

// Multi-step Send flow (Phantom/Trust pattern, Naka glass-blue style):
//   form → confirm → password → processing → sent (with block-explorer link).
// Hard-validates amount ≤ balance (incl. gas) before letting the user advance.
function SendView({ onBack, wallet, chain }: { onBack: () => void; wallet: StoredWallet; chain: ChainInfo }) {
  type Step = 'form' | 'confirm' | 'password' | 'processing' | 'sent';
  const [step, setStep] = useState<Step>('form');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pwError, setPwError] = useState('');
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [nativeUsd, setNativeUsd] = useState<number | null>(null);
  const [gasEstimateEth, setGasEstimateEth] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [txNonce, setTxNonce] = useState<number | null>(null);
  // Live confirmation tracking on the sent screen (was hardcoded "Pending").
  const [txStatus, setTxStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  const [confirmations, setConfirmations] = useState(0);
  // Gas speed — scales the EIP-1559 fee (or legacy gasPrice) for EVM sends.
  const [feeSpeed, setFeeSpeed] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [ensAddr, setEnsAddr] = useState<string | null>(null);
  const [ensLoading, setEnsLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [contacts, setContacts] = useState<Array<{ id: string; label: string; address: string; chain: string | null }>>([]);
  const [saved, setSaved] = useState(false);

  // Live tx confirmation polling — once a tx is broadcast, poll the chain until
  // it confirms or fails so the sent screen shows the real status + confirmation
  // count instead of a permanent "Pending".
  useEffect(() => {
    if (step !== 'sent' || !txHash) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        if (chain.id === 'solana') {
          const web3 = await import('@solana/web3.js');
          const conn = new web3.Connection(SOLANA_RPC, 'confirmed');
          const st = (await conn.getSignatureStatus(txHash)).value;
          if (st?.err) { if (!cancelled) setTxStatus('failed'); return; }
          if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') {
            if (!cancelled) { setTxStatus('confirmed'); setConfirmations(1); }
            return;
          }
        } else {
          const rpc = CHAIN_RPC[chain.id];
          if (!rpc) return;
          const ethers = await import('ethers');
          const provider = new ethers.JsonRpcProvider(rpc);
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt) {
            const conf = await receipt.confirmations();
            if (!cancelled) {
              setConfirmations(Number(conf));
              // status === 0 is a revert; 1 or null (some chains omit it) = mined OK.
              setTxStatus(receipt.status === 0 ? 'failed' : 'confirmed');
            }
            if (receipt.status === 0 || Number(conf) >= 2) return; // terminal
          }
        }
      } catch { /* transient RPC error — keep polling */ }
      if (!cancelled) timer = setTimeout(poll, 4000);
    };
    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [step, txHash, chain.id]);

  // Native balance — powers MAX + the >balance guard.
  useEffect(() => {
    if (chain.id === 'bitcoin') return;
    let cancelled = false;
    (async () => {
      try {
        if (chain.id === 'solana') {
          const sol = wallet.solanaAddress;
          if (!sol) return;
          const web3 = await import('@solana/web3.js');
          const conn = new web3.Connection(SOLANA_RPC, 'confirmed');
          const lamports = await conn.getBalance(new web3.PublicKey(sol));
          if (!cancelled) setNativeBalance((lamports / web3.LAMPORTS_PER_SOL).toString());
          return;
        }
        const rpc = CHAIN_RPC[chain.id];
        if (!rpc) return;
        const ethers = await import('ethers');
        const provider = new ethers.JsonRpcProvider(rpc);
        const bal = await provider.getBalance(wallet.address);
        if (!cancelled) setNativeBalance(ethers.formatEther(bal));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [chain.id, wallet.address, wallet.solanaAddress]);

  // Native USD price for the ≈$ preview.
  useEffect(() => {
    const id = NATIVE_CG_ID[chain.id];
    if (!id) return;
    let cancelled = false;
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.[id]?.usd) setNativeUsd(d[id].usd); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chain.id]);

  // ENS resolution (.eth) — resolve to a 0x address on mainnet before send so
  // users can send to a domain and never fat-finger a hex address.
  const isEns = /\.eth$/i.test(to.trim());
  useEffect(() => {
    if (!isEns) { setEnsAddr(null); return; }
    let cancelled = false;
    setEnsLoading(true); setEnsAddr(null);
    const t = setTimeout(async () => {
      try {
        const ethers = await import('ethers');
        const provider = new ethers.JsonRpcProvider(CHAIN_RPC.ethereum);
        const resolved = await provider.resolveName(to.trim());
        if (!cancelled) setEnsAddr(resolved && /^0x[a-fA-F0-9]{40}$/.test(resolved) ? resolved : null);
      } catch { if (!cancelled) setEnsAddr(null); }
      finally { if (!cancelled) setEnsLoading(false); }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [to, isEns]);

  // Load the address book once.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/wallet/contacts').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!cancelled && d?.contacts) setContacts(d.contacts);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const saveContact = async () => {
    const addr = recipient;
    if (!addr) return;
    try {
      const res = await fetch('/api/wallet/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: shortAddr(addr), address: addr, chain: chain.id }),
      });
      if (res.ok) setSaved(true);
    } catch { /* ignore */ }
  };

  const recipient = (ensAddr || to).trim();
  const amtNum = parseFloat(amount) || 0;
  const balNum = parseFloat(nativeBalance) || 0;
  const overBalance = amtNum > balNum;
  const validAddr = isEns ? !!ensAddr : (!!to && isValidAddressForChain(to, chain.id));
  const usdValue = nativeUsd != null && amtNum > 0 ? amtNum * nativeUsd : null;
  const canProceed = validAddr && amtNum > 0 && !overBalance;

  const setMax = async () => {
    try {
      const ethers = await import('ethers');
      const rpc = CHAIN_RPC[chain.id];
      if (!rpc) { setAmount(nativeBalance); return; }
      const provider = new ethers.JsonRpcProvider(rpc);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(0);
      // Reserve gas at the FAST rate (130%) so a MAX send still clears even if
      // the user bumps speed to Fast on the next step.
      const reserved = (gasPrice * BigInt(130) / BigInt(100)) * BigInt(21000);
      const bal = ethers.parseEther(nativeBalance || '0');
      const max = bal > reserved ? bal - reserved : BigInt(0);
      setAmount(ethers.formatEther(max));
    } catch { setAmount(nativeBalance); }
  };

  // Estimate gas, then advance to the confirm step.
  const goConfirm = async () => {
    if (!canProceed) return;
    setError('');
    try {
      const ethers = await import('ethers');
      const rpc = CHAIN_RPC[chain.id];
      if (rpc) {
        const provider = new ethers.JsonRpcProvider(rpc);
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(0);
        setGasEstimateEth(ethers.formatEther(gasPrice * BigInt(21000)));
      }
    } catch { /* fee preview is best-effort */ }
    setStep('confirm');
  };

  const handleSend = async () => {
    // #42 — Ledger wallets sign on the device; no password needed.
    const isLedger = wallet.importMethod === 'ledger';
    if (!isLedger && !password) { setPwError('Enter your wallet password.'); return; }
    setPwError(''); setStep('processing');
    try {
      if (chain.id === 'solana') {
        if (isLedger) {
          setError('Ledger is EVM-only in Naka — switch to an EVM network to send from this wallet.');
          setStep('confirm'); return;
        }
        // Native SOL transfer. Needs the seed phrase to derive the signing
        // keypair — raw-private-key imports have no Solana key.
        if (!wallet.encryptedMnemonic) {
          setPwError('Solana send needs a seed-phrase wallet (this wallet was imported by private key).');
          setStep('password'); return;
        }
        const web3 = await import('@solana/web3.js');
        const { deriveSolanaKeypair } = await import('@/lib/wallet/derive');
        let mnemonic: string;
        try { mnemonic = await decryptPrivateKey(wallet.encryptedMnemonic, password); }
        catch { setPwError('Wrong wallet password.'); setStep('password'); return; }
        // #38 — derive at THIS account's BIP-44 index, not always 0, so
        // derived accounts sign with their own key.
        const keypair = deriveSolanaKeypair(mnemonic, wallet.accountIndex ?? 0);
        // Funds-safety guard: the signing key must match the address we
        // display/send from. A mismatch means a wrong-index derivation —
        // abort before broadcasting rather than move funds from the wrong
        // account.
        if (wallet.solanaAddress && keypair.publicKey.toBase58() !== wallet.solanaAddress) {
          setPwError('Derived signing key does not match this account. Aborted for safety.');
          setStep('password');
          return;
        }
        const conn = new web3.Connection(SOLANA_RPC, 'confirmed');
        const lamports = Math.round(parseFloat(amount) * web3.LAMPORTS_PER_SOL);
        const tx = new web3.Transaction().add(web3.SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new web3.PublicKey(recipient),
          lamports,
        }));
        const sig = await web3.sendAndConfirmTransaction(conn, tx, [keypair], { commitment: 'confirmed' });
        setTxHash(sig);
        setStep('sent');
        return;
      }
      const rpc = CHAIN_RPC[chain.id];
      if (!rpc) { setError(`${chain.name} send not supported yet.`); setStep('confirm'); return; }
      const ethers = await import('ethers');
      // #42 — Ledger: build + sign the native transfer on the device.
      if (isLedger) {
        const { sendLedgerEvmTx } = await import('@/lib/wallet/ledger');
        const hash = await sendLedgerEvmTx({
          path: wallet.derivationPath ?? "44'/60'/0'/0/0",
          rpcUrl: rpc,
          tx: { to: recipient, value: ethers.parseEther(amount) },
        });
        setTxHash(hash);
        setStep('sent');
        return;
      }
      const decryptedKey = await decryptPrivateKey(wallet.encryptedKey, password);
      const provider = new ethers.JsonRpcProvider(rpc);
      const signer = new ethers.Wallet(decryptedKey, provider);
      const value = ethers.parseEther(amount);
      // Apply the chosen gas speed: scale the network's suggested fee. Prefer
      // EIP-1559 (maxFeePerGas/maxPriorityFeePerGas), fall back to legacy gasPrice.
      const mult = feeSpeed === 'slow' ? BigInt(85) : feeSpeed === 'fast' ? BigInt(130) : BigInt(100);
      const hundred = BigInt(100);
      const feeData = await provider.getFeeData();
      const txReq: Record<string, unknown> = { to: recipient, value, gasLimit: BigInt(21000) };
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        txReq.maxFeePerGas = (feeData.maxFeePerGas * mult) / hundred;
        txReq.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * mult) / hundred;
      } else if (feeData.gasPrice) {
        txReq.gasPrice = (feeData.gasPrice * mult) / hundred;
      }
      const tx = await signer.sendTransaction(txReq);
      setTxHash(tx.hash);
      setTxNonce(tx.nonce);
      setStep('sent');
    } catch (e: any) {
      const msg = (e?.shortMessage || e?.message || 'Transaction failed') as string;
      if (/decrypt|password|bad key/i.test(msg)) { setPwError('Wrong wallet password.'); setStep('password'); return; }
      // Translate common RPC failures into something the user can act on.
      if (/insufficient/i.test(msg)) setError(`Insufficient ${chain.symbol} for amount + gas. Lower the amount or top up.`);
      else if (/nonce/i.test(msg)) setError('You have a pending transaction on this wallet. Wait for it to confirm, then retry.');
      else if (/gas|underpriced|fee too low/i.test(msg)) setError('Network fee too low right now. Try again with Fast speed.');
      else if (/network|timeout|could not detect|failed to fetch|connection/i.test(msg)) setError('Network error reaching the chain. Check your connection and retry.');
      else setError(msg.slice(0, 200));
      setStep('confirm');
    }
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}>{children}</div>
  );
  const fieldCls = 'w-full nl-glass rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none';
  const fieldStyle = { boxShadow: '0 0 0 1px rgba(0,102,255,.22)' } as const;
  const primaryStyle = { background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 18px rgba(0,102,255,.5), inset 0 1px 0 rgba(255,255,255,.2)' } as const;

  return (
    <div className="min-h-screen text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button
          onClick={() => (step === 'form' || step === 'sent' ? onBack() : setStep(step === 'password' ? 'confirm' : 'form'))}
          className="flex items-center gap-1.5 text-gray-400 text-[11px] mb-5 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#1233AE)', boxShadow: '0 0 14px rgba(0,102,255,.5)' }}>
            {/* Real per-chain token logo (Solana logo for SOL, ETH for Ethereum,
                Arbitrum badge, etc.) instead of a generic arrow. */}
            {chain.logoUrl
              ? <img src={chain.logoUrl} alt={chain.symbol} className="w-6 h-6 rounded-full" />
              : <ArrowUpRight className="w-5 h-5 text-white" />}
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">
              {step === 'confirm' ? 'Confirm send' : step === 'sent' ? `${chain.symbol} Sent` : `Send ${chain.symbol}`}
            </h1>
            <p className="text-gray-400 text-xs">on {chain.name}</p>
          </div>
        </div>

        {/* STEP 1 — recipient + amount */}
        {step === 'form' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Address or Domain Name</label>
              <div className="relative">
                <input value={to} onChange={e => setTo(e.target.value)} className={`${fieldCls} font-mono pe-24`} style={fieldStyle} placeholder={chain.id === 'solana' ? 'Solana address…' : '0x… or name.eth'} />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button type="button" onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setTo(t.trim()); } catch { /* denied */ } }} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-blue-300 border border-white/10">Paste</button>
                  <button type="button" onClick={() => setScanOpen(true)} aria-label="Scan QR" className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 border border-white/10"><QrCode className="w-4 h-4" /></button>
                </div>
              </div>
              {scanOpen && <ScanQrModal onResult={(a) => { setTo(a); setScanOpen(false); }} onClose={() => setScanOpen(false)} />}
              {isEns && ensLoading && <p className="text-[11px] text-slate-500 mt-1.5">Resolving {to.trim()}…</p>}
              {isEns && !ensLoading && ensAddr && <p className="text-[11px] text-emerald-400 mt-1.5 font-mono">→ {shortAddr(ensAddr)}</p>}
              {isEns && !ensLoading && !ensAddr && <p className="text-[11px] text-[#F59E0B] mt-1.5">Couldn&apos;t resolve that name.</p>}
              {!isEns && to && !validAddr && <p className="text-[11px] text-[#F59E0B] mt-1.5">Not a valid {chain.name} address.</p>}
              {!to && contacts.length > 0 && (
                <div className="mt-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">Address book</div>
                  <div className="flex flex-wrap gap-1.5">
                    {contacts.slice(0, 8).map((c) => (
                      <button key={c.id} type="button" onClick={() => setTo(c.address)} className="nl-glass px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-200" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.2)' }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 font-medium">Amount ({chain.symbol})</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Balance: {balNum.toFixed(6)}</span>
                  <button type="button" onClick={setMax} className="text-[10px] font-bold text-[#0066FF] hover:text-[#3B4EFF]">MAX</button>
                </div>
              </div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.001" className={`${fieldCls} font-mono`} style={fieldStyle} placeholder="0.01" />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-slate-500">{usdValue != null ? `≈ $${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}</span>
                {overBalance && <span className="text-[11px] font-semibold text-[#EF4444]">Insufficient {chain.symbol}: you have {balNum.toFixed(4)}, tried {amtNum.toFixed(4)}</span>}
              </div>
            </div>
            <button onClick={goConfirm} disabled={!canProceed} style={canProceed ? primaryStyle : undefined} className="w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-40 disabled:bg-white/[0.05]">
              Next
            </button>
          </div>
        )}

        {/* STEP 2 — confirm */}
        {step === 'confirm' && (
          <div className="space-y-3">
            <Card>
              <div className="text-2xl font-bold">{usdValue != null ? `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `${amount} ${chain.symbol}`}</div>
              <div className="text-sm text-slate-400 font-mono">{amount} {chain.symbol}</div>
            </Card>
            <Card>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">From</span><span className="font-mono">{shortAddr(wallet.address)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">To</span><span className="font-mono">{shortAddr(recipient)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Network</span><span>{chain.name}</span></div>
                {gasEstimateEth && (() => {
                  const mult = feeSpeed === 'slow' ? 0.85 : feeSpeed === 'fast' ? 1.3 : 1;
                  return <div className="flex justify-between"><span className="text-slate-400">Network fee</span><span className="font-mono">≈{(parseFloat(gasEstimateEth) * mult).toFixed(6)} {chain.symbol}</span></div>;
                })()}
              </div>
            </Card>
            {/* Gas speed — EVM only (Solana/BTC fees aren't user-tunable here). */}
            {chain.id !== 'solana' && chain.id !== 'bitcoin' && (
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5 font-medium">Transaction speed</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'slow' as const, label: 'Slow', sub: 'Cheaper' },
                    { id: 'standard' as const, label: 'Standard', sub: 'Recommended' },
                    { id: 'fast' as const, label: 'Fast', sub: 'Priority' },
                  ]).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFeeSpeed(o.id)}
                      className={`py-2 rounded-xl border-2 text-center transition ${feeSpeed === o.id ? 'border-blue-400/60 bg-blue-500/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                    >
                      <div className={`text-xs font-semibold ${feeSpeed === o.id ? 'text-blue-100' : 'text-white/80'}`}>{o.label}</div>
                      <div className="text-[10px] text-white/45">{o.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/5 p-3 rounded-xl border border-[#EF4444]/10">{error}</p>}
            <button onClick={() => wallet.importMethod === 'ledger' ? void handleSend() : setStep('password')} style={primaryStyle} className="w-full py-3.5 rounded-2xl font-bold text-sm">
              {wallet.importMethod === 'ledger' ? 'Confirm on Ledger' : 'Continue'}
            </button>
          </div>
        )}

        {/* STEP 3 — password */}
        {step === 'password' && (
          <div className="space-y-4">
            <Card>
              <div className="text-sm text-slate-300">Sending <span className="font-semibold text-white">{amount} {chain.symbol}</span> to <span className="font-mono">{shortAddr(recipient)}</span></div>
            </Card>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Wallet Password</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPwError(''); }} className={fieldCls} style={fieldStyle} placeholder="Enter your wallet password" />
              {pwError && <p className="text-[11px] font-semibold text-[#EF4444] mt-1.5">{pwError}</p>}
            </div>
            <button onClick={handleSend} disabled={!password} style={password ? primaryStyle : undefined} className="w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-40 disabled:bg-white/[0.05]">
              Confirm &amp; Send
            </button>
          </div>
        )}

        {/* STEP 4 — processing */}
        {step === 'processing' && (
          <div className="text-center py-14">
            <Loader2 className="w-12 h-12 text-[#0066FF] animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-1">Processing transaction…</h2>
            <p className="text-slate-400 text-sm">Broadcasting to {chain.name}. Don&apos;t close this screen.</p>
          </div>
        )}

        {/* STEP 5 — sent / status */}
        {step === 'sent' && (
          <div className="space-y-3">
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#1233AE)', boxShadow: '0 0 18px rgba(0,102,255,.5)' }}>
                <ArrowUpRight className="w-8 h-8 text-white" />
              </div>
              <div className="text-2xl font-bold">-{amount} {chain.symbol}</div>
              {usdValue != null && <div className="text-sm text-slate-400">${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
            </div>
            <Card>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Status</span>
                  <span className={`font-semibold inline-flex items-center gap-1.5 ${txStatus === 'confirmed' ? 'text-[#10B981]' : txStatus === 'failed' ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>
                    {txStatus === 'pending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {txStatus === 'confirmed' ? 'Confirmed' : txStatus === 'failed' ? 'Failed' : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">Recipient</span><span className="font-mono">{shortAddr(recipient)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Network</span><span>{chain.name}</span></div>
                {gasEstimateEth && <div className="flex justify-between"><span className="text-slate-400">Network fee</span><span className="font-mono">{parseFloat(gasEstimateEth).toFixed(6)} {chain.symbol}</span></div>}
                <div className="flex justify-between"><span className="text-slate-400">Confirmations</span><span>{txStatus === 'pending' && confirmations === 0 ? '—' : confirmations}</span></div>
                {txNonce != null && <div className="flex justify-between"><span className="text-slate-400">Nonce</span><span>{txNonce}</span></div>}
              </div>
            </Card>
            {txHash && (
              <a href={`${chain.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="nl-glass flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[#8FA3FF] text-sm font-semibold" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.3)' }}>
                View on block explorer <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {txStatus === 'failed' && (
              <div className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-3 space-y-2.5">
                <p className="text-xs text-red-200">This transaction reverted on-chain. You can retry it (your password is still unlocked).</p>
                <button
                  onClick={() => { setTxHash(''); setTxStatus('pending'); setConfirmations(0); void handleSend(); }}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#1233AE)', boxShadow: '0 0 14px rgba(0,102,255,.5)' }}
                >
                  Retry transaction
                </button>
              </div>
            )}
            {!contacts.some((c) => c.address.toLowerCase() === recipient.toLowerCase()) && (
              <button onClick={() => void saveContact()} disabled={saved} className="w-full py-3 rounded-2xl font-semibold text-[13px] text-[#8FA3FF] nl-glass disabled:opacity-60" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.2)' }}>
                {saved ? 'Saved to address book ✓' : 'Save recipient to address book'}
              </button>
            )}
            <button onClick={onBack} className="w-full py-3.5 rounded-2xl font-bold text-sm nl-glass" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TOKEN APPROVALS MANAGER ───────────────────────────────────────────────
// revoke.cash-style: lists real on-chain ERC-20 spending allowances the wallet
// has granted and lets the user revoke them by signing approve(spender, 0) with
// their own key (same password → decrypt → ethers.Wallet flow as Send). EVM-only.
interface ApprovalRow {
  tokenAddress: string;
  spender: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string | null;
  allowanceRaw: string;
  allowanceDisplay: string;
  unlimited: boolean;
  revokeCalldata: string;
}

function ApprovalsView({ onBack, wallet, chain }: { onBack: () => void; wallet: StoredWallet; chain: ChainInfo }) {
  const [rows, setRows] = useState<ApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-approval revoke state, keyed by `${tokenAddress}:${spender}`.
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [pwModal, setPwModal] = useState<ApprovalRow | null>(null);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const rowKey = (r: ApprovalRow) => `${r.tokenAddress}:${r.spender}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setRows(null);
      try {
        const res = await fetch(
          `/api/wallet/approvals?wallet=${encodeURIComponent(wallet.address)}&chain=${chain.id}`,
          { cache: 'no-store', signal: AbortSignal.timeout(30_000) },
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json?.error || 'Failed to load approvals'); setRows([]); return; }
        setRows(json.approvals ?? []);
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load approvals'); setRows([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [wallet.address, chain.id]);

  const doRevoke = async () => {
    const target = pwModal;
    if (!target) return;
    if (!password) { setPwError('Enter your wallet password.'); return; }
    setPwError('');
    setRevoking(rowKey(target));
    setPwModal(null);
    try {
      const rpc = CHAIN_RPC[chain.id];
      if (!rpc) throw new Error(`${chain.name} not supported`);
      const ethers = await import('ethers');
      const decryptedKey = await decryptPrivateKey(wallet.encryptedKey, password);
      const provider = new ethers.JsonRpcProvider(rpc);
      const signer = new ethers.Wallet(decryptedKey, provider);
      // approve(spender, 0) — calldata built server-side, sent to the token.
      const tx = await signer.sendTransaction({ to: target.tokenAddress, data: target.revokeCalldata });
      await tx.wait(1);
      setRevoked((prev) => new Set(prev).add(rowKey(target)));
    } catch (e) {
      const msg = (e instanceof Error ? (e as { shortMessage?: string }).shortMessage || e.message : 'Revoke failed') as string;
      if (/decrypt|password|bad key/i.test(msg)) setPwError('Wrong wallet password.');
      setError(/decrypt|password|bad key/i.test(msg) ? null : msg.slice(0, 160));
    } finally {
      setRevoking(null);
      setPassword('');
    }
  };

  const visible = (rows ?? []).filter((r) => !revoked.has(rowKey(r)));

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} aria-label="Back" className="p-2 -ms-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Token Approvals</h1>
            <p className="text-[11px] text-slate-500">{chain.name} · {shortAddr(wallet.address)}</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          These contracts can spend your tokens. Revoke any you don&apos;t recognize or no
          longer use — especially <span className="text-amber-400 font-semibold">Unlimited</span> grants.
        </p>

        {rows === null && (
          <div className="py-12 text-center text-sm text-slate-400">Scanning on-chain approvals…</div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-3 py-2.5 text-xs text-red-200 mb-4">{error}</div>
        )}
        {rows !== null && visible.length === 0 && !error && (
          <div className="py-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm text-white font-medium">No open approvals</p>
            <p className="text-xs text-slate-500 mt-1">This wallet has no active token spending permissions on {chain.name}.</p>
          </div>
        )}

        <div className="space-y-2.5">
          {visible.map((r) => {
            const k = rowKey(r);
            return (
              <div key={k} className="nl-glass rounded-2xl p-3.5" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.18)' }}>
                <div className="flex items-center gap-3">
                  {r.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo} alt="" className="w-9 h-9 rounded-full shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[11px] font-bold text-slate-300">
                      {r.symbol.slice(0, 3)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{r.symbol} <span className="text-slate-500 font-normal">· {r.name}</span></p>
                    <p className="text-[11px] text-slate-500 truncate">Spender {shortAddr(r.spender)}</p>
                  </div>
                  <button
                    onClick={() => { setPwModal(r); setPassword(''); setPwError(''); }}
                    disabled={revoking === k}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {revoking === k ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${r.unlimited ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                    Allowance: {r.allowanceDisplay}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Password confirm modal — revoke signs with the wallet's own key. */}
      {pwModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setPwModal(null)} />
          <div className="relative w-full max-w-[340px] mx-4 nl-glass rounded-2xl p-5 shadow-2xl" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.3)' }}>
            <h3 className="text-sm font-bold mb-1 text-white">Revoke {pwModal.symbol} approval</h3>
            <p className="text-xs text-slate-400 mb-4">Sends an on-chain transaction (network fee applies). Enter your wallet password to sign.</p>
            <input
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void doRevoke(); }}
              placeholder="Wallet password"
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0066FF]/50 mb-2"
            />
            {pwError && <p className="text-xs text-red-400 mb-2">{pwError}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setPwModal(null)} className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={() => void doRevoke()} className="flex-1 py-2.5 bg-red-500/20 text-red-300 rounded-xl text-xs font-semibold hover:bg-red-500/30 transition-colors border border-red-500/20">Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PORTFOLIO ANALYTICS ───────────────────────────────────────────────────
// Real cross-chain allocation view. Fetches /api/wallet-intelligence for every
// live chain for the active address and aggregates by network and by asset.
// No fabricated numbers — chains that return nothing simply contribute $0.
function PortfolioAnalyticsView({ onBack, wallet }: { onBack: () => void; wallet: StoredWallet }) {
  const [chainData, setChainData] = useState<Record<string, WalletData | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setChainData(null);
      try {
        const entries = await Promise.all(
          LIVE_CHAINS.map(async (cid) => {
            try {
              const res = await fetch(`/api/wallet-intelligence?address=${wallet.address}&chain=${cid}`, {
                signal: AbortSignal.timeout(20_000),
                cache: 'no-store',
              });
              return [cid, res.ok ? ((await res.json()) as WalletData) : null] as const;
            } catch {
              return [cid, null] as const;
            }
          }),
        );
        if (cancelled) return;
        setChainData(Object.fromEntries(entries));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analytics');
      }
    })();
    return () => { cancelled = true; };
  }, [wallet.address]);

  // Aggregate per-chain + per-asset from the real intelligence payloads.
  const { perChain, perAsset, total, assetCount } = useMemo(() => {
    const chains: { id: string; name: string; color: string; usd: number }[] = [];
    const assetMap = new Map<string, { symbol: string; name: string; usd: number; logo?: string }>();
    let totalUsd = 0;
    let assets = 0;
    for (const cid of LIVE_CHAINS) {
      const d = chainData?.[cid];
      if (!d) continue;
      const chainUsd = parseFloat(d.totalBalanceUsd || '0');
      const info = SUPPORTED_CHAINS.find((c) => c.id === cid);
      if (chainUsd > 0) chains.push({ id: cid, name: info?.name ?? cid, color: info?.color ?? '#0066FF', usd: chainUsd });
      totalUsd += chainUsd;
      for (const h of d.holdings || []) {
        const v = parseFloat(h.valueUsd || '0');
        if (v <= 0) continue;
        assets += 1;
        const key = `${h.symbol}`.toUpperCase();
        const prev = assetMap.get(key);
        if (prev) prev.usd += v;
        else assetMap.set(key, { symbol: h.symbol, name: h.name, usd: v, logo: h.logo });
      }
    }
    chains.sort((a, b) => b.usd - a.usd);
    const assetList = Array.from(assetMap.values()).sort((a, b) => b.usd - a.usd);
    return { perChain: chains, perAsset: assetList, total: totalUsd, assetCount: assets };
  }, [chainData]);

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} aria-label="Back" className="p-2 -ms-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Portfolio Analytics</h1>
            <p className="text-[11px] text-slate-500">{shortAddr(wallet.address)} · all networks</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-3 py-2.5 text-xs text-red-200 mb-4">{error}</div>
        )}

        {chainData === null ? (
          <div className="py-12 text-center text-sm text-slate-400">Aggregating across networks…</div>
        ) : total === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-white font-medium">No balances to analyze</p>
            <p className="text-xs text-slate-500 mt-1">Fund this wallet to see your allocation breakdown.</p>
          </div>
        ) : (
          <>
            {/* Headline stats */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Total value', value: fmt(total) },
                { label: 'Networks', value: String(perChain.length) },
                { label: 'Assets', value: String(assetCount) },
              ].map((s) => (
                <div key={s.label} className="nl-glass rounded-xl p-3 text-center" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.18)' }}>
                  <p className="text-sm font-bold text-white truncate">{s.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Allocation by network */}
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">By network</h2>
            <div className="space-y-2.5 mb-6">
              {perChain.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-white">{c.name}</span>
                    <span className="text-slate-400">{fmt(c.usd)} · {pct(c.usd).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct(c.usd), 1.5)}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Top assets */}
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Top assets</h2>
            <div className="space-y-2">
              {perAsset.slice(0, 12).map((a) => (
                <div key={a.symbol} className="nl-glass rounded-xl p-3 flex items-center gap-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.12)' }}>
                  {a.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.logo} alt="" className="w-8 h-8 rounded-full shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-300">{a.symbol.slice(0, 3)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.symbol}</p>
                    <div className="h-1.5 mt-1 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(pct(a.usd), 1.5)}%`, background: 'linear-gradient(90deg,#1E90FF,#0066FF)' }} />
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs font-mono text-white">{fmt(a.usd)}</p>
                    <p className="text-[10px] text-slate-500">{pct(a.usd).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Chains that share the same secp256k1 EVM address. A single 0x… address
// from the Naka built-in wallet is valid on every chain in this set —
// this is standard EVM behavior and matches Trust Wallet, MetaMask, etc.
// Anything OUTSIDE this set (Solana, Bitcoin, Sui) needs a separately
// derived address; the Naka built-in wallet is currently EVM-only, so
// for those chains the receive view tells the user the truth instead of
// rendering an EVM hex address mislabelled as Solana / BTC / Sui (which
// is exactly the bug a tester reported).
const EVM_RECEIVE_CHAINS = new Set([
  'ethereum', 'base', 'polygon', 'avalanche', 'arbitrum',
  'optimism', 'bnb', 'fantom', 'cronos',
  // EVM testnets share the same 0x address.
  'sepolia', 'base-sepolia', 'arbitrum-sepolia', 'polygon-amoy', 'bnb-testnet',
]);

function isEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function isAddressCompatibleWithChain(addr: string, chainId: string): boolean {
  if (!addr) return false;
  if (EVM_RECEIVE_CHAINS.has(chainId)) return isEvmAddress(addr);
  if (chainId === 'solana') {
    // Solana base58 pubkeys are 32-44 chars, base58 alphabet (no 0/O/I/l).
    // EVM 0x… clearly fails this test which is what we want.
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  }
  if (chainId === 'bitcoin') {
    // Quick legacy / segwit / taproot prefix check. Not a full validator
    // (there's no checksum here), but enough to reject EVM addresses,
    // which is the actual user-reported bug.
    return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/.test(addr);
  }
  // Sui addresses are 0x + 64 hex (different length than EVM).
  if (chainId === 'sui') return /^0x[a-fA-F0-9]{64}$/.test(addr);
  return false;
}

function ReceiveView({
  onBack,
  address,
  chain,
  availableChains,
  onChangeChain,
}: {
  onBack: () => void;
  address: string;
  chain: ChainInfo;
  availableChains: ChainInfo[];
  onChangeChain: (c: ChainInfo) => void;
}) {
  const [copied, setCopied] = useState(false);
  // FIX 5A.1 / Phase 4: was a <QrCode> icon placeholder (no real QR); now renders a real
  // scannable QR as an inline <img data:> URL generated client-side via `qrcode`.
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Bug §1 — only display the address when it matches the chain. The
  // wallet currently stores a single EVM (0x…) address per StoredWallet;
  // showing that on the Solana receive screen led a tester to see
  // "Receive on Solana" alongside an Ethereum hex address, which would
  // have lost any deposit they made.
  const addressMatchesChain = isAddressCompatibleWithChain(address, chain.id);

  useEffect(() => {
    if (!address || !addressMatchesChain) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    import('qrcode')
      // qrcode requires literal hex colors — the CSS variable made toDataURL
      // throw 'Invalid hex color' on every chain, so the QR never rendered
      // and the Receive view showed the placeholder icon forever.
      .then((m) => m.toDataURL(address, { margin: 1, width: 256, color: { dark: '#0A0E1A', light: '#ffffff' } }))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        // QR generation failure is non-fatal — the address text below is
        // still copyable. Log so we surface it in Sentry instead of
        // silently dropping the user back to a blank QR slot.
        console.warn('[ReceiveView] QR generation failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [address, addressMatchesChain]);

  return (
    <div className="min-h-screen text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${chain.color}15`, border: `1px solid ${chain.color}25` }}>
            <ArrowDownLeft className="w-5 h-5" style={{ color: chain.color }} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Receive on {chain.name}</h1>
            <p className="text-gray-400 text-xs">Share your address to receive {chain.symbol}</p>
          </div>
        </div>

        {/* Receive shows only the active coin's network (chain-picker chips
            removed per product direction) — you receive the coin you opened
            Receive for; switch coins from the wallet home / coin page. The
            void below keeps the (still-passed) props from tripping lint. */}
        {void availableChains}
        {void onChangeChain}

        {/* Bug §1 — when the active chain isn't compatible with the
            stored wallet address (e.g. Solana / Bitcoin requested while
            the Naka built-in is still EVM-only), short-circuit before
            we ever render an address that would cause loss of funds.
            User keeps the chain picker above so they can switch to a
            chain we DO support, or follows the CTA below to connect an
            external wallet for the chain they want. */}
        {!addressMatchesChain ? (
          <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-5 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <h2 className="text-sm font-semibold text-white mb-1">
              No {chain.name} address yet
            </h2>
            <p className="text-xs leading-relaxed text-amber-100/90 mb-4">
              Your Naka wallet doesn&apos;t have a {chain.name} address derived
              yet. Don&apos;t deposit {chain.symbol} to your EVM address —
              funds sent on the wrong network are <span className="font-bold underline">lost forever</span>.
            </p>
            {chain.id === 'solana' && (
              <p className="text-[11px] text-slate-400 mb-4">
                To receive SOL right now, connect Phantom from the Swap
                page or import a Solana account.
              </p>
            )}
            {chain.id === 'bitcoin' && (
              <p className="text-[11px] text-slate-400 mb-4">
                Bitcoin support is coming. For now, use a Bitcoin-native
                wallet to receive BTC.
              </p>
            )}
            <button
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-white transition-colors"
            >
              Back to Wallet
            </button>
          </div>
        ) : (
        <>
        {/* Compact per-chain red info bar — read before copy/share. Exact
            wording per product direction; mandatory on every chain. */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 text-[#EF4444]" />
          <p className="text-[11px] leading-snug text-red-100">
            <span className="font-semibold">Only send {chain.name} ({chain.symbol}) assets to this address.</span> Other assets will be{' '}
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

          <p className="text-gray-400 text-xs mb-3">Your {chain.name} address</p>

          <div className="nl-glass rounded-xl p-4 mb-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.3)' }}>
            <p className="text-xs font-mono break-all text-[#8FA3FF]">{address}</p>
          </div>

          {/* Trust-Wallet-style 3-action row: Copy · Set Amount · Share. Each
              action fails soft — Share silently falls back to copy-link when
              the Web Share API isn't available (desktop Chrome without https, etc). */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <button
              onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex flex-col items-center gap-1.5 py-3 nl-glass hover:bg-slate-800 rounded-xl transition-colors">
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
              className="flex flex-col items-center gap-1.5 py-3 nl-glass hover:bg-slate-800 rounded-xl transition-colors">
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
              className="flex flex-col items-center gap-1.5 py-3 nl-glass hover:bg-slate-800 rounded-xl transition-colors">
              <Share2 className="w-4 h-4 text-slate-300" />
              <span className="text-[11px] font-semibold text-slate-200">Share</span>
            </button>
          </div>

          {/* Deposit-from-exchange hint — Trust Wallet parity. Low-prominence
              but reminds users that CEX withdrawals land on the same address. */}
          <div className="flex items-start gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 text-start mb-4">
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
        </>
        )}
      </div>
    </div>
  );
}

// Chains a custom token can be imported on. EVM chains validate as 0x-hex;
// Solana validates as base58. Bitcoin/Sui are excluded — they don't expose
// the ERC-20/SPL contract model the hydrator + price lookup understand.
const ADD_TOKEN_CHAINS = SUPPORTED_CHAINS.filter((c) => c.id !== 'bitcoin' && c.id !== 'sui');

function AddTokenView({ onBack, tokens, onAdd }: { onBack: () => void; tokens: string[]; onAdd: (key: string) => void }) {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [error, setError] = useState('');
  // Audit B4 / P1 #12 — GoPlus pre-add scan. Without this, users can
  // import any contract address as a custom token, including outright
  // honeypots and fake stablecoins that show $50K balances they cannot
  // sell. Now we run /api/security/scan before saving and surface the
  // verdict so the user can confirm/cancel knowing the risk.
  const [scanning, setScanning] = useState(false);
  const [scanVerdict, setScanVerdict] = useState<null | {
    score: number;
    level: string;
    reasons: string[];
  }>(null);
  // On-chain token metadata auto-fetch (Trust "Import crypto" parity): when a
  // valid contract is entered, resolve real name/symbol/decimals + logo so the
  // user sees exactly what they're importing before confirming.
  const [meta, setMeta] = useState<null | { symbol: string; name: string; decimals: number; logo: string | null }>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // Audit B4 / P1 #11 — paste affordance. Long contract addresses are
  // notoriously typo-prone; clipboard.readText (with permission) is the
  // industry-standard one-tap fix used by Trust Wallet + Phantom.
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.trim();
      if (cleaned) {
        setAddress(cleaned);
        setError('');
        setScanVerdict(null);
      }
    } catch (err) {
      // Clipboard permission denied or HTTPS-only context — surface a
      // gentle hint rather than a hard error.
      console.warn('[AddToken] Clipboard read failed:', err);
      setError('Clipboard access denied. Paste manually with Ctrl/Cmd+V.');
    }
  };

  const runScan = async (addr: string, scanChain: string) => {
    setScanning(true);
    setScanVerdict(null);
    try {
      const res = await fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Scan on the SAME chain the token is being added on — a hardcoded
        // 'ethereum' scanned the wrong network for Base/Solana/etc. tokens.
        body: JSON.stringify({ scan_type: 'token', target: addr, chain }),
      });
      if (!res.ok) throw new Error(`Scan failed (${res.status})`);
      const json = (await res.json()) as { score: number; level: string; reasons: string[] };
      setScanVerdict({ score: json.score, level: json.level, reasons: json.reasons ?? [] });
    } catch (err) {
      // Scan unavailable should not BLOCK the add — fall back to allowing
      // the add with a clear warning that we couldn't verify safety.
      console.warn('[AddToken] Security scan failed:', err);
      setScanVerdict({ score: 0, level: 'unknown', reasons: ['Security scan unavailable. Proceed with caution.'] });
    } finally {
      setScanning(false);
    }
  };

  // Auto-resolve token metadata on-chain when the address looks valid.
  useEffect(() => {
    const trimmed = address.trim();
    const valid = isEvmChain(chain) ? /^0x[a-fA-F0-9]{40}$/.test(trimmed) : (chain === 'solana' && isSolanaAddress(trimmed));
    if (!valid) { setMeta(null); return; }
    let cancelled = false;
    setMetaLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/swap/token-meta?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(trimmed)}`);
        if (!res.ok) { if (!cancelled) setMeta(null); return; }
        const d = await res.json();
        if (!cancelled && typeof d.decimals === 'number') setMeta({ symbol: d.symbol, name: d.name, decimals: d.decimals, logo: d.logo ?? null });
      } catch { if (!cancelled) setMeta(null); }
      finally { if (!cancelled) setMetaLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [address, chain]);

  const handleAdd = async () => {
    // Chain-aware validation: EVM contracts are 0x + 40 hex, Solana is base58.
    const trimmed = address.trim();
    if (isEvmChain(chain)) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) { setError('Invalid EVM contract address'); return; }
    } else if (chain === 'solana') {
      if (!isSolanaAddress(trimmed)) { setError('Invalid Solana mint address'); return; }
    } else if (!trimmed) {
      setError('Enter a contract address'); return;
    }
    // Persist chain-aware: EVM folds to lowercase, Solana keeps its case. The
    // stored key is "<chain>:<contract>" to match the hydrator, which splits on
    // ':' — storing a bare address meant the token never hydrated.
    const normalized = normalizeAddress(trimmed, chain);
    const key = `${chain}:${normalized}`;
    if (tokens.includes(key)) { setError('Token already added'); return; }
    if (!scanVerdict) {
      await runScan(normalized, chain);
      return; // First click runs the scan; user confirms with second click.
    }
    onAdd(key);
  };

  // Static class map — Tailwind needs literal class names at build
  // time, not runtime-interpolated ones, so each tone has its own
  // pre-baked combo.
  const VERDICT_CLASSES: Record<string, string> = {
    safe: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    danger: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    critical: 'bg-red-500/10 border-red-500/30 text-red-300',
    unknown: 'bg-slate-500/10 border-slate-500/30 text-slate-300',
  };
  const verdictClass = VERDICT_CLASSES[scanVerdict?.level ?? 'unknown'] ?? VERDICT_CLASSES.unknown;

  return (
    <div className="min-h-screen text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0066FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Add Custom Token</h1>
            <p className="text-gray-400 text-xs">Import any token by contract — EVM or Solana</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Network</label>
            <select
              value={chain}
              onChange={(e) => { setChain(e.target.value); setError(''); setScanVerdict(null); }}
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0066FF]/50"
            >
              {ADD_TOKEN_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Token Contract Address</label>
            <div className="relative">
              <input
                value={address}
                onChange={e => { setAddress(e.target.value); setError(''); setScanVerdict(null); }}
                className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 pe-20 text-sm font-mono focus:outline-none focus:border-[#0066FF]/50"
                placeholder={chain === 'solana' ? 'Mint address…' : '0x…'}
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-slate-200 border border-white/10"
                title="Paste from clipboard"
              >
                Paste
              </button>
            </div>
          </div>
          {/* Auto-resolved on-chain metadata (read-only) — Trust Import parity. */}
          {metaLoading && <p className="text-[11px] text-slate-500">Resolving token on-chain…</p>}
          {meta && (
            <div className="nl-glass rounded-xl p-3 space-y-2" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}>
              <div className="flex items-center gap-2.5">
                {meta.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={meta.logo} alt="" className="w-8 h-8 rounded-full" />
                  : <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">{meta.symbol.slice(0, 3)}</div>}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{meta.name}</div>
                  <div className="text-[11px] text-slate-400">{meta.symbol} · {meta.decimals} decimals</div>
                </div>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          {scanVerdict && (
            <div className={`rounded-xl border p-3 text-xs space-y-1 ${verdictClass}`}>
              <div className="flex items-center justify-between font-semibold">
                <span>Security scan: {scanVerdict.level.toUpperCase()}</span>
                <span className="font-mono">{scanVerdict.score}/100</span>
              </div>
              {scanVerdict.reasons.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                  {scanVerdict.reasons.slice(0, 4).map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              )}
              <p className="text-[10px] opacity-70 pt-1">
                {scanVerdict.level === 'safe' || scanVerdict.level === 'unknown'
                  ? 'Press Add Token again to confirm.'
                  : 'This token has risk indicators. Press Add Token again only if you accept the risk.'}
              </p>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={!address || scanning}
            className="w-full py-3.5 bg-gradient-to-r from-[#0066FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : scanVerdict ? 'Add Token' : 'Scan + Add Token'}
          </button>

          {tokens.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-2">Custom Tokens ({tokens.length})</h3>
              <div className="space-y-1.5">
                {tokens.map(t => {
                  // Stored as "<chain>:<contract>"; show the chain + a short address.
                  const sep = t.indexOf(':');
                  const tChain = sep > 0 ? t.slice(0, sep) : '';
                  const tAddr = sep > 0 ? t.slice(sep + 1) : t;
                  return (
                    <div key={t} className="flex items-center justify-between bg-[#111827] rounded-xl px-4 py-3 text-xs font-mono text-gray-400 border border-white/5">
                      <span>
                        {tChain && <span className="text-slate-500 uppercase me-2">{tChain}</span>}
                        {tAddr.slice(0, 8)}…{tAddr.slice(-6)}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// #58 — soft-square toggle matching the platform's profile-settings style
// (rounded-rect track + square knob), not an iOS pill.
function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-md transition-colors duration-200 flex-shrink-0 ${on ? 'bg-[#0066FF]' : 'bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-[5px] bg-white shadow-sm transition-all duration-200 ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

// Fresh-wallet empty state — a floating 3D-ish cluster of real chain coins
// (our own neon-glass vibe, not a Trust clone) + a prominent Fund CTA.
function FundWalletEmpty({ onFund, onManage }: { onFund: () => void; onManage: () => void }) {
  // Each coin: chain id (for ChainLogo), size, and an absolute position +
  // rotation that gives the cluster depth. BTC/SOL/ETH lead, others orbit.
  const coins: Array<{ id: string; size: number; top: string; left: string; rot: number; z: number }> = [
    { id: 'ethereum', size: 64, top: '18%', left: '38%', rot: -8, z: 5 },
    { id: 'solana', size: 50, top: '6%', left: '60%', rot: 10, z: 4 },
    { id: 'bnb', size: 46, top: '40%', left: '62%', rot: 14, z: 3 },
    { id: 'polygon', size: 44, top: '46%', left: '20%', rot: -14, z: 3 },
    { id: 'base', size: 40, top: '12%', left: '14%', rot: 6, z: 2 },
    { id: 'arbitrum', size: 38, top: '52%', left: '44%', rot: -4, z: 4 },
  ];
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <div className="relative w-56 h-44 mb-2">
        {coins.map((c) => {
          const ci = SUPPORTED_CHAINS.find((x) => x.id === c.id);
          if (!ci) return null;
          return (
          <div
            key={c.id}
            className="absolute rounded-full"
            style={{
              top: c.top, left: c.left, width: c.size, height: c.size, zIndex: c.z,
              transform: `rotate(${c.rot}deg)`,
              boxShadow: '0 10px 24px rgba(0,0,0,.45), 0 0 22px rgba(0,102,255,.35), inset 0 2px 6px rgba(255,255,255,.25)',
              borderRadius: '9999px',
              animation: `nlFloat 5s ease-in-out infinite`,
              animationDelay: `${c.z * 0.25}s`,
            }}
          >
            <ChainLogo chain={ci} size={c.size} />
          </div>
          );
        })}
        <style>{`@keyframes nlFloat{0%,100%{translate:0 0}50%{translate:0 -8px}}`}</style>
      </div>
      <p className="text-slate-300 font-semibold text-base mb-1">Add funds to get started</p>
      <p className="text-slate-500 text-sm mb-5 max-w-xs">Receive crypto to your wallet — your address works across every EVM chain, plus Solana.</p>
      <button
        onClick={onFund}
        className="w-full max-w-xs py-3.5 rounded-2xl font-bold text-white text-sm"
        style={{ background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 22px rgba(0,102,255,.55), inset 0 1px 0 rgba(255,255,255,.22)' }}
      >
        Fund your wallet
      </button>
      <button onClick={onManage} className="mt-3 text-[13px] font-semibold text-[#8FA3FF] hover:text-white transition-colors">Manage crypto</button>
    </div>
  );
}

// Manage/Customize tokens (Trust "Manage crypto" parity): search + network
// filter + per-token on/off toggle that actually hides/shows the asset on the
// wallet home. Glass blue-stride styling.
function CustomizeTokensView({ onBack, tokens, isHidden, onToggle, onAddToken }: {
  onBack: () => void;
  tokens: Array<{ symbol: string; name: string; contractAddress?: string | null; chain: string }>;
  isHidden: (t: { chain: string; contractAddress?: string | null; symbol: string }) => boolean;
  onToggle: (t: { chain: string; contractAddress?: string | null; symbol: string }) => void;
  onAddToken: () => void;
}) {
  const [q, setQ] = useState('');
  const [net, setNet] = useState('all');
  const nets = Array.from(new Set(tokens.map((t) => t.chain)));
  const filtered = tokens.filter((t) =>
    (net === 'all' || t.chain === net) &&
    (!q || t.symbol.toLowerCase().includes(q.toLowerCase()) || t.name.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="min-h-screen text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button onClick={onAddToken} className="nl-glass inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4)' }}>
            <Plus className="w-3.5 h-3.5 text-blue-300" /> Add Token
          </button>
        </div>
        <h1 className="text-xl font-heading font-bold mb-4">Manage crypto</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tokens…"
          className="w-full nl-glass rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none mb-3"
          style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}
        />
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-2">
          {['all', ...nets].map((n) => (
            <button
              key={n}
              onClick={() => setNet(n)}
              style={net === n ? { background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 12px rgba(0,102,255,.5)' } : { boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap capitalize ${net === n ? 'text-white nl-glass' : 'bg-white/[0.03] text-slate-400'}`}
            >
              {n === 'all' ? 'All Networks' : n}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-6 text-center">No tokens match.</p>
          ) : filtered.map((t) => {
            const on = !isHidden(t);
            return (
              <div key={`${t.chain}:${t.contractAddress || t.symbol}`} className="flex items-center gap-3 p-2.5 rounded-xl nl-glass" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}>
                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold shrink-0">{t.symbol.slice(0, 3)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{t.symbol} <span className="text-[10px] text-slate-500 font-medium capitalize">· {t.chain}</span></div>
                  <div className="text-[11px] text-slate-400 truncate">{t.name}</div>
                </div>
                <ToggleSwitch on={on} onToggle={() => onToggle(t)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SecretReveal({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-2">
      <div className="relative">
        <div className={`p-4 nl-glass rounded-xl text-xs font-mono break-all leading-relaxed text-slate-300 select-all min-h-[80px] flex items-center transition-all ${!revealed ? 'blur-md select-none' : ''}`}>
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
  const [showRevealPwd, setShowRevealPwd] = useState(false);
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
    { id: 'identity', label: 'Identity', icon: <Key className="w-4 h-4" />, color: 'var(--nl-blue)' },
    { id: 'security', label: 'Security & Backup', icon: <Shield className="w-4 h-4" />, color: 'var(--nl-success)' },
    { id: 'password', label: 'Change Password', icon: <Key className="w-4 h-4" />, color: 'var(--nl-warning)' },
    { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" />, color: '#8B5CF6' },
    { id: 'notifications', label: 'Notifications', icon: <Zap className="w-4 h-4" />, color: '#06B6D4' },
    { id: 'advanced', label: 'Advanced', icon: <Layers className="w-4 h-4" />, color: 'var(--nl-error)' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        {/* Top bar */}
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 text-sm mb-6 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Wallet
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6 p-4 nl-glass rounded-2xl">
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
            <div key={s.id} className="nl-glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.color + '18', color: s.color }}>
                  {s.icon}
                </div>
                <span className="flex-1 text-sm font-semibold text-start text-white">{s.label}</span>
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
                        <div className="flex items-center gap-2 p-3 nl-glass rounded-xl">
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
                          <div className="relative flex-1">
                            <input type={showRevealPwd ? 'text' : 'password'} value={revealPassword} onChange={e => { setRevealPassword(e.target.value); setRevealError(''); setRevealedPhrase(''); setRevealedKey(''); }} placeholder="Wallet password" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 pe-10 text-sm focus:outline-none focus:border-blue-500/60 text-white" />
                            <button type="button" onClick={() => setShowRevealPwd(v => !v)} aria-label={showRevealPwd ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300">
                              {showRevealPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <button onClick={() => handleReveal('phrase')} disabled={revealLoading || !revealPassword} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors">
                            {revealLoading ? <RotateCcw className="w-4 h-4 animate-spin" /> : 'Reveal'}
                          </button>
                        </div>
                        {revealError && <p className="text-xs text-red-400 mb-2">{revealError}</p>}
                        {revealedPhrase && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 p-4 nl-glass rounded-xl">
                              {revealedPhrase.split(' ').map((word, i) => (
                                <div key={i} className="flex items-center gap-1.5 py-1.5 px-2 nl-glass rounded-lg">
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
                      <div className="p-3 nl-glass rounded-xl space-y-2">
                        <p className="text-xs font-semibold text-slate-300">Connected DApps</p>
                        <p className="text-xs text-slate-500">No DApps connected — connection management coming in Phase 2</p>
                      </div>
                      <div className="p-3 nl-glass rounded-xl">
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

interface DecodedTx {
  tx_hash: string;
  chain: string;
  tx_type: string;
  token_in: string | null;
  token_out: string | null;
  amount_in: number | null;
  amount_out: number | null;
  usd_value: number | null;
  timestamp: string;
}

// Per-tx explorer URL — resolves the chain the tx actually happened on so
// multi-chain mode links to the right explorer, not just the active one.
function explorerTxUrl(txChainId: string, txHash: string): string {
  if (txChainId === 'solana') return `https://solscan.io/tx/${txHash}`;
  const c = SUPPORTED_CHAINS.find((x) => x.id === txChainId);
  return c ? `${c.explorerUrl}/tx/${txHash}` : `https://etherscan.io/tx/${txHash}`;
}

function ActivityTab({ address, chain, enabledChains }: { address: string; chain: ChainInfo; enabledChains: string[] }) {
  const [txs, setTxs] = useState<DecodedTx[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upstreamWarning, setUpstreamWarning] = useState<string | null>(null);
  // #39 — transaction-detail expansion: clicking a row opens a modal
  // with the full breakdown + copyable hash + explorer link.
  const [selectedTx, setSelectedTx] = useState<DecodedTx | null>(null);
  // Chains we can actually decode activity for (transactions API support).
  const scopeChains = useMemo(
    () => enabledChains.filter((c) => LIVE_CHAINS.includes(c)),
    [enabledChains],
  );
  const canGoGlobal = scopeChains.length > 1;
  const [scope, setScope] = useState<'current' | 'all'>('current');
  // Reset to current-chain view when the wallet/chain changes so the toggle
  // never shows stale cross-chain data for a different address.
  useEffect(() => { setScope('current'); }, [address]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      setError(null);
      setUpstreamWarning(null);
      setTxs(null);
      const chainsToFetch = scope === 'all' && canGoGlobal ? scopeChains : [chain.id];
      try {
        const results = await Promise.allSettled(
          chainsToFetch.map(async (cid) => {
            const res = await fetch(
              `/api/wallet/transactions?address=${encodeURIComponent(address)}&chain=${cid}&limit=30`,
              { signal: AbortSignal.timeout(20_000), cache: 'no-store' },
            );
            if (!res.ok) throw new Error(`status ${res.status}`);
            return (await res.json()) as { transactions: DecodedTx[]; upstream_error?: string | null };
          }),
        );
        if (cancelled) return;
        const merged: DecodedTx[] = [];
        let warn: string | null = null;
        let anyOk = false;
        for (const r of results) {
          if (r.status === 'fulfilled') {
            anyOk = true;
            merged.push(...(r.value.transactions ?? []));
            if (r.value.upstream_error && !warn) warn = r.value.upstream_error;
          }
        }
        // Merge the unified app trade ledger (swaps from the swap card, market,
        // View Proof, VTX; sends) so trades done anywhere in the app surface in
        // Activity — not just on-chain-decoded transfers. Best-effort.
        const ledgerResults = await Promise.allSettled(
          chainsToFetch.map(async (cid) => {
            const res = await fetch(
              `/api/trades/list?wallet=${encodeURIComponent(address)}&chain=${cid}&limit=50`,
              { signal: AbortSignal.timeout(15_000), cache: 'no-store' },
            );
            if (!res.ok) return { trades: [] as DecodedTx[] };
            return (await res.json()) as { trades: DecodedTx[] };
          }),
        );
        if (cancelled) return;
        for (const r of ledgerResults) {
          if (r.status === 'fulfilled') { anyOk = true; merged.push(...(r.value.trades ?? [])); }
        }
        if (!anyOk) throw new Error('Failed to load activity');
        // Newest first across all chains; de-dupe by hash so a swap that's both
        // ledger-recorded and on-chain-decoded shows once.
        const seen = new Set<string>();
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const deduped = merged.filter((t) => (t.tx_hash && seen.has(t.tx_hash) ? false : (t.tx_hash && seen.add(t.tx_hash), true)));
        setTxs(deduped.slice(0, 50));
        if (warn) setUpstreamWarning(warn);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity');
      }
    })();
    return () => { cancelled = true; };
  }, [address, chain.id, scope, canGoGlobal, scopeChains]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <ArrowUpRight className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm text-gray-300">No wallet selected</p>
      </div>
    );
  }

  // Current-chain vs all-networks toggle — only shown when more than one
  // decodable chain is enabled, so single-chain users see a clean list.
  const scopeToggle = canGoGlobal ? (
    <div className="flex items-center gap-1 mb-3 rounded-lg nl-glass p-1">
      {([
        { id: 'current' as const, label: chain.name },
        { id: 'all' as const, label: 'All networks' },
      ]).map((s) => (
        <button
          key={s.id}
          onClick={() => setScope(s.id)}
          style={scope === s.id ? { background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 12px rgba(0,102,255,.45)' } : undefined}
          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${scope === s.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  ) : null;

  let body: React.ReactNode;
  if (txs === null && !error) {
    body = <div className="py-6 text-center text-xs text-gray-300">Loading activity…</div>;
  } else if (error) {
    body = <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-200">{error}</div>;
  } else if (!txs || txs.length === 0) {
    body = (
      <div className="py-8 text-center">
        <div className="w-14 h-14 mx-auto mb-3 bg-white/5 rounded-2xl flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm text-gray-300">No transactions yet</p>
        <p className="text-xs text-gray-400 mt-1">Decoded on-chain activity will appear here</p>
      </div>
    );
  } else {
    body = (
      <div className="space-y-1">
        {upstreamWarning && (
          <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[10px] text-amber-200">
            Live decoder unavailable, showing cached entries · {upstreamWarning}
          </div>
        )}
        {txs.map((tx) => {
          const isSwap = tx.tx_type === 'swap';
          const isSend = tx.tx_type === 'send' || (tx.amount_out !== null && tx.amount_in === null);
          const date = new Date(tx.timestamp);
          const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          const Icon = isSwap ? Repeat : ArrowUpRight;
          const txChainId = tx.chain || chain.id;
          const txChainName = SUPPORTED_CHAINS.find((c) => c.id === txChainId)?.name ?? txChainId;
          const explorerTxHref = explorerTxUrl(txChainId, tx.tx_hash);
          return (
            <div
              key={`${txChainId}:${tx.tx_hash}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTx(tx)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTx(tx); } }}
              className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer focus:outline-none focus:bg-white/5"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSwap ? 'bg-[#0066FF]/10' : 'bg-[#F59E0B]/10'}`}>
                <Icon className={`w-4 h-4 ${isSwap ? 'text-[#0066FF]' : 'text-[#F59E0B]'}`} aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold capitalize">
                  {isSwap
                    ? `Swap ${tx.token_out ?? ''} → ${tx.token_in ?? ''}`.trim()
                    : isSend
                      ? `Send ${tx.token_out ?? chain.symbol}`
                      : `${tx.tx_type} ${tx.token_in ?? tx.token_out ?? ''}`}
                </p>
                <p className="text-[10px] text-gray-300">
                  {dateStr} · {timeStr}{scope === 'all' && canGoGlobal ? ` · ${txChainName}` : ''}
                </p>
              </div>
              <div className="text-end shrink-0">
                {tx.amount_out !== null && (
                  <p className="text-xs font-mono">-{tx.amount_out.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tx.token_out ?? ''}</p>
                )}
                {tx.amount_in !== null && (
                  <p className="text-[10px] text-[#10B981] font-mono">+{tx.amount_in.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tx.token_in ?? ''}</p>
                )}
                <a
                  href={explorerTxHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[9px] text-[#0066FF] hover:underline"
                >
                  View ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {scopeToggle}
      {body}
      {selectedTx && (
        <TxDetailModal tx={selectedTx} fallbackChainId={chain.id} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  );
}

/**
 * TxDetailModal — #39. Expands an activity row into a full-detail sheet:
 * type, full timestamp, network, per-leg amounts, USD value, the
 * complete (copyable) transaction hash, and a block-explorer link.
 * Renders only the fields the decoder/ledger actually returned — no
 * fabricated status or fee values.
 */
function TxDetailModal({
  tx,
  fallbackChainId,
  onClose,
}: {
  tx: DecodedTx;
  fallbackChainId: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const txChainId = tx.chain || fallbackChainId;
  const chainInfo = SUPPORTED_CHAINS.find((c) => c.id === txChainId);
  const chainName = chainInfo?.name ?? txChainId;
  const explorerName = txChainId === 'solana' ? 'SolScan' : (chainInfo?.explorerName ?? 'Explorer');
  const explorerHref = explorerTxUrl(txChainId, tx.tx_hash);
  const isSwap = tx.tx_type === 'swap';
  const isSend = tx.tx_type === 'send' || (tx.amount_out !== null && tx.amount_in === null);
  const Icon = isSwap ? Repeat : ArrowUpRight;
  const date = new Date(tx.timestamp);
  const title = isSwap
    ? `Swap ${tx.token_out ?? ''} → ${tx.token_in ?? ''}`.trim()
    : isSend
      ? `Send ${tx.token_out ?? ''}`.trim()
      : `${tx.tx_type} ${tx.token_in ?? tx.token_out ?? ''}`.trim();

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(tx.tx_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-slate-400 shrink-0">{label}</span>
      <span className="text-xs text-white text-end break-all">{value}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Transaction details"
    >
      <div
        className="w-full max-w-[440px] bg-[#0a0f1a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSwap ? 'bg-[#0066FF]/10' : 'bg-[#F59E0B]/10'}`}>
              <Icon className={`w-4 h-4 ${isSwap ? 'text-[#0066FF]' : 'text-[#F59E0B]'}`} aria-hidden />
            </div>
            <h2 className="text-base font-bold text-white capitalize truncate">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 shrink-0" aria-label="Close">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="rounded-2xl nl-glass px-4 py-1" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.18)' }}>
          <Row label="Type" value={<span className="capitalize">{tx.tx_type}</span>} />
          <Row label="Network" value={chainName} />
          <Row label="Date" value={date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} />
          {tx.amount_out !== null && (
            <Row label="Sent" value={<span className="font-mono">-{tx.amount_out.toLocaleString(undefined, { maximumFractionDigits: 8 })} {tx.token_out ?? ''}</span>} />
          )}
          {tx.amount_in !== null && (
            <Row label="Received" value={<span className="font-mono text-[#10B981]">+{tx.amount_in.toLocaleString(undefined, { maximumFractionDigits: 8 })} {tx.token_in ?? ''}</span>} />
          )}
          {tx.usd_value !== null && tx.usd_value > 0 && (
            <Row label="Value" value={`$${tx.usd_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
          )}
          <Row
            label="Tx hash"
            value={
              <button onClick={() => void copyHash()} className="inline-flex items-center gap-1.5 font-mono text-[#8FA3FF] hover:text-white transition-colors" title="Copy transaction hash">
                <span>{tx.tx_hash.slice(0, 10)}…{tx.tx_hash.slice(-8)}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            }
          />
        </div>

        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="nl-glass flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[#8FA3FF] text-sm font-semibold hover:-translate-y-px transition-transform"
          style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.3)' }}
        >
          View on {explorerName} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
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
  chains,
  testnetMode,
  onTestnetModeChange,
}: {
  onBack: () => void;
  enabled: string[];
  onChange: (next: string[]) => void;
  chains: ChainInfo[];
  testnetMode: boolean;
  onTestnetModeChange: (on: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const toggle = (id: string) => {
    const next = enabled.includes(id)
      ? enabled.filter((x) => x !== id)
      : [...enabled, id];
    // Guard: never let the user disable every chain at once — keep at
    // least one so the wallet home isn't an empty screen.
    if (next.length === 0) return;
    onChange(next);
  };
  const query = q.trim().toLowerCase();
  const visibleChains = query
    ? chains.filter((c) => c.name.toLowerCase().includes(query) || c.symbol.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
    : chains;

  return (
    <div className="min-h-screen text-white">
      <div className="sticky top-0 z-20 bg-[#0A0E27]/95 backdrop-blur-xl border-b border-slate-800/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-2 -ms-2 rounded-lg hover:bg-white/5">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold">Networks</h1>
            <p className="text-[11px] text-slate-500">Toggle which chains appear on your wallet home.</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Show-testnets master toggle */}
        <div className="mb-4 flex items-center justify-between nl-glass rounded-xl px-3.5 py-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.18)' }}>
          <div>
            <p className="text-sm font-semibold text-white">Show test networks</p>
            <p className="text-[11px] text-slate-500">Sepolia, Amoy &amp; more · no real value</p>
          </div>
          <ToggleSwitch on={testnetMode} onToggle={() => onTestnetModeChange(!testnetMode)} />
        </div>
        {/* #53 — search across the network catalog. */}
        <div className="mb-3 flex items-center gap-2 nl-glass rounded-xl px-3 py-2.5" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}>
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search networks…" className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-500" />
        </div>
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 overflow-hidden divide-y divide-slate-800/60">
          {visibleChains.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-slate-500">No networks match &ldquo;{q}&rdquo;.</div>
          )}
          {visibleChains.map((c) => {
            const isOn = enabled.includes(c.id);
            const isDefault = DEFAULT_ENABLED_CHAINS.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/[0.02] transition-colors text-start"
              >
                <img src={c.logoUrl} alt={c.name} className="w-7 h-7 rounded-full bg-slate-900" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <span>{c.symbol}</span>
                    {isDefault && <span className="text-[#4D6BFF]">· default</span>}
                    {c.testnet && <span className="text-amber-400">· testnet</span>}
                  </div>
                </div>
                {/* iOS-style toggle */}
                <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${isOn ? 'bg-[#0066FF]' : 'bg-slate-800'}`}>
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
