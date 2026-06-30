import 'server-only';
import { Resend } from 'resend';

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
  const arrow = direction === 'above' ? '▲' : '▼';
  const color = direction === 'above' ? '#22c55e' : '#ef4444';
  const changePart = changePercent !== undefined
    ? `<p style="color:${color};font-size:14px;margin:4px 0">${arrow} ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% in 24h</p>`
    : '';

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:12px">
      <h2 style="color:#a855f7;margin:0 0 16px">⚡ Price Alert: ${symbol}</h2>
      <p style="font-size:16px;color:#94a3b8;margin:0 0 8px">
        ${symbol} has moved ${direction} your target of <strong style="color:#f1f5f9">$${targetPrice.toLocaleString()}</strong>
      </p>
      <p style="font-size:28px;font-weight:700;color:${color};margin:16px 0">
        $${currentPrice.toLocaleString()}
      </p>
      ${changePart}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
      <p style="font-size:12px;color:#475569">
        You're receiving this because you set a price alert on Naka Labs.
        <a href="#" style="color:#a855f7">Manage alerts</a>
      </p>
    </div>
  `;

  return sendBroadcast({
    to: params.to,
    subject: `${arrow} ${symbol} hit $${currentPrice.toLocaleString()} — your alert triggered`,
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

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="font-size:24px">🛡️</span>
        <h2 style="color:#a855f7;margin:0">Security Alert</h2>
      </div>
      <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:16px">
        <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase">Wallet</p>
        <code style="color:#f1f5f9;font-size:13px">${short}</code>
      </div>
      <div style="border-left:3px solid ${color};padding-left:16px;margin-bottom:16px">
        <p style="margin:0 0 4px;color:${color};font-size:12px;font-weight:600;text-transform:uppercase">
          ${params.severity} severity — ${params.alertType.replace(/_/g, ' ')}
        </p>
        <p style="margin:0;color:#cbd5e1">${params.description}</p>
      </div>
      ${params.txHash ? `
        <p style="font-size:13px;color:#64748b">
          TX: <code style="color:#a855f7">${params.txHash.slice(0, 20)}...</code>
        </p>
      ` : ''}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
      <p style="font-size:12px;color:#475569">
        Naka Labs Wallet Intelligence — <a href="#" style="color:#a855f7">Manage notifications</a>
      </p>
    </div>
  `;

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
  whaleAddress?: string;
  chain?: string;
  whaleScore?: number | null;     // 0-100 Naka whale score
  archetype?: string | null;      // e.g. "Active Trader", "Smart Money", "Distributor"
  entityType?: string | null;     // trader / fund / exchange ...
  aiTake?: string | null;         // a grounded one-liner built from real data
  activeDays7d?: number | null;
  viewUrl?: string;               // absolute link to the whale profile
}): Promise<EmailResult> {
  const isBuy = params.direction === 'buy';
  const isSell = params.direction === 'sell';
  const verb = isBuy ? 'bought' : isSell ? 'sold' : 'moved';
  const directionLabel = isBuy ? '🐋 Whale Buy' : isSell ? '🔴 Whale Sell' : '🔀 Whale Transfer';
  const accent = isBuy ? '#22c55e' : isSell ? '#ef4444' : '#8B7CFF';
  const grad = isBuy
    ? 'linear-gradient(135deg,#0a2a1a,#05131f)'
    : isSell ? 'linear-gradient(135deg,#2a0a12,#05131f)' : 'linear-gradient(135deg,#161033,#05131f)';

  const amountLabel = fmtWhaleUsd(params.amountUsd);
  const whaleName = params.whaleName || (params.whaleAddress
    ? `${params.whaleAddress.slice(0, 6)}…${params.whaleAddress.slice(-4)}`
    : 'A tracked whale');
  const chainLabel = params.chain ? params.chain.charAt(0).toUpperCase() + params.chain.slice(1) : '';
  const score = typeof params.whaleScore === 'number' ? params.whaleScore : null;
  const scoreColor = score == null ? '#64748b' : score >= 90 ? '#34d399' : score >= 75 ? '#8B7CFF' : '#94a3b8';
  const symbolTag = params.symbol ? `$${params.symbol.replace(/^\$/, '')}` : 'tokens';
  const view = params.viewUrl || (params.whaleAddress
    ? `https://nakalabs.xyz/dashboard/whale-tracker/${params.whaleAddress}${params.chain ? `?chain=${params.chain}` : ''}`
    : 'https://nakalabs.xyz/dashboard/whale-tracker');

  // Stat chips — only render the ones we actually have (no fabricated fillers,
  // no placeholder dashes).
  const chips: string[] = [];
  if (chainLabel) chips.push(`<td style="padding:0 6px 0 0"><div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px"><div style="font-size:10px;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Chain</div><div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:2px">${chainLabel}</div></div></td>`);
  chips.push(`<td style="padding:0 6px"><div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px"><div style="font-size:10px;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Action</div><div style="font-size:14px;font-weight:700;color:${accent};margin-top:2px;text-transform:capitalize">${params.direction}</div></div></td>`);
  if (typeof params.activeDays7d === 'number' && params.activeDays7d > 0) chips.push(`<td style="padding:0 0 0 6px"><div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px"><div style="font-size:10px;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Active</div><div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:2px">${params.activeDays7d}/7d</div></div></td>`);

  const html = `
  <div style="background:#03050e;padding:24px 12px">
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;background:${grad};border:1px solid rgba(139,124,255,0.18);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <!-- Header -->
      <div style="padding:22px 24px 0">
        <div style="display:inline-block;background:rgba(139,124,255,0.14);border:1px solid rgba(139,124,255,0.3);color:#cfc7ff;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:5px 11px;border-radius:999px">${directionLabel}</div>
      </div>
      <!-- Whale identity -->
      <div style="padding:16px 24px 0">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle">
            <div style="font-size:20px;font-weight:800;color:#ffffff;line-height:1.2">${whaleName}</div>
            <div style="font-size:12px;color:#8a93a8;margin-top:4px">${[chainLabel, params.entityType ? params.entityType.charAt(0).toUpperCase() + params.entityType.slice(1) : '', params.archetype || ''].filter(Boolean).join('  ·  ')}</div>
          </td>
          ${score != null ? `<td style="vertical-align:middle;text-align:right;white-space:nowrap">
            <div style="display:inline-block;background:rgba(255,255,255,0.04);border:1px solid ${scoreColor}55;border-radius:14px;padding:8px 14px;text-align:center">
              <div style="font-size:10px;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Whale score</div>
              <div style="font-size:26px;font-weight:800;color:${scoreColor};line-height:1">${score}</div>
            </div>
          </td>` : ''}
        </tr></table>
      </div>
      <!-- The move -->
      <div style="padding:20px 24px 0">
        <div style="font-size:13px;color:#8a93a8">${whaleName} ${verb}</div>
        <div style="font-size:38px;font-weight:800;color:#ffffff;line-height:1.1;margin-top:2px">${amountLabel || symbolTag}</div>
        <div style="font-size:15px;color:${accent};font-weight:700;margin-top:2px">${symbolTag}${chainLabel ? ` on ${chainLabel}` : ''}</div>
      </div>
      <!-- AI take -->
      ${params.aiTake ? `<div style="margin:18px 24px 0;background:rgba(139,124,255,0.08);border:1px solid rgba(139,124,255,0.22);border-radius:14px;padding:14px 16px">
        <div style="font-size:11px;letter-spacing:.08em;color:#8B7CFF;text-transform:uppercase;font-weight:700;margin-bottom:5px">⚡ Naka AI take</div>
        <div style="font-size:14px;color:#dfe3ee;line-height:1.5">${params.aiTake}</div>
      </div>` : ''}
      <!-- Stat chips -->
      <div style="padding:18px 24px 0"><table width="100%" cellpadding="0" cellspacing="0"><tr>${chips.join('')}</tr></table></div>
      <!-- CTA -->
      <div style="padding:22px 24px 24px">
        <a href="${view}" style="display:block;text-align:center;background:linear-gradient(135deg,#0066FF,#8B7CFF);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px;border-radius:12px">View this whale on Naka Labs</a>
      </div>
      <!-- Footer -->
      <div style="padding:16px 24px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2)">
        <div style="font-size:12px;color:#5b647a">Naka Labs Whale Alerts  ·  <a href="https://nakalabs.xyz/dashboard/settings" style="color:#8B7CFF;text-decoration:none">Manage alerts</a></div>
      </div>
    </div>
  </div>`;

  return sendBroadcast({
    to: params.to,
    subject: `${directionLabel}: ${whaleName} ${verb} ${amountLabel || symbolTag}`,
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
  const statusColor = action === 'executed' ? '#22c55e' : action === 'failed' ? '#ef4444' : '#f59e0b';
  const statusLabel = action === 'executed' ? 'Order Executed' : action === 'failed' ? 'Order Failed' : 'Order Cancelled';
  const chainLabel = chain.charAt(0).toUpperCase() + chain.slice(1);

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:12px">
      <div style="border-left:4px solid ${statusColor};padding-left:16px;margin-bottom:20px">
        <p style="margin:0 0 4px;color:${statusColor};font-size:12px;font-weight:700;text-transform:uppercase">${statusLabel}</p>
        <h2 style="margin:0;color:#f1f5f9;font-size:24px">${symbol}</h2>
        <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">${chainLabel} Network</p>
      </div>
      <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#64748b;font-size:13px">Amount</span>
          <span style="color:#f1f5f9;font-size:13px;font-weight:600">$${amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#64748b;font-size:13px">Entry Price</span>
          <span style="color:#f1f5f9;font-size:13px;font-weight:600">$${entryPrice.toLocaleString()}</span>
        </div>
        ${targetPrice ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#64748b;font-size:13px">Target Price</span>
          <span style="color:#22c55e;font-size:13px;font-weight:600">$${targetPrice.toLocaleString()}</span>
        </div>` : ''}
        ${stopLoss ? `
        <div style="display:flex;justify-content:space-between">
          <span style="color:#64748b;font-size:13px">Stop Loss</span>
          <span style="color:#ef4444;font-size:13px;font-weight:600">$${stopLoss.toLocaleString()}</span>
        </div>` : ''}
      </div>
      ${txHash ? `
      <div style="background:#0a0e1a;border:1px solid #1e293b;border-radius:8px;padding:12px;margin-bottom:16px">
        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase">Transaction Hash</p>
        <code style="color:#a855f7;font-size:12px;word-break:break-all">${txHash}</code>
      </div>` : ''}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
      <p style="font-size:12px;color:#475569">
        Naka Labs Sniper Engine — <a href="#" style="color:#a855f7">View Dashboard</a>
      </p>
    </div>
  `;

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
  const categoryColor = '#0066FF';
  const dateLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <p style="margin:0 0 4px;color:${categoryColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${category}</p>
        <h2 style="margin:0;color:#f1f5f9;font-size:20px;line-height:1.4">${title}</h2>
        <p style="margin:8px 0 0;color:#64748b;font-size:13px">By ${authorName} · ${dateLabel}</p>
      </div>
      <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7">${summary}</p>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz'}/research/${slug}"
           style="display:inline-block;background:${categoryColor};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
          Read Full Research
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
      <p style="font-size:12px;color:#475569;text-align:center">
        Naka Labs Research — <a href="#" style="color:#a855f7">Manage notifications</a>
      </p>
    </div>
  `;

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
