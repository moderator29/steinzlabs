import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Samples REAL network gas price per chain into gas_samples so Smart Gas Timing
// can learn cheap-hour patterns over time. Every value is a live eth_gasPrice
// reading — never synthetic. Prunes rows older than 21 days.

const NAME = 'gas-sample';
const ALCHEMY = process.env.ALCHEMY_API_KEY || '';
const RPCS: Record<string, string> = {
  ethereum: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY}`,
  base: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY}`,
  arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY}`,
  polygon: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY}`,
};

async function gasGwei(rpc: string): Promise<number | null> {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string };
    if (!body.result) return null;
    return parseInt(body.result, 16) / 1e9; // wei → gwei
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  try {
    if (!ALCHEMY) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, 'no-alchemy-key', 0);
      return NextResponse.json({ ok: true, skipped: 'no-key' });
    }
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const rows: Array<{ chain: string; gas_gwei: number; sampled_at: string }> = [];
    await Promise.all(Object.entries(RPCS).map(async ([chain, rpc]) => {
      const g = await gasGwei(rpc);
      if (g != null && g > 0) rows.push({ chain, gas_gwei: Number(g.toFixed(4)), sampled_at: now });
    }));
    if (rows.length) await admin.from('gas_samples').insert(rows);
    await admin.from('gas_samples').delete().lt('sampled_at', new Date(Date.now() - 21 * 24 * 3600_000).toISOString());
    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, rows.length);
    return NextResponse.json({ ok: true, sampled: rows.length });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
