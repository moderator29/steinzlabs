import 'server-only';
import { Resend } from 'resend';

/**
 * Resend Email Delivery Service
 * Handles: broadcast emails, price alerts, security alerts, notifications.
 * FROM address: alerts@steinzlabs.com (or configured via RESEND_FROM_EMAIL)
 */

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'alerts@steinzlabs.com';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Steinz Labs';

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
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
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
        You're receiving this because you set a price alert on Steinz Labs.
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
        Steinz Labs Wallet Intelligence — <a href="#" style="color:#a855f7">Manage notifications</a>
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

export async function sendWhaleAlert(params: {
  to: string;
  symbol: string;
  amountUsd: number;
  direction: 'buy' | 'sell' | 'transfer';
  fromEntity?: string;
  toEntity?: string;
  txHash?: string;
}): Promise<EmailResult> {
  const directionLabel = params.direction === 'buy' ? '🐋 Whale Buy' :
    params.direction === 'sell' ? '🔴 Whale Sell' : '🔀 Whale Transfer';
  const directionColor = params.direction === 'buy' ? '#22c55e' :
    params.direction === 'sell' ? '#ef4444' : '#a855f7';

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:12px">
      <h2 style="color:${directionColor};margin:0 0 16px">${directionLabel}</h2>
      <p style="font-size:32px;font-weight:700;color:#f1f5f9;margin:0 0 4px">
        $${(params.amountUsd / 1_000_000).toFixed(2)}M
      </p>
      <p style="color:#94a3b8;margin:0 0 16px">${params.symbol}</p>
      ${params.fromEntity || params.toEntity ? `
        <div style="background:#1e293b;border-radius:8px;padding:12px;font-size:13px;margin-bottom:16px">
          ${params.fromEntity ? `<p style="margin:0;color:#64748b">From: <span style="color:#f1f5f9">${params.fromEntity}</span></p>` : ''}
          ${params.toEntity ? `<p style="margin:0;color:#64748b">To: <span style="color:#f1f5f9">${params.toEntity}</span></p>` : ''}
        </div>
      ` : ''}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
      <p style="font-size:12px;color:#475569">
        Steinz Labs Whale Alerts — <a href="#" style="color:#a855f7">Manage alerts</a>
      </p>
    </div>
  `;

  return sendBroadcast({
    to: params.to,
    subject: `${directionLabel}: $${(params.amountUsd / 1_000_000).toFixed(1)}M ${params.symbol}`,
    html,
    tags: [{ name: 'type', value: 'whale_alert' }],
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
      const { data, error } = await resend.batch.send(batch);
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
