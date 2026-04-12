export function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

export function formatLargeNumber(n: number): string {
  if (!n || isNaN(n)) return '$0';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatSupply(n: number | null, symbol: string): string {
  if (!n) return 'N/A';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T ${symbol}`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B ${symbol}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M ${symbol}`;
  return `${n.toLocaleString()} ${symbol}`;
}

export function formatPercent(pct: number | undefined | null): string {
  if (pct == null || isNaN(pct)) return '0.00%';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diffMs = now - ts * 1000;
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function timeframeToDays(tf: string): string {
  const map: Record<string, string> = { '1H': '1', '6H': '1', '1D': '1', '1W': '7', '1M': '30', '1Y': '365', 'ALL': 'max' };
  return map[tf] ?? '1';
}
