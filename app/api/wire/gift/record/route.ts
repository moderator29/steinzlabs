import { NextRequest, NextResponse } from 'next/server';
import { guardRoute } from '@/lib/api/guardRoute';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveReceiveAddress } from '@/lib/wire/resolveReceiveAddress';
import { verifyGiftOnChain, type GiftVerifyOutcome } from '../_verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// Record a Wire gift AFTER the client has broadcast the on-chain transfer.
// This route never moves funds - the transfer already happened peer-to-peer
// from the sender's own wallet. RLS forbids clients from writing wire_gifts
// directly, so we insert with the service-role client here, having verified
// the caller is the sender.

const GIFT_CHAINS = new Set(['ethereum', 'base', 'bsc', 'robinhood', 'solana']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVM_TX_RE = /^0x[0-9a-fA-F]{64}$/;
const SOL_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{43,90}$/;
const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function validTxHash(chain: string, hash: string): boolean {
  return chain === 'solana' ? SOL_TX_RE.test(hash) : EVM_TX_RE.test(hash);
}
function validAddress(chain: string, addr: string): boolean {
  return chain === 'solana' ? SOL_ADDR_RE.test(addr) : EVM_ADDR_RE.test(addr);
}
function sameAddress(chain: string, a: string, b: string): boolean {
  return chain === 'solana' ? a === b : a.toLowerCase() === b.toLowerCase();
}

export async function POST(req: NextRequest) {
  const guard = await guardRoute(req, { rate: 'high' });
  if (!guard.ok) return guard.response;
  const user = guard.user;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    recipientId?: string;
    postId?: string | null;
    chain?: string;
    tokenSymbol?: string;
    tokenAddress?: string | null;
    amount?: string | number;
    amountUsd?: string | number | null;
    txHash?: string;
    senderAddress?: string;
    recipientAddress?: string;
  };

  const chain = (body.chain ?? '').toLowerCase();
  const recipientId = (body.recipientId ?? '').trim();
  const txHash = (body.txHash ?? '').trim();
  const tokenSymbol = (body.tokenSymbol ?? '').trim();
  const senderAddress = (body.senderAddress ?? '').trim();
  const recipientAddress = (body.recipientAddress ?? '').trim();
  const postId = body.postId ? String(body.postId).trim() : null;

  // ── Validation ──────────────────────────────────────────────────────
  if (!GIFT_CHAINS.has(chain)) return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
  if (!UUID_RE.test(recipientId)) return NextResponse.json({ error: 'Invalid recipientId' }, { status: 400 });
  if (recipientId === user.id) return NextResponse.json({ error: 'You cannot gift yourself' }, { status: 400 });
  if (!tokenSymbol || tokenSymbol.length > 24) return NextResponse.json({ error: 'Invalid tokenSymbol' }, { status: 400 });
  if (!validTxHash(chain, txHash)) return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 });
  if (!validAddress(chain, senderAddress)) return NextResponse.json({ error: 'Invalid senderAddress' }, { status: 400 });
  if (!validAddress(chain, recipientAddress)) return NextResponse.json({ error: 'Invalid recipientAddress' }, { status: 400 });
  if (postId && !UUID_RE.test(postId)) return NextResponse.json({ error: 'Invalid postId' }, { status: 400 });

  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount ?? ''));
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

  // amount_usd is stored ONLY when the client passed a real numeric quote.
  // Never fabricate it.
  let amountUsd: number | null = null;
  if (body.amountUsd != null && body.amountUsd !== '') {
    const parsed = typeof body.amountUsd === 'number' ? body.amountUsd : parseFloat(String(body.amountUsd));
    if (Number.isFinite(parsed) && parsed >= 0) amountUsd = parsed;
  }

  const tokenAddress = body.tokenAddress ? String(body.tokenAddress).trim() : null;

  const supabase = getSupabaseAdmin();

  // Recipient must exist.
  const { data: recipient } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', recipientId)
    .maybeSingle<{ id: string }>();
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });

  // Integrity: the recorded recipient address must match the address we would
  // independently resolve for that user on that chain. Prevents recording a
  // transfer to an attacker-chosen address under someone else's name. The
  // client obtained recipientAddress from /api/wire/gift/resolve (same server
  // resolver), so a recipient with no resolvable address could not have been a
  // legitimate gift target - reject rather than trust the client's address.
  const resolved = await resolveReceiveAddress(recipientId, chain);
  if (!resolved) {
    return NextResponse.json({ error: 'Recipient has no receive wallet on this chain' }, { status: 409 });
  }
  if (!sameAddress(chain, resolved, recipientAddress)) {
    return NextResponse.json({ error: 'Recipient address does not match their receive wallet' }, { status: 409 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from('wire_gifts')
    .insert({
      sender_id: user.id,
      recipient_id: recipientId,
      post_id: postId,
      chain,
      token_symbol: tokenSymbol,
      token_address: tokenAddress,
      amount,
      amount_usd: amountUsd,
      tx_hash: txHash,
      status: 'pending',
      sender_address: senderAddress,
      recipient_address: recipientAddress,
    })
    .select('id')
    .single<{ id: string }>();

  if (insErr) {
    // The on-chain transfer already happened; a retry that hits the
    // UNIQUE (chain, tx_hash) constraint means this exact gift is already
    // recorded. Treat it as idempotent success, not a 500.
    if (insErr.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true, status: 'pending' });
    }
    return NextResponse.json({ error: insErr.message || 'Failed to record gift' }, { status: 500 });
  }

  // Post counters (gift_count / gift_total_usd) are maintained atomically by the
  // trg_wire_gift_counts trigger on wire_gifts - no manual bump here (that path
  // was a non-atomic read-modify-write that lost counts under concurrency).

  // Inline confirmation attempt: a native transfer that was broadcast with a
  // 'confirmed' commitment is very often already mined by the time this request
  // arrives, so try once to flip pending→confirmed immediately (recipient's
  // Gifts tab surfaces only confirmed gifts). This is best-effort and read-only
  // on-chain - never fabricates a confirm, never fails the record. The
  // gift-confirm cron is the backstop for gifts still in flight here.
  let status: 'pending' | 'confirmed' = 'pending';
  try {
    // Bound the inline attempt so it can't push this route past maxDuration -
    // whatever isn't resolved in time stays 'pending' for the gift-confirm cron.
    const outcome = await Promise.race<GiftVerifyOutcome>([
      verifyGiftOnChain({ chain, txHash, recipientAddress }),
      new Promise<GiftVerifyOutcome>((resolve) => setTimeout(() => resolve('pending'), 9_000)),
    ]);
    if (outcome === 'confirmed') {
      const { error: updErr } = await supabase
        .from('wire_gifts')
        .update({ status: 'confirmed' })
        .eq('id', inserted.id)
        .eq('status', 'pending');
      if (!updErr) status = 'confirmed';
    }
    // 'failed'/'pending' are left for the cron; the transfer already happened,
    // so we never mark 'failed' from a single early read (a not-yet-mined tx
    // reads identically to a dropped one until the grace window elapses).
  } catch {
    /* leave pending; cron will confirm */
  }

  return NextResponse.json({ ok: true, id: inserted.id, status });
}
