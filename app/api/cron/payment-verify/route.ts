import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAssetTransfers } from '@/lib/services/alchemy';
import {
  PAYMENT_CHAINS,
  TIER_DURATION_DAYS,
  AMOUNT_MATCH_TOLERANCE,
  treasuryAddress,
} from '@/lib/payments/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAME = 'payment-verify';

// Watches the treasury address for incoming USDC and confirms matching pending
// payments, granting the tier. Match = same chain + USDC asset + amount within
// tolerance of the pending payment's UNIQUE expected amount + transfer after
// the payment was created. Idempotent: a confirmed payment is skipped, and a
// tx_hash already used by another confirmed payment can't be reused.
export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();

  const treasury = treasuryAddress();
  if (!treasury) {
    await logCronExecution(NAME, 'success', Date.now() - startedAt, 'no treasury configured', 0);
    return NextResponse.json({ ok: true, skipped: 'no-treasury' });
  }

  const admin = getSupabaseAdmin();
  let confirmed = 0;

  try {
    // Expire stale pendings first (cheap, keeps the pending set small).
    await admin
      .from('crypto_payments')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    const { data: pendings } = await admin
      .from('crypto_payments')
      .select('id, user_id, tier, chain, expected_amount, created_at')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (!pendings || pendings.length === 0) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, confirmed: 0 });
    }

    // Only fetch transfers for chains that actually have pending payments.
    const chainsWithWork = [...new Set(pendings.map((p) => p.chain))].filter((c) =>
      PAYMENT_CHAINS.some((pc) => pc.id === c),
    );

    for (const chain of chainsWithWork) {
      let transfers: Awaited<ReturnType<typeof getAssetTransfers>> = [];
      try {
        transfers = await getAssetTransfers(treasury, chain, 'to', 100);
      } catch (err) {
        Sentry.captureException(err, { tags: { cron: NAME, chain } });
        continue;
      }
      // Only USDC transfers matter here.
      const usdcIn = transfers.filter((t) => (t.asset || '').toUpperCase() === 'USDC');

      for (const p of pendings.filter((x) => x.chain === chain)) {
        const createdMs = new Date(p.created_at).getTime();
        const match = usdcIn.find((t) => {
          const val = parseFloat(t.value);
          if (!Number.isFinite(val)) return false;
          const amountOk = Math.abs(val - Number(p.expected_amount)) <= AMOUNT_MATCH_TOLERANCE;
          const tsOk = t.timestamp == null || t.timestamp * 1000 >= createdMs - 5 * 60_000;
          return amountOk && tsOk;
        });
        if (!match) continue;

        // Guard: this tx must not already be tied to another confirmed payment.
        const { count: used } = await admin
          .from('crypto_payments')
          .select('id', { count: 'exact', head: true })
          .eq('tx_hash', match.hash)
          .eq('status', 'confirmed');
        if ((used ?? 0) > 0) continue;

        const expiresAt = new Date(Date.now() + TIER_DURATION_DAYS * 24 * 3600_000).toISOString();

        // Confirm the payment (guarded on still-pending to avoid double-grant
        // if two cron ticks overlap).
        const { data: confirmedRow } = await admin
          .from('crypto_payments')
          .update({ status: 'confirmed', tx_hash: match.hash, confirmed_at: new Date().toISOString() })
          .eq('id', p.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();
        if (!confirmedRow) continue;

        // Grant the tier.
        await admin
          .from('profiles')
          .update({ tier: p.tier, tier_source: 'crypto', tier_expires_at: expiresAt })
          .eq('id', p.user_id);

        // Best-effort in-app confirmation notification (never Telegram — this
        // is not a security event; the notifications route mutes non-signal
        // types from Telegram anyway).
        try {
          await admin.from('notifications').insert({
            user_id: p.user_id,
            type: 'system',
            title: `${p.tier.toUpperCase()} plan activated`,
            body: `Your ${p.tier} subscription is active for ${TIER_DURATION_DAYS} days. Payment confirmed on ${chain}.`,
            read: false,
            created_at: new Date().toISOString(),
            metadata: { tx_hash: match.hash, chain, tier: p.tier },
          });
        } catch { /* notification is non-critical */ }

        confirmed++;
      }
    }

    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, confirmed);
    return NextResponse.json({ ok: true, confirmed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, confirmed);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
