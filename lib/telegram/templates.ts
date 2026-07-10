/**
 * Shared Telegram message-template system.
 *
 * ONE consistent look for every outbound bot message (whale / price / security /
 * sniper / news / announcement / digest). Everything below renders **HTML**
 * (Telegram parse_mode "HTML") rather than Markdown, because HTML needs only
 * three characters escaped — `& < >` — which we can do provably and safely for
 * arbitrary user/token/whale text. MarkdownV2 requires escaping 18+ characters
 * and one missed `.` or `-` breaks the whole message; HTML does not have that
 * failure mode, so we standardise on it here.
 *
 * Real data only: these builders format the fields the caller passes and never
 * invent numbers, links or headlines. Deep-links point at routes that exist on
 * https://nakalabs.xyz (verified against app/dashboard/**), so every inline
 * button lands somewhere real.
 *
 * Style: every builder takes a `TelegramStyle` — 'normal' (compact card, the
 * essentials + one or two buttons) or 'advanced' (more fields, more buttons).
 * Default is 'normal'. Per-user preference lives in
 * notification_settings.telegram_style (see the migration + resolveTelegramStyle).
 */

// ── canonical deep-link base ─────────────────────────────────────────────────
// The production domain. Hard-coded (like the whale email's viewUrl) so links
// always resolve to the live app, never a preview/vercel host.
export const NAKA_BASE = 'https://nakalabs.xyz';

export type TelegramStyle = 'normal' | 'advanced';

export function isTelegramStyle(v: unknown): v is TelegramStyle {
  return v === 'normal' || v === 'advanced';
}

/**
 * Resolve a user's preferred style from a notification_settings row (or any
 * object carrying `telegram_style`). Unknown / missing → 'normal'.
 */
export function resolveTelegramStyle(row: { telegram_style?: unknown } | null | undefined): TelegramStyle {
  return isTelegramStyle(row?.telegram_style) ? row.telegram_style : 'normal';
}

// ── inline keyboard primitives ───────────────────────────────────────────────
export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineButton[][];
}

/**
 * Build one inline button. Pass a URL string for a link button, or
 * `{ callback_data }` for a callback button (needs a webhook handler).
 *
 *   inlineButton('View on Naka', 'https://nakalabs.xyz/...')
 *   inlineButton('🔕 Mute', { callback_data: 'mute:whale:0xabc' })
 */
export function inlineButton(
  text: string,
  target: string | { url?: string; callback_data?: string },
): InlineButton {
  if (typeof target === 'string') return { text, url: target };
  return { text, ...target };
}

/**
 * Assemble rows of buttons into a reply_markup, dropping falsy buttons and any
 * row that ends up empty — so callers can conditionally include buttons inline
 * (`cond && inlineButton(...)`) without producing a broken keyboard. Returns
 * `undefined` when nothing survives, so it can be spread straight onto a send.
 */
export function inlineKeyboard(
  ...rows: Array<Array<InlineButton | null | undefined | false>>
): InlineKeyboardMarkup | undefined {
  const cleaned = rows
    .map((r) => r.filter((b): b is InlineButton => Boolean(b)))
    .filter((r) => r.length > 0);
  return cleaned.length > 0 ? { inline_keyboard: cleaned } : undefined;
}

// ── deep-link builders (all routes verified to exist) ────────────────────────
export const nakaLinks = {
  whale: (address: string, chain: string) =>
    `${NAKA_BASE}/dashboard/whale-tracker/${encodeURIComponent(address)}?chain=${encodeURIComponent(chain)}`,
  whaleTracker: () => `${NAKA_BASE}/dashboard/whale-tracker`,
  submitWhale: () => `${NAKA_BASE}/dashboard/whale-tracker/submit`,
  token: (id: string) => `${NAKA_BASE}/dashboard/token-preview/${encodeURIComponent(id)}`,
  alerts: () => `${NAKA_BASE}/dashboard/alerts`,
  newAlert: (token?: string | null) =>
    token
      ? `${NAKA_BASE}/dashboard/alerts/new?token=${encodeURIComponent(token)}`
      : `${NAKA_BASE}/dashboard/alerts/new`,
  sniper: () => `${NAKA_BASE}/dashboard/sniper`,
  securityCenter: () => `${NAKA_BASE}/security-center`,
  securityScanner: () => `${NAKA_BASE}/dashboard/security-scanner`,
  swap: (token?: string | null) =>
    token ? `${NAKA_BASE}/dashboard/swap?token=${encodeURIComponent(token)}` : `${NAKA_BASE}/dashboard/swap`,
  news: () => `${NAKA_BASE}/dashboard?subtab=news`,
  notifications: () => `${NAKA_BASE}/dashboard/notifications`,
} as const;

// ── render shapes ────────────────────────────────────────────────────────────
export interface TelegramRender {
  text: string;
  parse_mode: 'HTML';
  disable_web_page_preview: boolean;
  reply_markup?: InlineKeyboardMarkup;
}
export interface TelegramPhotoRender {
  photo: string;
  caption: string;
  parse_mode: 'HTML';
  reply_markup?: InlineKeyboardMarkup;
}

// ── HTML-safe primitives ─────────────────────────────────────────────────────
/** Escape the only three characters Telegram HTML cares about. */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const b = (s: unknown): string => `<b>${escapeHtml(s)}</b>`;
export const i = (s: unknown): string => `<i>${escapeHtml(s)}</i>`;
export const code = (s: unknown): string => `<code>${escapeHtml(s)}</code>`;
/** Safe anchor — escapes both the visible text and the href. */
export const link = (text: unknown, url: string): string =>
  `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;

const RULE = '━━━━━━━━━━━━━━━';

// ── number / value formatting (self-contained so templates.ts has no deps) ───
export function fmtUsd(n: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1e12) s = `$${(n / 1e12).toFixed(2)}T`;
  else if (abs >= 1e9) s = `$${(n / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) s = `$${(n / 1e6).toFixed(2)}M`;
  else if (abs >= 1e3) s = `$${(n / 1e3).toFixed(1)}K`;
  else if (abs >= 1) s = `$${n.toFixed(2)}`;
  else if (abs >= 0.01) s = `$${n.toFixed(4)}`;
  else if (abs > 0) s = `$${n.toExponential(2)}`;
  else s = '$0';
  if (opts.sign && n > 0) s = `+${s}`;
  return s;
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const arrow = n > 0 ? '🟢' : n < 0 ? '🔴' : '⚪';
  const sign = n > 0 ? '+' : '';
  return `${arrow} ${sign}${n.toFixed(2)}%`;
}

export function shortAddress(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr) return '';
  return addr.length <= head + tail + 1 ? addr : `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** "3m ago" / "2h ago" / "4d ago" from an ISO string. Empty when unparseable. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── the card renderer — the single source of visual consistency ──────────────
export interface CardField {
  label: string;
  /** Pre-rendered, HTML-safe value (use b()/link()/escapeHtml() to build it). */
  value: string;
}
export interface CardOpts {
  icon: string;
  /** Plain text — escaped by the renderer. */
  title: string;
  /** Plain text — escaped, shown italic under the title. */
  subtitle?: string;
  fields?: CardField[];
  /** Pre-rendered, HTML-safe body block. */
  body?: string;
  /** Plain text — escaped, shown small/italic at the bottom. */
  footer?: string;
}

/**
 * Render the canonical card:
 *
 *   {icon} <b>TITLE</b>
 *   <i>subtitle</i>
 *
 *   <b>Label</b> value
 *   ...
 *
 *   body
 *
 *   <i>footer</i>
 */
export function renderCard(opts: CardOpts): string {
  const lines: string[] = [];
  lines.push(`${opts.icon} ${b(opts.title)}`);
  if (opts.subtitle) lines.push(i(opts.subtitle));
  if (opts.fields && opts.fields.length > 0) {
    lines.push('');
    for (const f of opts.fields) lines.push(`${b(f.label)}  ${f.value}`);
  }
  if (opts.body) {
    lines.push('');
    lines.push(opts.body);
  }
  if (opts.footer) {
    lines.push('');
    lines.push(i(opts.footer));
  }
  return lines.join('\n');
}

// ═════════════════════════════════════════════════════════════════════════════
// Message builders — one per outbound type. Each returns a TelegramRender.
// ═════════════════════════════════════════════════════════════════════════════

// ── whale alert ──────────────────────────────────────────────────────────────
export interface WhaleAlertData {
  whaleName: string;
  direction: 'buy' | 'sell' | 'transfer';
  amountUsd: number;
  tokenSymbol?: string | null;
  chain: string;
  address: string;
  txHash?: string | null;
  // advanced-only enrichment (all optional, real data)
  whaleScore?: number | null;
  archetype?: string | null;
  activeDays7d?: number | null;
  counterparty?: string | null;
}

const DIR_VERB: Record<WhaleAlertData['direction'], string> = {
  buy: 'bought',
  sell: 'sold',
  transfer: 'moved',
};

export function whaleAlertMessage(d: WhaleAlertData, style: TelegramStyle = 'normal'): TelegramRender {
  const verb = DIR_VERB[d.direction];
  const sym = d.tokenSymbol ? `$${d.tokenSymbol}` : 'tokens';
  const trackerUrl = nakaLinks.whale(d.address, d.chain);

  if (style === 'normal') {
    return {
      text: renderCard({
        icon: '🐋',
        title: `${d.whaleName} ${verb} ${fmtUsd(d.amountUsd)}`,
        body: `${escapeHtml(sym)} on ${escapeHtml(d.chain)}`,
      }),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: inlineKeyboard([inlineButton('🐋 View on Naka', trackerUrl)]),
    };
  }

  const fields: CardField[] = [
    { label: 'Token', value: escapeHtml(sym) },
    { label: 'Value', value: escapeHtml(fmtUsd(d.amountUsd)) },
    { label: 'Chain', value: escapeHtml(d.chain) },
    { label: 'Wallet', value: code(shortAddress(d.address)) },
  ];
  if (typeof d.whaleScore === 'number') fields.push({ label: 'Naka score', value: escapeHtml(String(d.whaleScore)) });
  if (d.archetype) fields.push({ label: 'Type', value: escapeHtml(d.archetype.replace(/_/g, ' ')) });
  if (typeof d.activeDays7d === 'number' && d.activeDays7d > 0)
    fields.push({ label: 'Active', value: escapeHtml(`${d.activeDays7d}/7 days`) });
  if (d.counterparty) fields.push({ label: 'Counterparty', value: escapeHtml(d.counterparty) });

  return {
    text: renderCard({
      icon: '🐋',
      title: `${d.whaleName} ${verb} ${fmtUsd(d.amountUsd)}`,
      subtitle: `Whale move · ${d.chain}`,
      fields,
      footer: 'You follow this wallet in the Whale Tracker.',
    }),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: inlineKeyboard(
      [inlineButton('🐋 View whale', trackerUrl), inlineButton('🔔 Alerts', nakaLinks.notifications())],
      d.txHash ? [inlineButton('🔍 Transaction', txExplorerUrl(d.chain, d.txHash))] : [],
    ),
  };
}

// ── price alert ──────────────────────────────────────────────────────────────
export interface PriceAlertData {
  symbol: string;
  name?: string | null;
  price: number;
  direction: 'above' | 'below';
  threshold?: number | null;
  tokenId?: string | null; // coingecko id for deep-links
  changePct24h?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
}

export function priceAlertMessage(d: PriceAlertData, style: TelegramStyle = 'normal'): TelegramRender {
  const icon = d.direction === 'above' ? '📈' : '📉';
  const name = d.name || d.symbol;
  const title = `${name} ${d.direction} ${fmtUsd(d.threshold ?? d.price)}`;
  const openToken = d.tokenId ? nakaLinks.token(d.tokenId) : nakaLinks.alerts();

  if (style === 'normal') {
    return {
      text: renderCard({
        icon,
        title: `${d.symbol.toUpperCase()} ${fmtUsd(d.price)}`,
        subtitle: title,
      }),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: inlineKeyboard([inlineButton('📊 Open token', openToken)]),
    };
  }

  const fields: CardField[] = [
    { label: 'Price', value: escapeHtml(fmtUsd(d.price)) },
    { label: 'Trigger', value: escapeHtml(`${d.direction} ${fmtUsd(d.threshold ?? d.price)}`) },
  ];
  if (typeof d.changePct24h === 'number') fields.push({ label: '24h', value: escapeHtml(fmtPct(d.changePct24h)) });
  if (typeof d.marketCap === 'number') fields.push({ label: 'Mkt cap', value: escapeHtml(fmtUsd(d.marketCap)) });
  if (typeof d.volume24h === 'number') fields.push({ label: 'Volume', value: escapeHtml(fmtUsd(d.volume24h)) });

  return {
    text: renderCard({
      icon,
      title: `${d.symbol.toUpperCase()} · ${name}`,
      subtitle: 'Price alert triggered',
      fields,
    }),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: inlineKeyboard(
      [inlineButton('📊 Open token', openToken), inlineButton('💱 Trade', nakaLinks.swap(d.tokenId))],
      [inlineButton('🔔 Manage alert', nakaLinks.newAlert(d.tokenId))],
    ),
  };
}

// ── security alert ───────────────────────────────────────────────────────────
export type Severity = 'low' | 'medium' | 'high' | 'critical';
const SEVERITY_ICON: Record<Severity, string> = {
  low: '🟡',
  medium: '🟠',
  high: '🔴',
  critical: '🚨',
};

export interface SecurityAlertData {
  title: string;
  severity: Severity;
  tokenSymbol?: string | null;
  address?: string | null;
  chain?: string | null;
  findings?: string[];
  scanUrl?: string | null; // full deep-link if the caller has one
}

export function securityAlertMessage(d: SecurityAlertData, style: TelegramStyle = 'normal'): TelegramRender {
  const icon = SEVERITY_ICON[d.severity] ?? '🛡️';
  const reportUrl = d.scanUrl || nakaLinks.securityCenter();
  const subject = d.tokenSymbol ? `$${d.tokenSymbol}` : d.address ? shortAddress(d.address) : undefined;

  if (style === 'normal') {
    return {
      text: renderCard({
        icon,
        title: d.title,
        subtitle: subject ? `${subject} · ${d.severity.toUpperCase()}` : d.severity.toUpperCase(),
      }),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: inlineKeyboard([inlineButton('🔍 Full report', reportUrl)]),
    };
  }

  const fields: CardField[] = [{ label: 'Severity', value: escapeHtml(d.severity.toUpperCase()) }];
  if (subject) fields.push({ label: 'Subject', value: escapeHtml(subject) });
  if (d.chain) fields.push({ label: 'Chain', value: escapeHtml(d.chain) });
  if (d.address) fields.push({ label: 'Address', value: code(shortAddress(d.address)) });

  const body =
    d.findings && d.findings.length > 0
      ? d.findings.slice(0, 5).map((f) => `• ${escapeHtml(f)}`).join('\n')
      : undefined;

  return {
    text: renderCard({
      icon,
      title: d.title,
      subtitle: 'Security alert',
      fields,
      body,
    }),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: inlineKeyboard(
      [inlineButton('🔍 Full report', reportUrl)],
      [inlineButton('🛡️ Scanner', nakaLinks.securityScanner())],
    ),
  };
}

// ── sniper ───────────────────────────────────────────────────────────────────
export interface SniperData {
  tokenSymbol: string;
  action: 'detected' | 'bought' | 'sold' | 'failed';
  amountUsd?: number | null;
  price?: number | null;
  pnlPct?: number | null;
  reason?: string | null;
  txHash?: string | null;
  chain?: string | null;
  tokenId?: string | null;
}

const SNIPER_ICON: Record<SniperData['action'], string> = {
  detected: '🎯',
  bought: '🟢',
  sold: '💰',
  failed: '⚠️',
};

export function sniperMessage(d: SniperData, style: TelegramStyle = 'normal'): TelegramRender {
  const icon = SNIPER_ICON[d.action] ?? '🎯';
  const verb = d.action === 'detected' ? 'target detected' : d.action;
  const title = `$${d.tokenSymbol} — ${verb}`;

  if (style === 'normal') {
    const bits = [d.amountUsd ? fmtUsd(d.amountUsd) : null, d.price ? `@ ${fmtUsd(d.price)}` : null]
      .filter(Boolean)
      .join(' ');
    return {
      text: renderCard({ icon, title, subtitle: bits || undefined }),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: inlineKeyboard([inlineButton('🎯 Open Sniper', nakaLinks.sniper())]),
    };
  }

  const fields: CardField[] = [];
  if (typeof d.amountUsd === 'number') fields.push({ label: 'Size', value: escapeHtml(fmtUsd(d.amountUsd)) });
  if (typeof d.price === 'number') fields.push({ label: 'Price', value: escapeHtml(fmtUsd(d.price)) });
  if (typeof d.pnlPct === 'number') fields.push({ label: 'PnL', value: escapeHtml(fmtPct(d.pnlPct)) });
  if (d.chain) fields.push({ label: 'Chain', value: escapeHtml(d.chain) });

  return {
    text: renderCard({
      icon,
      title,
      subtitle: 'Sniper',
      fields: fields.length ? fields : undefined,
      body: d.reason ? escapeHtml(d.reason) : undefined,
    }),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: inlineKeyboard(
      [inlineButton('🎯 Open Sniper', nakaLinks.sniper()), d.tokenId ? inlineButton('📊 Token', nakaLinks.token(d.tokenId)) : null],
      d.txHash && d.chain ? [inlineButton('🔍 Transaction', txExplorerUrl(d.chain, d.txHash))] : [],
    ),
  };
}

// ── news ─────────────────────────────────────────────────────────────────────
export interface NewsHeadline {
  title: string;
  url: string;
  source: string;
  publishedAt?: string | null;
}

/**
 * Clean, numbered crypto-news drop. Real headlines only (the caller supplies
 * them from the news aggregator). Normal = numbered link list + a "News feed"
 * button. Advanced = the same list with relative timestamps PLUS one numbered
 * inline-button per headline that opens the article directly.
 */
export function newsMessage(
  headlines: NewsHeadline[],
  style: TelegramStyle = 'normal',
  opts: { heading?: string; limit?: number } = {},
): TelegramRender {
  const heading = opts.heading || 'Naka Labs — Crypto News';
  const list = headlines.slice(0, opts.limit ?? (style === 'advanced' ? 8 : 6));

  const rows = list.map((h, idx) => {
    const n = idx + 1;
    const when = style === 'advanced' ? relativeTime(h.publishedAt) : '';
    const meta = [h.source, when].filter(Boolean).join(' · ');
    return `${b(`${n}.`)} ${link(h.title, h.url)}\n${i(meta)}`;
  });

  const body = [`${b(heading)}`, i(`Top ${list.length} headlines right now`), '', rows.join('\n\n')].join('\n');

  // Advanced: numbered buttons that open each article (capped at 8, wrapped 4/row),
  // plus the News feed button. Normal: just the News feed button.
  const keyboard =
    style === 'advanced'
      ? inlineKeyboard(
          list.slice(0, 4).map((h, idx) => inlineButton(String(idx + 1), h.url)),
          list.slice(4, 8).map((h, idx) => inlineButton(String(idx + 5), h.url)),
          [inlineButton('🗞️ Open News feed', nakaLinks.news())],
        )
      : inlineKeyboard([inlineButton('🗞️ Open News feed', nakaLinks.news())]);

  return {
    text: `📰 ${body}`,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: keyboard,
  };
}

// ── announcement banner ──────────────────────────────────────────────────────
export interface AnnouncementData {
  /** Small chip above the title, e.g. "Product Update", "Research Brief". */
  tag?: string;
  title: string;
  /** Body copy — plain text; newlines preserved, HTML-escaped. */
  body: string;
  /** Optional CTA buttons — every URL must be a real link the caller controls. */
  buttons?: Array<{ text: string; url: string }>;
  footer?: string;
  /** Optional banner image; when set, prefer announcementPhotoMessage. */
  imageUrl?: string | null;
}

function announcementBody(d: AnnouncementData): string {
  const lines: string[] = [];
  lines.push(RULE);
  lines.push(`✦ ${b('NAKA LABS')}${d.tag ? `  ·  ${i(d.tag)}` : ''}`);
  lines.push(RULE);
  lines.push('');
  lines.push(b(d.title));
  lines.push('');
  // Preserve author line breaks; escape each line.
  lines.push(d.body.split('\n').map((ln) => escapeHtml(ln)).join('\n'));
  lines.push('');
  lines.push(i(d.footer || 'Naka Labs — the intelligence layer for on-chain alpha.'));
  return lines.join('\n');
}

function announcementKeyboard(d: AnnouncementData, style: TelegramStyle): InlineKeyboardMarkup | undefined {
  const btns = (d.buttons ?? []).map((btn) => inlineButton(btn.text, btn.url));
  // Advanced surfaces a couple of buttons per row; normal keeps one per row.
  if (style === 'advanced' && btns.length > 1) {
    const rows: InlineButton[][] = [];
    for (let k = 0; k < btns.length; k += 2) rows.push(btns.slice(k, k + 2));
    return inlineKeyboard(...rows);
  }
  return inlineKeyboard(...btns.map((btn) => [btn]));
}

/** Text-only announcement banner (no image). */
export function announcementMessage(d: AnnouncementData, style: TelegramStyle = 'normal'): TelegramRender {
  return {
    text: announcementBody(d),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: announcementKeyboard(d, style),
  };
}

/**
 * Image/banner announcement — a premium card with a hero image on top, matching
 * the Research Labs brief feel. Requires d.imageUrl. Telegram photo captions cap
 * at 1024 chars; the body is trimmed to stay safe.
 */
export function announcementPhotoMessage(
  d: AnnouncementData & { imageUrl: string },
  style: TelegramStyle = 'normal',
): TelegramPhotoRender {
  let caption = announcementBody(d);
  if (caption.length > 1024) caption = `${caption.slice(0, 1000)}…`;
  return {
    photo: d.imageUrl,
    caption,
    parse_mode: 'HTML',
    reply_markup: announcementKeyboard(d, style),
  };
}

// ── generic digest ───────────────────────────────────────────────────────────
export interface DigestSection {
  label: string;
  /** Pre-rendered, HTML-safe lines. */
  lines: string[];
}
export interface DigestData {
  heading: string;
  subtitle?: string;
  sections: DigestSection[];
  buttons?: Array<{ text: string; url: string }>;
}

export function digestMessage(d: DigestData, style: TelegramStyle = 'normal'): TelegramRender {
  const parts: string[] = [`📮 ${b(d.heading)}`];
  if (d.subtitle) parts.push(i(d.subtitle));
  for (const s of d.sections) {
    if (s.lines.length === 0) continue;
    parts.push('');
    parts.push(b(s.label));
    // Normal caps each section to keep the card compact; advanced shows all.
    const shown = style === 'normal' ? s.lines.slice(0, 3) : s.lines;
    parts.push(shown.join('\n'));
  }
  return {
    text: parts.join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: inlineKeyboard(...(d.buttons ?? []).map((btn) => [inlineButton(btn.text, btn.url)])),
  };
}

// ── generic notification card (used by lib/telegram/notify.ts) ───────────────
export interface NotificationCardData {
  kind: 'price' | 'whale' | 'security' | 'alert' | 'sniper' | 'copy' | 'general';
  title: string;
  body?: string | null;
  /** Absolute or app-relative URL. Relative paths are resolved against NAKA_BASE. */
  url?: string | null;
}

const KIND_ICON: Record<NotificationCardData['kind'], string> = {
  price: '📈',
  whale: '🐋',
  security: '🛡️',
  alert: '🔔',
  sniper: '🎯',
  copy: '👥',
  general: '💠',
};

/** Resolve a possibly-relative URL to an absolute nakalabs.xyz link. */
export function absoluteNakaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${NAKA_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * The consistent card used for generic platform notifications pushed to
 * Telegram (whale-alert-dispatcher, alert-monitor, etc. all flow through
 * lib/telegram/notify.ts). Advanced adds a "Manage alerts" button so users can
 * self-serve without leaving Telegram.
 */
export function notificationMessage(d: NotificationCardData, style: TelegramStyle = 'normal'): TelegramRender {
  const icon = KIND_ICON[d.kind] ?? KIND_ICON.general;
  const openUrl = d.url ? absoluteNakaUrl(d.url) : null;

  const primary = openUrl ? inlineButton('🔗 Open in Naka', openUrl) : null;
  const manage = style === 'advanced' ? inlineButton('🔔 Manage alerts', nakaLinks.notifications()) : null;

  return {
    text: renderCard({
      icon,
      title: d.title,
      body: d.body ? escapeHtml(d.body) : undefined,
    }),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: inlineKeyboard([primary, manage]),
  };
}

// ── explorer links (real, per-chain) ─────────────────────────────────────────
const EXPLORER_TX: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  eth: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  bsc: 'https://bscscan.com/tx/',
  bnb: 'https://bscscan.com/tx/',
  avalanche: 'https://snowtrace.io/tx/',
  avax: 'https://snowtrace.io/tx/',
  solana: 'https://solscan.io/tx/',
  sol: 'https://solscan.io/tx/',
};

/** Block-explorer tx URL for a chain; falls back to the Naka whale tracker. */
export function txExplorerUrl(chain: string, txHash: string): string {
  const base = EXPLORER_TX[chain.toLowerCase()];
  return base ? `${base}${txHash}` : nakaLinks.whaleTracker();
}
