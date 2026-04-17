import 'server-only';
import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

const ALLOWED_HOSTS = [
  'solana-mainnet.g.alchemy.com',
  'eth-mainnet.g.alchemy.com',
  'base-mainnet.g.alchemy.com',
  'api.dexscreener.com',
  'api.coingecko.com',
  'api.thegraph.com',
  'quote-api.jup.ag',
  'public-api.birdeye.so',
  'api.arkhamintelligence.com',
  'rpc.flashbots.net',
  'mainnet.block-engine.jito.wtf',
  'phvewrldcdxupsnakddx.supabase.co',
  'challenges.cloudflare.com',
  'api.anthropic.com',
];

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    const targetUrl = new URL(target);
    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return NextResponse.json({ error: 'Host not in allowlist' }, { status: 403 });
    }

    const start = Date.now();
    const res = await fetch(target, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    }).catch(() =>
      fetch(target, { method: 'GET', signal: AbortSignal.timeout(8000) })
    );

    const latencyMs = Date.now() - start;
    let status: 'active' | 'warning' | 'error' = 'active';
    if (latencyMs > 1000) status = 'warning';
    if (!res.ok) status = 'error';

    return NextResponse.json({
      status,
      latencyMs,
      httpStatus: res.status,
      errorMsg: !res.ok ? `HTTP ${res.status}` : undefined,
    });
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      latencyMs: -1,
      errorMsg: err instanceof Error ? err.message : 'Request failed',
    });
  }
}
