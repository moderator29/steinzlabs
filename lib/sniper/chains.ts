/**
 * Chain configuration for the sniper bot.
 *
 * Five chains supported per spec: Ethereum, Solana, BNB Chain, TON, Avalanche.
 * Each chain has different mempool semantics (EVM mempool vs Solana priority
 * fees vs TON message rounds), different MEV-protect options, and different
 * native gas units. The sniper engine reads from this map so adding a chain
 * is a matter of adding one row, not patching every code path.
 */

export type SniperChain = "ethereum" | "solana" | "bsc" | "ton" | "avalanche";

export interface ChainConfig {
  id: SniperChain;
  symbol: string;        // Native token symbol (ETH, SOL, BNB, TON, AVAX)
  name: string;          // User-facing display name
  decimals: number;      // Native token decimals
  logo: string;          // Public logo URL
  explorerTxBase: string; // Append tx hash → full URL
  /** Mempool data source for new-token detection. */
  source: "alchemy" | "helius" | "ton-center";
  /** MEV-protect RPC label shown in UI. */
  mevProtect: { label: string; available: boolean };
  /** Default priority fee in native units (gwei for EVM, microlamports for SOL). */
  defaultPriorityFee: number;
  /** Default slippage in bps (100 bps = 1%). */
  defaultSlippageBps: number;
  /** Recommended snipe-amount presets in native units. */
  amountPresets: number[];
  /** Whether pre-launch sniping (mempool intercept before token tradable) is supported. */
  preLaunchSnipe: boolean;
}

export const CHAIN_CONFIGS: Record<SniperChain, ChainConfig> = {
  ethereum: {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    explorerTxBase: "https://etherscan.io/tx/",
    source: "alchemy",
    mevProtect: { label: "Flashbots Protect", available: true },
    defaultPriorityFee: 2, // gwei
    defaultSlippageBps: 200,
    amountPresets: [0.01, 0.05, 0.1, 0.5, 1],
    preLaunchSnipe: true,
  },
  solana: {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    explorerTxBase: "https://solscan.io/tx/",
    source: "helius",
    mevProtect: { label: "Jito Bundle", available: true },
    defaultPriorityFee: 100_000, // microlamports
    defaultSlippageBps: 500,
    amountPresets: [0.1, 0.5, 1, 2, 5],
    preLaunchSnipe: true,
  },
  bsc: {
    id: "bsc",
    symbol: "BNB",
    name: "BNB Chain",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    explorerTxBase: "https://bscscan.com/tx/",
    source: "alchemy",
    mevProtect: { label: "BloxRoute Cloud", available: true },
    defaultPriorityFee: 3, // gwei
    defaultSlippageBps: 300,
    amountPresets: [0.05, 0.1, 0.5, 1, 5],
    preLaunchSnipe: true,
  },
  ton: {
    id: "ton",
    symbol: "TON",
    name: "TON",
    decimals: 9,
    logo: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
    explorerTxBase: "https://tonscan.org/tx/",
    source: "ton-center",
    // TON has no traditional mempool — every message is broadcast to validators
    // directly. Front-running is structurally harder so MEV-protect is a no-op.
    mevProtect: { label: "TON has no mempool", available: false },
    defaultPriorityFee: 0.05, // TON
    defaultSlippageBps: 500,
    amountPresets: [1, 5, 10, 25, 100],
    preLaunchSnipe: false,
  },
  avalanche: {
    id: "avalanche",
    symbol: "AVAX",
    name: "Avalanche",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
    explorerTxBase: "https://snowtrace.io/tx/",
    source: "alchemy",
    mevProtect: { label: "Avalanche has no MEV", available: false },
    defaultPriorityFee: 25, // nAVAX (gwei equivalent)
    defaultSlippageBps: 300,
    amountPresets: [0.5, 1, 5, 10, 25],
    preLaunchSnipe: true,
  },
};

export const SNIPER_CHAINS: SniperChain[] = ["solana", "ethereum", "bsc", "ton", "avalanche"];

export function getChainConfig(chain: string): ChainConfig | null {
  return CHAIN_CONFIGS[chain as SniperChain] ?? null;
}
