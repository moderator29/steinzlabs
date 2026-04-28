/**
 * Shared formatters for Telegram bot output.
 *
 * Telegram Markdown is finicky: `_*[]()~>#+-=|{}.!` all need escaping in
 * MarkdownV2. We use legacy "Markdown" parse mode (less strict — only
 * `*_[]\`` matter) so these helpers focus on numbers and trimming, not
 * deep escaping. If we ever flip to MarkdownV2, swap escapeMd() in.
 */

export function fmtUSD(n: number, opts: { sign?: boolean } = {}): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1_000_000_000_000) s = `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  else if (abs >= 1_000_000_000) s = `$${(n / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) s = `$${(n / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) s = `$${(n / 1_000).toFixed(2)}K`;
  else if (abs >= 1) s = `$${n.toFixed(2)}`;
  else if (abs >= 0.01) s = `$${n.toFixed(4)}`;
  else if (abs > 0) s = `$${n.toExponential(2)}`;
  else s = "$0";
  if (opts.sign && n > 0) s = `+${s}`;
  return s;
}

export function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtPctEmoji(n: number): string {
  if (!isFinite(n)) return "—";
  const arrow = n > 0 ? "📈" : n < 0 ? "📉" : "➡️";
  return `${arrow} ${fmtPct(n)}`;
}

export function fmtNum(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function truncAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length <= head + tail + 1) return addr ?? "";
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Escape backticks/asterisks/underscores in user-supplied strings before
 *  embedding in Markdown. Names with `_` (common in token symbols) break
 *  italic parsing otherwise. */
export function escapeMd(s: string): string {
  return s.replace(/([_*`\[\]])/g, "\\$1");
}
