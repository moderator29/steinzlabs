/**
 * Top-N holder labelling. Turns a list of token holders into named
 * archetypes (CEX / LP / dev / whale / fresh / contract / unknown)
 * so the SecurityPanel can render "Binance hot wallet — 12.3%"
 * instead of an opaque 0x… string. Pure — no IO. Callers provide
 * already-fetched Arkham-style labels + on-chain hints.
 *
 * Audit §5.8 B.4 — fresh primitive.
 */

export type HolderLabel =
  | 'cex'         // Centralized exchange wallet
  | 'lp'          // DEX liquidity-pool contract
  | 'dev'         // Token deployer or owner
  | 'whale'       // Smart-money / known whale
  | 'fresh'       // Wallet created < 7 days ago
  | 'contract'    // Generic smart contract
  | 'unknown';

export interface HolderInfo {
  address: string;
  /** 0..1 share of supply. */
  share: number;
  /** Optional Arkham / Etherscan label (e.g. "Binance 14"). */
  externalLabel?: string;
  /** True when the address is a smart contract. */
  isContract?: boolean;
  /** Wallet age in seconds (first-seen → now). */
  ageSec?: number;
  /** True when the address matches the token deployer. */
  isDeployer?: boolean;
  /** True when the address is a known smart-money wallet. */
  isSmartMoney?: boolean;
  /** True when the address holds the LP pair token (heuristic for DEX pool). */
  isLpPool?: boolean;
}

export interface LabeledHolder {
  address: string;
  share: number;
  label: HolderLabel;
  display: string;
}

const CEX_KEYWORDS = ['binance', 'coinbase', 'kraken', 'okx', 'bybit', 'gate', 'kucoin', 'bitfinex', 'huobi', 'mexc'];

function classify(holder: HolderInfo): HolderLabel {
  if (holder.isDeployer) return 'dev';
  if (holder.isLpPool) return 'lp';
  if (holder.externalLabel) {
    const lower = holder.externalLabel.toLowerCase();
    if (CEX_KEYWORDS.some((k) => lower.includes(k))) return 'cex';
  }
  if (holder.isSmartMoney) return 'whale';
  if (holder.isContract) return 'contract';
  if (typeof holder.ageSec === 'number' && holder.ageSec < 7 * 86_400) return 'fresh';
  return 'unknown';
}

function display(label: HolderLabel, holder: HolderInfo): string {
  switch (label) {
    case 'cex':
      return holder.externalLabel ?? 'Exchange';
    case 'lp':
      return 'DEX pool';
    case 'dev':
      return 'Deployer';
    case 'whale':
      return holder.externalLabel ?? 'Smart money';
    case 'fresh':
      return 'Fresh wallet';
    case 'contract':
      return holder.externalLabel ?? 'Contract';
    default:
      return holder.externalLabel ?? 'Unknown';
  }
}

export function labelHolders(holders: HolderInfo[]): LabeledHolder[] {
  return holders.map((h) => {
    const label = classify(h);
    return {
      address: h.address,
      share: h.share,
      label,
      display: display(label, h),
    };
  });
}
