import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { checkTierServer } from '@/lib/subscriptions/serverTierCheck';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { launchpadLabel, launchpadIconUrl, tokenExternalUrl } from '@/lib/sniper/launchpads';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoPlusResult {
  address: string;
  chain: string;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  liquidity: number;
  isOpenSource: boolean;
  isMintable: boolean;
  hasBlacklist: boolean;
  holderCount: number;
  top10HolderPercent: number;
  status: 'SAFE' | 'CAUTION' | 'RISKY' | 'BLOCKED';
  flags: string[];
}

export interface SniperToken {
  id: string;
  address: string;
  symbol: string;
  name: string;
  chain: string;
  liquidity: number;
  tax: number;
  honeypot: boolean;
  securityScore: number;
  detectedAt: number;
  status: 'scanning' | 'safe' | 'risky' | 'blocked' | 'sniped';
  price?: number;
  marketCap?: number;
  pairAge?: string;
  logo?: string;
  source?: string;          // launchpad id (pumpfun, raydium, …)
  sourceLabel?: string;     // human label (Pump.fun)
  sourceIcon?: string | null; // real launchpad icon URL
  url?: string;             // chart / launchpad deep-link for the card
  volume24h?: number;
  priceChange24h?: number;
  fdv?: number;
  txns24h?: number;
  holders?: number;
  bondingCurvePct?: number;
  hasSocial?: boolean;
  socials?: { twitter?: string; telegram?: string; website?: string } | null;
}

interface FeedRowDb {
  token_address: string; symbol: string | null; name: string | null; chain: string;
  logo_url: string | null; launchpad: string | null; dex: string | null;
  price_usd: number | null; market_cap_usd: number | null; fdv_usd: number | null;
  liquidity_usd: number | null; volume_24h_usd: number | null; txns_24h: number | null;
  price_change_24h: number | null; holders: number | null; bonding_curve_pct: number | null;
  socials: { twitter?: string; telegram?: string; website?: string } | null;
  is_honeypot: boolean | null; buy_tax: number | null; sell_tax: number | null;
  security_score: number | null; has_social: boolean | null;
  pool_created_at: string | null; first_seen_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusFromRow(r: FeedRowDb): SniperToken['status'] {
  if (r.is_honeypot) return 'blocked';
  const score = r.security_score;
  if (score == null) return 'scanning';
  if (score >= 70) return 'safe';
  if (score >= 40) return 'risky';
  return 'blocked';
}

function ageLabel(iso: string | null): string {
  if (!iso) return 'New';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

// ─── GET Handler — Real-time New Token Feed (from sniper_feed_tokens) ──────────

export async function GET(request: NextRequest) {
  // Sniper Bot is a Max-tier feature (per the pricing page).
  const gate = await checkTierServer('max');
  if (!gate.allowed) return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60', 10) || 60, 200);
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  const chainFilter = (searchParams.get('chain') || 'all').toLowerCase();
  const minLiquidity = parseFloat(searchParams.get('minLiquidity') ?? '0') || 0;
  const maxLiquidity = searchParams.get('maxLiquidity') ? parseFloat(searchParams.get('maxLiquidity')!) : undefined;
  // Comma-separated launchpad/source filter (e.g. "pumpfun,raydium").
  const sources = (searchParams.get('source') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const q = (searchParams.get('q') || '').trim();
  const sort = (searchParams.get('sort') || 'new').toLowerCase();
  const audit = (searchParams.get('audit') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  // OG mode = earliest token we've ingested per (chain, symbol). Honest
  // "first seen on Naka" — served from the sniper_feed_og view.
  const ogMode = searchParams.get('og') === '1';

  try {
    const sb = getSupabaseAdmin();
    let query = sb.from(ogMode ? 'sniper_feed_og' : 'sniper_feed_tokens').select('*', { count: 'exact' });

    if (chainFilter !== 'all') query = query.eq('chain', chainFilter);
    if (sources.length) query = query.in('launchpad', sources);
    if (minLiquidity > 0) query = query.gte('liquidity_usd', minLiquidity);
    if (maxLiquidity !== undefined) query = query.lte('liquidity_usd', maxLiquidity);
    if (q) {
      // Exact address match OR symbol/name partial — real DB filter, not client.
      query = query.or(`token_address.eq.${q},symbol.ilike.%${q}%,name.ilike.%${q}%`);
    }
    // Audit filters (real columns from GoPlus enrichment).
    if (audit.includes('nohoneypot')) query = query.or('is_honeypot.is.null,is_honeypot.eq.false');
    if (audit.includes('social')) query = query.eq('has_social', true);
    if (audit.includes('devsoldall')) query = query.eq('dev_sold_all', true);

    const sortCol = sort === 'volume' ? 'volume_24h_usd'
      : sort === 'liquidity' ? 'liquidity_usd'
      : sort === 'mcap' ? 'market_cap_usd'
      : 'pool_created_at';
    query = query.order(sortCol, { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message, tokens: [] }, { status: 500 });

    const rows = (data ?? []) as FeedRowDb[];
    const tokens: SniperToken[] = rows.map((r) => ({
      id: `${r.chain}:${r.token_address}`,
      address: r.token_address,
      symbol: r.symbol ?? '???',
      name: r.name ?? 'Unknown',
      chain: r.chain,
      liquidity: r.liquidity_usd ?? 0,
      tax: Math.max(r.buy_tax ?? 0, r.sell_tax ?? 0),
      honeypot: !!r.is_honeypot,
      securityScore: r.security_score ?? 0,
      detectedAt: r.pool_created_at ? Date.parse(r.pool_created_at) : Date.parse(r.first_seen_at),
      status: statusFromRow(r),
      price: r.price_usd ?? undefined,
      marketCap: r.market_cap_usd ?? r.fdv_usd ?? undefined,
      fdv: r.fdv_usd ?? undefined,
      logo: r.logo_url ?? undefined,
      pairAge: ageLabel(r.pool_created_at ?? r.first_seen_at),
      source: r.launchpad ?? 'dex',
      sourceLabel: launchpadLabel(r.launchpad),
      sourceIcon: launchpadIconUrl(r.launchpad),
      url: tokenExternalUrl(r.chain, r.token_address, r.launchpad),
      volume24h: r.volume_24h_usd ?? undefined,
      priceChange24h: r.price_change_24h ?? undefined,
      txns24h: r.txns_24h ?? undefined,
      holders: r.holders ?? undefined,
      bondingCurvePct: r.bonding_curve_pct ?? undefined,
      hasSocial: !!r.has_social,
      socials: r.socials ?? null,
    }));

    // Available source chips = distinct launchpads currently in the feed for the
    // selected chain (so the row reflects what's really live, with real logos).
    let srcQuery = sb.from('sniper_feed_tokens').select('launchpad');
    if (chainFilter !== 'all') srcQuery = srcQuery.eq('chain', chainFilter);
    const { data: srcRows } = await srcQuery.limit(2000);
    const availableSources = Array.from(
      new Set(((srcRows ?? []) as { launchpad: string | null }[]).map((s) => s.launchpad).filter(Boolean)),
    ) as string[];

    return NextResponse.json({ tokens, sources: availableSources, total: count ?? tokens.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tokens';
    return NextResponse.json({ error: msg, tokens: [] }, { status: 500 });
  }
}

// ─── POST Handler — Token Security Check ──────────────────────────────────────

export async function POST(request: NextRequest) {
  const gate = await checkTierServer('max');
  if (!gate.allowed) return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });
  try {
    const body = await request.json();
    const { address, chain } = body as { address: string; chain: string };

    if (!address || !chain) {
      return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
    }

    try {
      const sec = await getTokenSecurity(address, chain);

      // Derive status from safetyLevel
      let status: GoPlusResult['status'] = 'SAFE';
      if (sec.isHoneypot || sec.safetyLevel === 'DANGER') status = 'BLOCKED';
      else if (sec.safetyLevel === 'WARNING') status = 'RISKY';
      else if (sec.safetyLevel === 'CAUTION') status = 'CAUTION';

      // Extract extra fields from raw GoPlus response where available
      const raw = sec.raw as Record<string, unknown> | undefined;
      const dexArr = Array.isArray(raw?.dex) ? (raw!.dex as Array<Record<string, unknown>>) : [];
      const liquidity = parseFloat(String(dexArr[0]?.liquidity ?? '0'));
      const holders = Array.isArray(raw?.holders) ? (raw!.holders as Array<Record<string, unknown>>) : [];
      const top10 = parseFloat(
        holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(String(h.percent ?? '0')), 0).toFixed(2)
      );

      const flags = sec.checks
        .filter(c => c.status === 'fail')
        .map(c => c.label);

      const result: GoPlusResult = {
        address,
        chain,
        isHoneypot: sec.isHoneypot,
        buyTax: parseFloat((sec.buyTax * 100).toFixed(1)),
        sellTax: parseFloat((sec.sellTax * 100).toFixed(1)),
        liquidity,
        isOpenSource: sec.isOpenSource,
        isMintable: sec.isMintable,
        hasBlacklist: !!(raw?.is_blacklisted === '1'),
        holderCount: sec.holderCount,
        top10HolderPercent: top10,
        status,
        flags,
      };

      return NextResponse.json(result);
    } catch {
      // Service layer unavailable — return neutral CAUTION result
      return NextResponse.json({
        address, chain,
        isHoneypot: false, buyTax: 0, sellTax: 0, liquidity: 0,
        isOpenSource: false, isMintable: false, hasBlacklist: false,
        holderCount: 0, top10HolderPercent: 0,
        status: 'CAUTION',
        flags: ['Security data unavailable'],
      } satisfies GoPlusResult);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
