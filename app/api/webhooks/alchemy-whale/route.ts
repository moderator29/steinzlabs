/**
 * §2.3: Alchemy Address-Activity webhook → whale_activity insert.
 *
 * Receives the standard Alchemy ADDRESS_ACTIVITY webhook payload
 * (https://www.alchemy.com/docs/reference/notify-api#address-activity),
 * matches each transfer's fromAddress / toAddress against our `whales`
 * table, and inserts a row per match into `whale_activity` so the Live
 * Feed shows real movement as it happens.
 *
 * Register the webhook once per network via Alchemy dashboard OR via:
 *   POST https://dashboard.alchemy.com/api/create-webhook
 *   body: { network, webhook_type: "ADDRESS_ACTIVITY",
 *           webhook_url: "https://nakalabs.xyz/api/webhooks/alchemy-whale",
 *           addresses: [<every active EVM whale in our DB>] }
 *
 * Signature verification: Alchemy signs the raw body with X-Alchemy-Signature
 * (HMAC-SHA256 of the body using the signing key from dashboard). We reject
 * anything that doesn't match.
 *
 * On a successful insert, existing SSE consumers at
 * /api/whale-activity/stream pick up the row and push to connected clients.
 */
import 'server-only';
import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { matchCopyEvent } from '@/lib/copy/matcher';
import { mapWithConcurrency } from '@/lib/utils/concurrency';
import { checkWebhookRateLimit, getWebhookClientIp } from '@/lib/security/webhookRateLimit';

// Per-webhook matcher fan-out concurrency. One slow GoPlus / aggregator
// quote inside matchCopyEvent must not stall siblings; 8 keeps the GoPlus
// + aggregator rate-limits comfortable while saturating typical 10-30-row
// Alchemy batches in a single wave.
const MATCHER_CONCURRENCY = 8;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AlchemyActivityEvent {
  fromAddress?: string;
  toAddress?: string;
  blockNum?: string;
  hash?: string;
  value?: number | string;
  asset?: string;
  category?: string;
  rawContract?: { address?: string; decimals?: number };
}

interface AlchemyWebhookBody {
  webhookId?: string;
  id?: string;
  createdAt?: string;
  type?: string;
  event?: {
    network?: string;
    activity?: AlchemyActivityEvent[];
  };
}

// Alchemy network → our chain column mapping
const NETWORK_TO_CHAIN: Record<string, string> = {
  ETH_MAINNET: 'ethereum',
  MATIC_MAINNET: 'polygon',
  BASE_MAINNET: 'base',
  ARB_MAINNET: 'arbitrum',
  OPT_MAINNET: 'optimism',
  BNB_MAINNET: 'bsc',
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  // Accept multiple signing keys because Alchemy issues one per webhook
  // (and we run one webhook per chain = 5 keys on free plan). Env var is
  // comma-separated:  ALCHEMY_WEBHOOK_SIGNING_KEYS=keyEth,keyBase,keyBnb,...
  // Legacy single-key var ALCHEMY_WEBHOOK_SIGNING_KEY also honored for
  // backwards-compat with the earlier setup.
  const keysRaw = [
    process.env.ALCHEMY_WEBHOOK_SIGNING_KEYS || '',
    process.env.ALCHEMY_WEBHOOK_SIGNING_KEY || '',
  ].join(',');
  const keys = keysRaw.split(',').map((k) => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    // Production MUST have signing keys — fail closed.
    if (process.env.NODE_ENV === 'production') return false;
    // Local dev only: explicit opt-in to bypass.
    return process.env.ALCHEMY_WEBHOOK_DEV_BYPASS === 'true';
  }
  if (!signature) return false;

  for (const key of keys) {
    try {
      const expected = crypto.createHmac('sha256', key).update(rawBody, 'utf8').digest('hex');
      if (expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        return true;
      }
    } catch { /* try next key */ }
  }
  return false;
}

function classifyAction(event: AlchemyActivityEvent, whaleAddress: string): 'buy' | 'sell' | 'transfer_in' | 'transfer_out' {
  const whale = whaleAddress.toLowerCase();
  const from = (event.fromAddress ?? '').toLowerCase();
  const to = (event.toAddress ?? '').toLowerCase();
  if (to === whale) {
    // Receiving tokens — heuristic: ERC20 incoming is a buy; native-ETH
    // incoming is a transfer_in (someone sent ETH, not a swap).
    return event.category === 'erc20' ? 'buy' : 'transfer_in';
  }
  if (from === whale) {
    return event.category === 'erc20' ? 'sell' : 'transfer_out';
  }
  return 'transfer_in';
}

export async function POST(req: NextRequest) {
  // Defense-in-depth: cap webhook throughput per source IP so a stolen
  // signing key can't be used to flood the matcher / Supabase / copy-trade
  // pipeline. 120 calls / 60s per IP — Alchemy's normal cadence is well
  // under this even for high-activity chains.
  const ip = getWebhookClientIp(req.headers);
  const limit = await checkWebhookRateLimit('alchemy-whale', ip, { limit: 120, windowSeconds: 60 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } },
    );
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers.get('x-alchemy-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: AlchemyWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const activity = body.event?.activity ?? [];
  if (activity.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

  const chain = NETWORK_TO_CHAIN[body.event?.network ?? ''] ?? 'ethereum';
  const supabase = getSupabaseAdmin();

  // Collect unique addresses touched by this batch of activity so we can
  // look up which of them are tracked whales in ONE query (instead of
  // N queries for N transfers).
  const addresses = new Set<string>();
  for (const a of activity) {
    if (a.fromAddress) addresses.add(a.fromAddress.toLowerCase());
    if (a.toAddress) addresses.add(a.toAddress.toLowerCase());
  }
  if (addresses.size === 0) return NextResponse.json({ ok: true, inserted: 0 });

  const { data: whales } = await supabase
    .from('whales')
    .select('address, chain, label')
    .eq('is_active', true)
    .in('address', Array.from(addresses));

  if (!whales || whales.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, matched: 0 });
  }

  const whaleSet = new Map<string, { label: string | null; chain: string }>();
  for (const w of whales) {
    whaleSet.set(`${w.chain}:${w.address.toLowerCase()}`, { label: w.label, chain: w.chain });
  }

  // Map each activity event to zero, one, or two whale_activity rows
  // (both from and to could be whales — rare but possible).
  const rows: Array<Record<string, unknown>> = [];
  for (const ev of activity) {
    for (const role of ['from', 'to'] as const) {
      const addr = role === 'from' ? ev.fromAddress : ev.toAddress;
      if (!addr) continue;
      const match = whaleSet.get(`${chain}:${addr.toLowerCase()}`);
      if (!match) continue;

      const valueNum = typeof ev.value === 'string' ? parseFloat(ev.value) : (ev.value ?? 0);
      // Alchemy doesn't include USD — leave value_usd 0; the backfill
      // cron will price it on the next tick via CoinGecko lookup.
      rows.push({
        whale_address: addr,
        chain,
        tx_hash: ev.hash ?? '',
        action: classifyAction(ev, addr),
        token_address: ev.rawContract?.address ?? null,
        token_symbol: ev.asset ?? null,
        amount: valueNum,
        value_usd: 0,
        counterparty: role === 'from' ? ev.toAddress ?? null : ev.fromAddress ?? null,
        counterparty_label: null,
        block_number: ev.blockNum ? parseInt(ev.blockNum, 16) : null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, matched: whales.length });
  }

  const { error } = await supabase.from('whale_activity').insert(rows);
  if (error) {
    console.error('[webhook.alchemy-whale] insert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // §3 Copy-trade matcher fan-out — deferred via next/server `after` so the
  // webhook returns immediately once the durable whale_activity insert lands.
  // The copy-trade-monitor cron (P1-A.3) is the catch-up safety net if the
  // serverless instance dies mid-fan-out, so we don't need to keep Alchemy's
  // delivery open while quotes/security checks run.
  after(async () => {
    const settled = await mapWithConcurrency(rows, MATCHER_CONCURRENCY, async (r) => {
      await matchCopyEvent({
        whale_address: String(r.whale_address ?? ''),
        chain: String(r.chain ?? ''),
        tx_hash: String(r.tx_hash ?? ''),
        action: (r.action === 'buy' || r.action === 'sell' || r.action === 'swap'
          ? r.action
          : 'swap') as 'buy' | 'sell' | 'swap',
        token_address: (r.token_address as string | null) ?? null,
        token_symbol: (r.token_symbol as string | null) ?? null,
        value_usd: (r.value_usd as number | null) ?? null,
        timestamp: String(r.timestamp ?? new Date().toISOString()),
      });
    });
    for (const s of settled) {
      if (s.status === 'rejected') {
        console.error('[webhook.alchemy-whale] copy matcher failed:', s.reason);
      }
    }
  });

  return NextResponse.json({ ok: true, inserted: rows.length, queued: rows.length });
}

/**
 * GET returns a readiness probe + count of whales that would be monitored.
 * Useful when configuring the Alchemy webhook — tells you how many
 * addresses to include in the watched set.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const byChain: Record<string, string[]> = {};
  const { data } = await supabase
    .from('whales')
    .select('address, chain')
    .eq('is_active', true)
    .neq('chain', 'solana');
  for (const w of data ?? []) {
    if (!byChain[w.chain]) byChain[w.chain] = [];
    byChain[w.chain].push(w.address);
  }
  const multiKeys = (process.env.ALCHEMY_WEBHOOK_SIGNING_KEYS || '').split(',').filter(Boolean).length;
  const legacyKey = !!process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  return NextResponse.json({
    ok: true,
    signingKeysConfigured: multiKeys + (legacyKey ? 1 : 0),
    acceptsMultipleKeys: true,
    envVarHint: 'ALCHEMY_WEBHOOK_SIGNING_KEYS=key1,key2,key3,... (comma-separated, any key matches)',
    totalWhales: (data ?? []).length,
    byChain: Object.fromEntries(Object.entries(byChain).map(([c, a]) => [c, a.length])),
  });
}
