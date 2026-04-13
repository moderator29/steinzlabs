/**
 * Shared formatting utilities for displaying numbers, currencies, addresses, and dates.
 */

export function formatUSD(value: number, options: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = false, decimals } = options;

  if (!isFinite(value)) return '$0.00';

  if (compact && Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(decimals ?? 2)}B`;
  }
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(decimals ?? 2)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(decimals ?? 1)}K`;
  }

  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals ?? 2,
    maximumFractionDigits: decimals ?? 2,
  });
}

export function formatPercent(value: number, options: { decimals?: number; showSign?: boolean } = {}): string {
  const { decimals = 2, showSign = true } = options;
  if (!isFinite(value)) return '0.00%';
  const formatted = Math.abs(value).toFixed(decimals) + '%';
  if (!showSign) return formatted;
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatTokenAmount(value: number, symbol?: string, decimals = 4): string {
  if (!isFinite(value)) return `0 ${symbol ?? ''}`.trim();

  let formatted: string;
  if (value === 0) {
    formatted = '0';
  } else if (Math.abs(value) < 0.0001) {
    formatted = value.toExponential(2);
  } else if (Math.abs(value) < 1) {
    formatted = value.toFixed(decimals);
  } else if (Math.abs(value) < 1_000) {
    formatted = value.toFixed(Math.min(decimals, 4));
  } else {
    formatted = value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatLargeNumber(value: number, decimals = 2): string {
  if (!isFinite(value)) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(decimals)}K`;
  return `${sign}${abs.toFixed(decimals)}`;
}

export function formatAddress(address: string, options: { prefixLen?: number; suffixLen?: number } = {}): string {
  if (!address) return '';
  const { prefixLen = 6, suffixLen = 4 } = options;
  if (address.length <= prefixLen + suffixLen + 3) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

export function formatTimeAgo(dateOrMs: Date | number | string): string {
  const date = typeof dateOrMs === 'number' ? new Date(dateOrMs) : new Date(dateOrMs);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60)   return `${diffSecs}s ago`;
  if (diffMins < 60)   return `${diffMins}m ago`;
  if (diffHours < 24)  return `${diffHours}h ago`;
  if (diffDays < 30)   return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60)   return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)   return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
