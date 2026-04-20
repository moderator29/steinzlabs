/**
 * §2.3 Solana side: Helius webhook → whale_activity insert.
 *
 * Helius "Enhanced Transactions" webhook payload is a JSON array of
 * transactions with `description`, `fee`, `nativeTransfers`,
 * `tokenTransfers`, `accountData`, `events` (swap/nft/etc). We pull the
 * signer + token transfers and insert matching whale_activity rows.
 *
 * https://docs.helius.dev/webhooks/webhook-types-enhanced
 *
 * Auth: Helius lets you configure a custom Authorization header (they
 * send it back on every POST). We read HELIUS_WEBHOOK_SECRET and check
 * against the request's Authorization header. Match or 401.
 *
 * Register via Helius dashboard → Webhooks → New Webhook →
 *   Type: enhancedTransaction
 *   Transaction Types: SWAP, TRANSFER
 *   Webhook URL: https://nakalabs.xyz/api/webhooks/helius-whale
 *   Auth Header: <HELIUS_WEBHOOK_SECRET value>
 *   Account Addresses: paste addresses from GET /api/webhooks/helius-whale
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HeliusTokenTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  fromTokenAccount?: string;
  toTokenAccount?: string;
  tokenAmount?: number;
  mint?: string;
  tokenStandard?: string;
}

interface HeliusNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number; // lamports
}

interface HeliusTx {
  signature?: string;
  timestamp?: number; // seconds
  slot?: number;
  fee?: number;
  feePayer?: string;
  description?: string;
  type?: string; // SWAP, TRANSFER, NFT_SALE, ...
  source?: string; // JUPITER, RAYDIUM, etc.
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
  accountData?: Array<{ account: string; nativeBalanceChange?: number }>;
}

function authOk(req: NextRequest): boolean {
  const expected = process.env.HELIUS_WEBHOOK_SECRET;
  if (!expected) return true; // dev mode
  // Helius sends the configured auth value as the raw Authorization header.
  return req.headers.get('authorization') === expected;
}

function classifyAction(tx: HeliusTx, whaleAddress: string): 'buy' | 'sell' | 'transfer_in' | 'transfer_out' {
  const whale = whaleAddress;
  if (tx.type === 'SWAP') {
    // Find the transfer where the whale RECEIVED tokens — that's the buy side.
    const received = (tx.tokenTransfers ?? []).find((t) => t.toUserAccount === whale);
    if (received) return 'buy';
    const sent = (tx.tokenTransfers ?? []).find((t) => t.fromUserAccount === whale);
    if (sent) return 'sell';
  }
  // Default — look at the direction of the biggest token transfer the whale is part of.
  for (const t of tx.tokenTransfers ?? []) {
    if (t.toUserAccount === whale) return 'transfer_in';
    if (t.fromUserAccount === whale) return 'transfer_out';
  }
  return 'transfer_in';
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let txs: HeliusTx[];
  try {
    const body = await req.json();
    txs = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (txs.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

  const supabase = getSupabaseAdmin();

  // Collect all Solana addresses touched by this batch in one sweep so we
  // can do ONE whales-table lookup instead of one per transfer.
  const addresses = new Set<string>();
  for (const tx of txs) {
    if (tx.feePayer) addresses.add(tx.feePayer);
    for (const t of tx.tokenTransfers ?? []) {
      if (t.fromUserAccount) addresses.add(t.fromUserAccount);
      if (t.toUserAccount) addresses.add(t.toUserAccount);
    }
    for (const t of tx.nativeTransfers ?? []) {
      if (t.fromUserAccount) addresses.add(t.fromUserAccount);
      if (t.toUserAccount) addresses.add(t.toUserAccount);
    }
  }
  if (addresses.size === 0) return NextResponse.json({ ok: true, inserted: 0 });

  const { data: whales } = await supabase
    .from('whales')
    .select('address')
    .eq('is_active', true)
    .eq('chain', 'solana')
    .in('address', Array.from(addresses));

  const whaleSet = new Set((whales ?? []).map((w) => w.address));
  if (whaleSet.size === 0) {
    return NextResponse.json({ ok: true, inserted: 0, matched: 0 });
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const tx of txs) {
    const timestamp = tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : new Date().toISOString();

    // Emit one row per whale-involving token transfer. If the tx has no
    // token transfers (pure SOL move), use the native-transfer side.
    const transfers = (tx.tokenTransfers ?? []).filter((t) => whaleSet.has(t.fromUserAccount ?? '') || whaleSet.has(t.toUserAccount ?? ''));

    if (transfers.length > 0) {
      for (const t of transfers) {
        const whaleAddr = whaleSet.has(t.fromUserAccount ?? '') ? t.fromUserAccount! : t.toUserAccount!;
        rows.push({
          whale_address: whaleAddr,
          chain: 'solana',
          tx_hash: tx.signature ?? '',
          action: classifyAction(tx, whaleAddr),
          token_address: t.mint ?? null,
          token_symbol: null, // Helius doesn't include symbol inline; enrichment cron fills it
          amount: t.tokenAmount ?? 0,
          value_usd: 0, // priced later by Arkham backfill
          counterparty: whaleAddr === t.fromUserAccount ? (t.toUserAccount ?? null) : (t.fromUserAccount ?? null),
          counterparty_label: null,
          block_number: tx.slot ?? null,
          timestamp,
        });
      }
    } else {
      // Pure SOL movement
      for (const t of tx.nativeTransfers ?? []) {
        const whaleAddr = whaleSet.has(t.fromUserAccount ?? '')
          ? t.fromUserAccount
          : whaleSet.has(t.toUserAccount ?? '')
            ? t.toUserAccount
            : null;
        if (!whaleAddr) continue;
        rows.push({
          whale_address: whaleAddr,
          chain: 'solana',
          tx_hash: tx.signature ?? '',
          action: whaleAddr === t.fromUserAccount ? 'transfer_out' : 'transfer_in',
          token_address: 'So11111111111111111111111111111111111111112', // wSOL canonical
          token_symbol: 'SOL',
          amount: (t.amount ?? 0) / 1e9,
          value_usd: 0,
          counterparty: whaleAddr === t.fromUserAccount ? (t.toUserAccount ?? null) : (t.fromUserAccount ?? null),
          counterparty_label: null,
          block_number: tx.slot ?? null,
          timestamp,
        });
      }
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, matched: whaleSet.size });
  }

  const { error } = await supabase.from('whale_activity').insert(rows);
  if (error) {
    console.error('[webhook.helius-whale] insert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('whales')
    .select('address, label')
    .eq('is_active', true)
    .eq('chain', 'solana');

  return NextResponse.json({
    ok: true,
    authHeaderConfigured: !!process.env.HELIUS_WEBHOOK_SECRET,
    totalSolanaWhales: (data ?? []).length,
    addresses: (data ?? []).map((w) => w.address),
    topByLabel: (data ?? []).slice(0, 20),
    setupHint: 'Paste `addresses` into Helius webhook Account Addresses field. Set Auth Header to HELIUS_WEBHOOK_SECRET value in Vercel env.',
  });
}
