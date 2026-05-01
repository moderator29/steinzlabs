import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { matchSniperEvent } from '@/lib/sniper/matcher';
import type { SniperChain } from '@/lib/sniper/chains';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Unified sniper-detect webhook. Accepts events from Alchemy AddressActivity
// webhooks or Helius enhanced webhooks, normalises them into a single
// `sniper_detected_tokens` row, and runs the safety gate (GoPlus + liquidity
// + tax checks) asynchronously.
//
// Provider is selected via the `provider=alchemy` | `provider=helius` query
// param so one endpoint can serve both. Signature verification:
//   - Alchemy: HMAC-SHA256 of raw body with ALCHEMY_WEBHOOK_SIGNING_KEY
//   - Helius:  authorization header equality with HELIUS_WEBHOOK_SECRET

interface NormalisedEvent {
  provider: 'alchemy' | 'helius';
  chain: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  fromAddress: string | null;
  amountUsd: number | null;
  txHash: string | null;
  observedAt: string;
  raw: unknown;
}

function verifyAlchemy(raw: string, signature: string | null): boolean {
  if (!signature) return false;
  // Multi-key support: ALCHEMY_WEBHOOK_SIGNING_KEYS holds a comma-separated
  // list of signing keys (one per chain). Legacy ALCHEMY_WEBHOOK_SIGNING_KEY
  // remains honored for back-compat. Any matching key passes.
  const keys = [
    ...(process.env.ALCHEMY_WEBHOOK_SIGNING_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean),
    process.env.ALCHEMY_WEBHOOK_SIGNING_KEY ?? '',
  ].filter(Boolean);
  for (const key of keys) {
    const computed = crypto.createHmac('sha256', key).update(raw).digest('hex');
    try {
      if (
        computed.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
      ) {
        return true;
      }
    } catch {
      // Length mismatch on timingSafeEqual — fall through to next key.
    }
  }
  return false;
}

function verifyHelius(authHeader: string | null): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret || !authHeader) return false;
  return authHeader === secret;
}

function normaliseAlchemy(body: unknown): NormalisedEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const ev = b.event as Record<string, unknown> | undefined;
  if (!ev || typeof ev !== 'object') return null;
  const activity = Array.isArray(ev.activity) ? ev.activity[0] : null;
  if (!activity) return null;
  const a = activity as Record<string, unknown>;
  return {
    provider: 'alchemy',
    chain: typeof ev.network === 'string' ? String(ev.network).toLowerCase() : 'ethereum',
    tokenAddress: typeof a.rawContract === 'object' && a.rawContract && 'address' in (a.rawContract as object)
      ? String((a.rawContract as { address: string }).address).toLowerCase()
      : null,
    tokenSymbol: typeof a.asset === 'string' ? a.asset : null,
    fromAddress: typeof a.fromAddress === 'string' ? a.fromAddress : null,
    amountUsd: typeof a.value === 'number' ? a.value : null,
    txHash: typeof a.hash === 'string' ? a.hash : null,
    observedAt: new Date().toISOString(),
    raw: body,
  };
}

function normaliseHelius(body: unknown): NormalisedEvent | null {
  if (!Array.isArray(body) || !body.length) return null;
  const evt = body[0] as Record<string, unknown>;
  const tokenTransfers = Array.isArray(evt.tokenTransfers) ? evt.tokenTransfers : [];
  const first = tokenTransfers[0] as Record<string, unknown> | undefined;
  return {
    provider: 'helius',
    chain: 'solana',
    tokenAddress: first?.mint ? String(first.mint) : null,
    tokenSymbol: null,
    fromAddress: first?.fromUserAccount ? String(first.fromUserAccount) : null,
    amountUsd: null,
    txHash: typeof evt.signature === 'string' ? evt.signature : null,
    observedAt: new Date().toISOString(),
    raw: body,
  };
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');
  const rawBody = await req.text();

  let event: NormalisedEvent | null = null;
  if (provider === 'alchemy') {
    if (!verifyAlchemy(rawBody, req.headers.get('x-alchemy-signature'))) {
      return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
    }
    try { event = normaliseAlchemy(JSON.parse(rawBody)); } catch { /* ignore */ }
  } else if (provider === 'helius') {
    if (!verifyHelius(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
    }
    try { event = normaliseHelius(JSON.parse(rawBody)); } catch { /* ignore */ }
  } else {
    return NextResponse.json({ error: 'Missing provider' }, { status: 400 });
  }

  if (!event || !event.tokenAddress) {
    return NextResponse.json({ ok: true, skipped: 'no token' });
  }

  try {
    const admin = getSupabaseAdmin();
    await admin.from('sniper_detected_tokens').insert({
      provider: event.provider,
      chain: event.chain,
      token_address: event.tokenAddress,
      token_symbol: event.tokenSymbol,
      from_address: event.fromAddress,
      amount_usd: event.amountUsd,
      tx_hash: event.txHash,
      observed_at: event.observedAt,
      raw: event.raw,
    });
  } catch (err) {
    console.error('[webhooks/sniper-detect] insert failed:', err);
  }

  // Phase 4: low-latency matcher. Awaited so the webhook only ACKs once
  // sniper_match_events rows are written; Alchemy/Helius retry on 5xx so we
  // want the row in place before responding 200.
  //
  // Most events have a fromAddress regardless of whether they represent a
  // new-pair detection or a tracked whale's trade, so we cannot infer the
  // trigger type from that field alone. Instead we run the matcher under
  // BOTH trigger types — the matcher's own trigger_type filter on
  // sniper_criteria + per-criteria whale-address check ensure a single event
  // only fires the right rules. Dedup keyed on (criteria_id, token) prevents
  // double-insertion if a criteria somehow matched both passes.
  const chain = event.chain as SniperChain;
  const [whaleOutcome, newTokenOutcome] = await Promise.all([
    matchSniperEvent({
      chain,
      trigger: 'whale_buy',
      tokenAddress: event.tokenAddress,
      tokenSymbol: event.tokenSymbol,
      txHash: event.txHash,
      whaleAddress: event.fromAddress,
      whaleValueUsd: event.amountUsd,
    }),
    matchSniperEvent({
      chain,
      trigger: 'new_token_launch',
      tokenAddress: event.tokenAddress,
      tokenSymbol: event.tokenSymbol,
      txHash: event.txHash,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    matcher: {
      whale: whaleOutcome,
      newToken: newTokenOutcome,
    },
  });
}
