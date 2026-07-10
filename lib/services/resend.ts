import 'server-only';
import { Resend } from 'resend';
import { brandedEmailWrapper, emailButton } from '@/lib/email';

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz').replace(/\/$/, '');
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Shared card + row primitives for the near-black glass email system.
const glassCard = (inner: string) =>
  `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:16px 18px;margin-bottom:18px;">${inner}</div>`;
const statRow = (label: string, value: string, color = '#ffffff', last = false) =>
  `<tr><td style="padding:9px 0;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,0.07);'}font-size:13px;color:#8a93a8;">${label}</td><td style="padding:9px 0;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,0.07);'}font-size:13px;font-weight:700;color:${color};text-align:right;">${value}</td></tr>`;

/**
 * Resend Email Delivery Service
 * Handles: broadcast emails, price alerts, security alerts, notifications.
 * FROM address: alerts@nakalabs.xyz (or configured via RESEND_FROM_EMAIL)
 */

// Lazily constructed: building the client at module scope throws
// "Missing API key" at import/build time on any route that transitively
// imports this file when RESEND_API_KEY is unset, taking the whole route
// down. Defer construction to first send.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.RESEND_FROM_EMAIL || 'alerts@nakalabs.xyz';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Naka Labs';

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

export async function sendBroadcast(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}): Promise<EmailResult> {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      tags: params.tags,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
  }
}

// ─── Price Alert ──────────────────────────────────────────────────────────────

export async function sendPriceAlert(params: {
  to: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  direction: 'above' | 'below';
  changePercent?: number;
}): Promise<EmailResult> {
  const { symbol, currentPrice, targetPrice, direction, changePercent } = params;
  const sym = esc(symbol);
  const isUp = direction === 'above';
  const arrow = isUp ? '▲' : '▼';
  const accent = isUp ? '#10B981' : '#ef4444';
  const changePart = changePercent !== undefined
    ? `<div style="font-size:14px;font-weight:600;color:${accent};margin-top:8px;">${arrow} ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% in 24h</div>`
    : '';

  const body = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#dfe4ee;">${sym} moved ${direction} your target of <strong style="color:#ffffff;">$${targetPrice.toLocaleString()}</strong>.</p>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:22px;text-align:center;margin-bottom:22px;">
      <div style="font-size:11px;letter-spacing:.08em;color:#8a93a8;text-transform:uppercase;">Current price</div>
      <div style="font-size:36px;font-weight:800;color:${accent};line-height:1.05;margin-top:6px;letter-spacing:-0.5px;">$${currentPrice.toLocaleString()}</div>
      ${changePart}
    </div>
    ${emailButton(`${APP_BASE_URL}/dashboard/alerts`, 'Manage alerts')}
    <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#7c869c;">You're receiving this because you set a price alert on Naka Labs.</p>`;
  const html = brandedEmailWrapper(`Price alert: ${sym}`, `${sym} crossed your target`, body);

  return sendBroadcast({
    to: params.to,
    subject: `${arrow} ${symbol} hit $${currentPrice.toLocaleString()}: your alert triggered`,
    html,
    tags: [{ name: 'type', value: 'price_alert' }],
  });
}

// ─── Security Alert ───────────────────────────────────────────────────────────

export async function sendSecurityAlert(params: {
  to: string;
  walletAddress: string;
  alertType: 'suspicious_tx' | 'approval_risk' | 'new_activity' | 'whale_movement';
  description: string;
  txHash?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}): Promise<EmailResult> {
  const severityColor: Record<string, string> = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  };

  const color = severityColor[params.severity];
  const short = `${params.walletAddress.slice(0, 6)}...${params.walletAddress.slice(-4)}`;
  const typeLabel = esc(params.alertType.replace(/_/g, ' '));

  const body = `
    ${glassCard(`
      <div style="font-size:10px;letter-spacing:.08em;color:#8a93a8;text-transform:uppercase;margin-bottom:6px;">Wallet</div>
      <code style="color:#ffffff;font-size:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(short)}</code>
    `)}
    <div style="background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);border-left:3px solid ${color};border-radius:12px;padding:14px 16px;margin-bottom:18px;">
      <div style="font-size:11px;letter-spacing:.06em;color:${color};font-weight:700;text-transform:uppercase;margin-bottom:6px;">${esc(params.severity)} severity · ${typeLabel}</div>
      <div style="margin:0;color:#dfe4ee;font-size:14px;line-height:1.55;">${esc(params.description)}</div>
    </div>
    ${params.txHash ? glassCard(`
      <div style="font-size:10px;letter-spacing:.08em;color:#8a93a8;text-transform:uppercase;margin-bottom:6px;">Transaction</div>
      <code style="color:#4d94ff;font-size:12px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(params.txHash.slice(0, 20))}…</code>
    `) : ''}
    ${emailButton(`${APP_BASE_URL}/dashboard/settings`, 'Manage notifications')}
    <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#7c869c;">Naka Labs Wallet Intelligence.</p>`;
  const html = brandedEmailWrapper('Security alert', `${params.severity.charAt(0).toUpperCase() + params.severity.slice(1)} severity · ${short}`, body);

  return sendBroadcast({
    to: params.to,
    subject: `🛡️ [${params.severity.toUpperCase()}] Security alert for ${short}`,
    html,
    tags: [{ name: 'type', value: 'security_alert' }, { name: 'severity', value: params.severity }],
  });
}

// ─── Whale Alert ──────────────────────────────────────────────────────────────

/**
 * Adaptive USD formatter for whale emails. Renders $K/$M/$B by magnitude
 * (a real $50K move is "$50K", not the misleading "$0.05M" the old fixed
 * /1e6 format produced) and returns null for a non-finite/non-positive
 * amount so callers never email a fabricated "$NaNM"/"$0.00M" headline.
 */
function fmtWhaleUsd(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export async function sendWhaleAlert(params: {
  to: string;
  symbol: string;
  amountUsd: number;
  direction: 'buy' | 'sell' | 'transfer';
  fromEntity?: string;
  toEntity?: string;
  txHash?: string;
  // Rich enrichment (all optional — the email degrades gracefully without them).
  whaleName?: string;
  whaleShort?: string;            // short 0x… form shown small under the name
  avatarUrl?: string;             // absolute avatar URL; defaults to the Naka logo
  whaleAddress?: string;
  chain?: string;
  whaleScore?: number | null;     // 0-100 Naka whale score
  archetype?: string | null;      // e.g. "Active Trader", "Smart Money", "Distributor"
  entityType?: string | null;     // trader / fund / exchange ...
  aiTake?: string | null;         // a grounded one-liner built from real data
  activeDays7d?: number | null;
  viewUrl?: string;               // absolute link to the whale profile
}): Promise<EmailResult> {
  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz').replace(/\/$/, '');
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const isBuy = params.direction === 'buy';
  const isSell = params.direction === 'sell';
  const verb = isBuy ? 'bought' : isSell ? 'sold' : 'moved';
  const directionLabel = isBuy ? '🐋 Whale Buy' : isSell ? '🔴 Whale Sell' : '🔀 Whale Transfer';
  // Accents used sparingly against the near-black glass: emerald for buys, red
  // for sells, brand blue for transfers. High contrast on a #0b0f1c surface.
  const accent = isBuy ? '#10B981' : isSell ? '#ef4444' : '#0066FF';
  const accentSoft = isBuy ? 'rgba(16,185,129,0.14)' : isSell ? 'rgba(239,68,68,0.14)' : 'rgba(0,102,255,0.16)';
  const accentBorder = isBuy ? 'rgba(16,185,129,0.35)' : isSell ? 'rgba(239,68,68,0.35)' : 'rgba(0,102,255,0.4)';

  const amountLabel = fmtWhaleUsd(params.amountUsd);
  const rawWhaleName = params.whaleName || (params.whaleAddress
    ? `${params.whaleAddress.slice(0, 6)}…${params.whaleAddress.slice(-4)}`
    : 'A tracked whale');
  const whaleName = escapeHtml(rawWhaleName);
  const shortAddr = params.whaleShort
    ? escapeHtml(params.whaleShort)
    : params.whaleAddress
      ? `${params.whaleAddress.slice(0, 6)}…${params.whaleAddress.slice(-4)}`
      : '';
  const avatar = params.avatarUrl || `${APP_URL}/logo.png`;
  const chainLabel = params.chain ? params.chain.charAt(0).toUpperCase() + params.chain.slice(1) : '';
  const score = typeof params.whaleScore === 'number' ? params.whaleScore : null;
  const scoreColor = score == null ? '#94a3b8' : score >= 90 ? '#10B981' : score >= 75 ? '#0066FF' : '#94a3b8';
  const rawSymbolTag = params.symbol ? `$${params.symbol.replace(/^\$/, '')}` : 'tokens';
  const symbolTag = escapeHtml(rawSymbolTag);
  const view = params.viewUrl || (params.whaleAddress
    ? `${APP_URL}/dashboard/whale-tracker/${params.whaleAddress}${params.chain ? `?chain=${params.chain}` : ''}`
    : `${APP_URL}/dashboard/whale-tracker`);
  // Secondary meta line under the name — only real, present fields.
  const metaLine = [
    params.entityType ? params.entityType.charAt(0).toUpperCase() + params.entityType.slice(1) : '',
    params.archetype || '',
  ].filter(Boolean).map(escapeHtml).join('  ·  ');

  // Stat chips — only render the ones we actually have (no fabricated fillers,
  // no placeholder dashes). Rendered as fixed-width cells on the dark glass.
  const chip = (label: string, value: string, color: string) =>
    `<td width="33%" style="padding:0 4px"><div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:11px 12px"><div style="font-size:10px;letter-spacing:.08em;color:#8a93a8;text-transform:uppercase">${label}</div><div style="font-size:14px;font-weight:700;color:${color};margin-top:3px">${value}</div></div></td>`;
  const chips: string[] = [];
  if (chainLabel) chips.push(chip('Chain', chainLabel, '#f8fafc'));
  chips.push(chip('Action', params.direction.charAt(0).toUpperCase() + params.direction.slice(1), accent));
  if (typeof params.activeDays7d === 'number' && params.activeDays7d > 0) chips.push(chip('Active', `${params.activeDays7d}/7d`, '#f8fafc'));

  const html = `
  <div style="background:#05070f;padding:28px 12px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:linear-gradient(160deg,#0d1120,#070a12);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.55)">
      <!-- Header badge -->
      <tr><td style="padding:24px 26px 0">
        <span style="display:inline-block;background:${accentSoft};border:1px solid ${accentBorder};color:${accent};font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;border-radius:999px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${directionLabel}</span>
      </td></tr>
      <!-- Whale identity: avatar + name + short address, optional score -->
      <tr><td style="padding:18px 26px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td width="52" style="vertical-align:middle;padding-right:14px">
            <img src="${avatar}" width="48" height="48" alt="" style="width:48px;height:48px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:#0b0f1c;display:block" />
          </td>
          <td style="vertical-align:middle">
            <div style="font-size:20px;font-weight:800;color:#ffffff;line-height:1.2">${whaleName}</div>
            ${shortAddr ? `<div style="font-size:12px;color:#7c869c;margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${shortAddr}${metaLine ? `<span style="color:#5b647a"> · ${metaLine}</span>` : ''}</div>` : (metaLine ? `<div style="font-size:12px;color:#8a93a8;margin-top:3px">${metaLine}</div>` : '')}
          </td>
          ${score != null ? `<td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:10px">
            <div style="display:inline-block;background:rgba(255,255,255,0.04);border:1px solid ${scoreColor}66;border-radius:14px;padding:8px 14px;text-align:center">
              <div style="font-size:9px;letter-spacing:.08em;color:#8a93a8;text-transform:uppercase">Naka score</div>
              <div style="font-size:24px;font-weight:800;color:${scoreColor};line-height:1.1">${score}</div>
            </div>
          </td>` : ''}
        </tr></table>
      </td></tr>
      <!-- The move -->
      <tr><td style="padding:22px 26px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <div style="font-size:13px;color:#8a93a8">${whaleName} ${verb}</div>
        <div style="font-size:40px;font-weight:800;color:#ffffff;line-height:1.05;margin-top:4px;letter-spacing:-0.5px">${amountLabel || symbolTag}</div>
        <div style="font-size:15px;color:${accent};font-weight:700;margin-top:4px">${symbolTag}${chainLabel ? `<span style="color:#8a93a8;font-weight:600"> on ${chainLabel}</span>` : ''}</div>
      </td></tr>
      <!-- Naka AI take -->
      ${params.aiTake ? `<tr><td style="padding:20px 26px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <div style="background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);border-left:3px solid ${accent};border-radius:12px;padding:14px 16px">
          <div style="font-size:11px;letter-spacing:.08em;color:${accent};text-transform:uppercase;font-weight:700;margin-bottom:6px">⚡ Naka AI take</div>
          <div style="font-size:14px;color:#e8ecf5;line-height:1.55">${escapeHtml(params.aiTake)}</div>
        </div>
      </td></tr>` : ''}
      <!-- Stat chips -->
      <tr><td style="padding:20px 22px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>${chips.join('')}</tr></table>
      </td></tr>
      <!-- CTA -->
      <tr><td style="padding:24px 26px 26px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <a href="${view}" style="display:block;text-align:center;background:linear-gradient(135deg,#0066FF,#0047C2);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px;border-radius:12px;letter-spacing:0.2px">View this whale on Naka Labs</a>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:16px 26px;border-top:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.25);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <div style="font-size:12px;color:#7c869c">Naka Labs Whale Alerts  ·  <a href="${APP_URL}/dashboard/settings" style="color:#0066FF;text-decoration:none">Manage alerts</a></div>
      </td></tr>
    </table>
    </td></tr></table>
  </div>`;

  return sendBroadcast({
    to: params.to,
    subject: `${directionLabel}: ${rawWhaleName} ${verb} ${amountLabel || rawSymbolTag}`,
    html,
    tags: [{ name: 'type', value: 'whale_alert' }],
  });
}

// ─── Sniper Notification ─────────────────────────────────────────────────────

export async function sendSniperNotification(params: {
  to: string;
  symbol: string;
  action: 'executed' | 'failed' | 'cancelled';
  amountUsd: number;
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  txHash?: string;
  chain: 'solana' | 'ethereum' | 'base';
}): Promise<EmailResult> {
  const { symbol, action, amountUsd, entryPrice, targetPrice, stopLoss, txHash, chain } = params;
  const sym = esc(symbol);
  const statusColor = action === 'executed' ? '#10B981' : action === 'failed' ? '#ef4444' : '#F59E0B';
  const statusLabel = action === 'executed' ? 'Order executed' : action === 'failed' ? 'Order failed' : 'Order cancelled';
  const chainLabel = chain.charAt(0).toUpperCase() + chain.slice(1);

  const rows = [
    statRow('Amount', `$${amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
    statRow('Entry price', `$${entryPrice.toLocaleString()}`, '#ffffff', !targetPrice && !stopLoss),
    targetPrice ? statRow('Target price', `$${targetPrice.toLocaleString()}`, '#10B981', !stopLoss) : '',
    stopLoss ? statRow('Stop loss', `$${stopLoss.toLocaleString()}`, '#ef4444', true) : '',
  ].join('');

  const body = `
    <div style="border-left:3px solid ${statusColor};padding-left:14px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${statusColor};">${statusLabel}</div>
      <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:4px;">${sym}</div>
      <div style="font-size:13px;color:#8a93a8;margin-top:2px;">${chainLabel} network</div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:6px 18px;margin-bottom:18px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
    </div>
    ${txHash ? glassCard(`
      <div style="font-size:10px;letter-spacing:.08em;color:#8a93a8;text-transform:uppercase;margin-bottom:6px;">Transaction hash</div>
      <code style="color:#4d94ff;font-size:12px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(txHash)}</code>
    `) : ''}
    ${emailButton(`${APP_BASE_URL}/dashboard`, 'View dashboard')}
    <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#7c869c;">Naka Labs Sniper Engine.</p>`;
  const html = brandedEmailWrapper(statusLabel, `${sym} · ${chainLabel}`, body);

  return sendBroadcast({
    to: params.to,
    subject: `Sniper ${statusLabel}: ${symbol} on ${chainLabel}`,
    html,
    tags: [{ name: 'type', value: 'sniper_notification' }, { name: 'action', value: action }],
  });
}

// ─── Research Notification ────────────────────────────────────────────────────

export async function sendResearchNotification(params: {
  to: string;
  authorName: string;
  title: string;
  summary: string;
  category: string;
  slug: string;
  publishedAt?: string;
}): Promise<EmailResult> {
  const { authorName, title, summary, category, slug, publishedAt } = params;
  const dateLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const body = `
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;background:rgba(0,102,255,0.14);border:1px solid rgba(0,102,255,0.35);color:#4d94ff;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;border-radius:999px;">${esc(category)}</span>
      <h2 style="margin:14px 0 0;color:#ffffff;font-size:19px;font-weight:800;line-height:1.4;">${esc(title)}</h2>
      <p style="margin:8px 0 0;color:#8a93a8;font-size:13px;">By ${esc(authorName)} &middot; ${dateLabel}</p>
    </div>
    ${glassCard(`<p style="margin:0;color:#dfe4ee;font-size:14px;line-height:1.7;">${esc(summary)}</p>`)}
    ${emailButton(`${APP_BASE_URL}/research/${encodeURIComponent(slug)}`, 'Read full research')}
    <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#7c869c;text-align:center;">Naka Labs Research.</p>`;
  const html = brandedEmailWrapper('New research', `${esc(category)} &middot; ${dateLabel}`, body);

  return sendBroadcast({
    to: params.to,
    subject: `New Research: ${title}`,
    html,
    tags: [{ name: 'type', value: 'research_notification' }, { name: 'category', value: category }],
  });
}

// ─── Batch Send ───────────────────────────────────────────────────────────────

/**
 * Send to a list of recipients in batches.
 * Resend batch API handles up to 100 per call.
 */
export async function sendBatch(emails: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}[]): Promise<{ sent: number; failed: number }> {
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const BATCH_SIZE = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE).map(e => ({
      from: `${FROM_NAME} <${FROM}>`,
      to: [e.to],
      subject: e.subject,
      html: e.html,
      text: e.text,
    }));

    try {
      const { data, error } = await getResend().batch.send(batch);
      if (error) {
        failed += batch.length;
      } else {
        sent += (data?.data?.length ?? batch.length);
      }
    } catch {
      failed += batch.length;
    }
  }

  return { sent, failed };
}
