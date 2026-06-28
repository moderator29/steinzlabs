import 'server-only';
import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { isBitqueryEnabled, getActiveTraders, getSolanaWalletBuys } from '@/lib/services/bitquery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only Bitquery smoke test. Hit this after setting BITQUERY_API_KEY to
 * confirm the key works AND the GraphQL field names match your plan. If
 * `keyConfigured` is true but the arrays are empty, the query likely needs a
 * field tweak — verify it in https://ide.bitquery.io and adjust
 * lib/services/bitquery.ts. (Discovery/activity crons fail closed until this
 * returns data, so nothing breaks meanwhile.)
 */
export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const out: Record<string, unknown> = { keyConfigured: isBitqueryEnabled() };

  if (!out.keyConfigured) {
    return NextResponse.json({ ...out, hint: 'Set BITQUERY_API_KEY (the ory_at_… access token) in the environment.' });
  }

  try {
    const evm = await getActiveTraders('ethereum', { sinceIso: since, limit: 5 });
    out.evmActiveTraders = { count: evm.length, sample: evm.slice(0, 3) };
  } catch (e) {
    out.evmActiveTraders = { error: e instanceof Error ? e.message : 'failed' };
  }
  try {
    const sol = await getActiveTraders('solana', { sinceIso: since, limit: 5 });
    out.solanaActiveTraders = { count: sol.length, sample: sol.slice(0, 3) };
  } catch (e) {
    out.solanaActiveTraders = { error: e instanceof Error ? e.message : 'failed' };
  }
  // A known active Solana DEX wallet sample is hard to hardcode; if the caller
  // passes ?solWallet=<addr> we probe its recent buys to validate that query too.
  const solWallet = new URL(request.url).searchParams.get('solWallet');
  if (solWallet) {
    try {
      const buys = await getSolanaWalletBuys(solWallet, since, 5);
      out.solanaWalletBuys = { count: buys.length, sample: buys.slice(0, 3) };
    } catch (e) {
      out.solanaWalletBuys = { error: e instanceof Error ? e.message : 'failed' };
    }
  }

  return NextResponse.json(out);
}
