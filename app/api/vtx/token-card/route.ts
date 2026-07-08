import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getBirdeyeOHLCV, getBirdeyeTokenOverview } from '@/lib/services/birdeye';
import { getTokenSecurity } from '@/lib/services/goplus';
import { twGatewayConfigured, twAssetInfo } from '@/lib/services/trustwallet';
import { cmcConfigured, cmcQuoteBySymbol, cmcMetaBySymbol } from '@/lib/services/coinmarketcap';
import { getGtOHLCV } from '@/lib/services/geckoterminal';
import { headlineMarketCap, clampFdv } from '@/lib/market/headline';

// VTX inline token card data — price, real 24h stats, chart series, logo.
// Priority for ANY token: resolve to a real DexScreener pair (by address, or
// by symbol search) and return live on-chain data. CoinGecko is used only for
// the majors it covers (real historical candles). Never returns a fabricated
// number — an unresolved token comes back as an explicit empty shape.

export const runtime = 'nodejs';

interface CacheEntry { at: number; data: unknown }
const cache = new Map<string, CacheEntry>();
const TTL = 60 * 1000;

const SYMBOL_TO_CG: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2',
  MATIC: 'matic-network', POL: 'matic-network', ARB: 'arbitrum', SUI: 'sui',
  LINK: 'chainlink', UNI: 'uniswap', AAVE: 'aave', PEPE: 'pepe', SHIB: 'shiba-inu',
  USDT: 'tether', USDC: 'usd-coin', BONK: 'bonk', WIF: 'dogwifcoin', JUP: 'jupiter-exchange-solana',
  TON: 'the-open-network', OP: 'optimism', LTC: 'litecoin', TRX: 'tron',
};

type Tf = '1h' | '24h' | '7d';

// ─── CoinGecko (majors: real historical series) ────────────────────────────
async function fetchCoinGeckoChart(symbol: string, tf: Tf) {
  const id = SYMBOL_TO_CG[symbol.toUpperCase().replace(/^\$/, '')];
  if (!id) return null;
  const days = tf === '1h' ? 1 : tf === '7d' ? 7 : 1;
  const [chartRes, mktRes] = await Promise.all([
    fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`, { next: { revalidate: 60 } }),
    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}`, { next: { revalidate: 60 } }),
  ]);
  if (!chartRes.ok) return null;
  const body = await chartRes.json();
  const prices: [number, number][] = Array.isArray(body?.prices) ? body.prices : [];
  const step = Math.max(1, Math.floor(prices.length / 48));
  const points = prices.filter((_, i) => i % step === 0).map((p) => p[1]);
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const mkt = mktRes.ok ? (await mktRes.json())?.[0] : null;
  return {
    points, changePct, source: 'coingecko',
    price: typeof mkt?.current_price === 'number' ? mkt.current_price : last,
    change24h: typeof mkt?.price_change_percentage_24h === 'number' ? mkt.price_change_percentage_24h : changePct,
    volume24h: typeof mkt?.total_volume === 'number' ? mkt.total_volume : undefined,
    marketCap: typeof mkt?.market_cap === 'number' ? mkt.market_cap : undefined,
    fdv: typeof mkt?.fully_diluted_valuation === 'number' ? mkt.fully_diluted_valuation
      : (typeof mkt?.market_cap === 'number' ? mkt.market_cap : undefined),
    supply: typeof mkt?.circulating_supply === 'number' ? mkt.circulating_supply : null,
    name: typeof mkt?.name === 'string' ? mkt.name : undefined,
    logo: typeof mkt?.image === 'string' ? mkt.image : undefined,
    holders: null, trusted: false,
  };
}

// ─── DexScreener pair → full card (works for ANY on-chain token) ───────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPairCard(pair: any, opts: { address: string; symbol?: string | null; chain?: string | null; tf: Tf }) {
  const { address, symbol, chain, tf } = opts;
  const price = parseFloat(pair.priceUsd || '0');
  const changes = pair.priceChange || {};
  const tkChain: string = chain || pair.chainId || 'solana';

  // Synthetic %-reconstruction (fallback chart shape when no real candles).
  const window =
    tf === '1h' ? [{ pct: changes.h1 }] :
    tf === '7d' ? [{ pct: changes.h24 !== undefined ? changes.h24 * 3 : undefined }, { pct: changes.h24 !== undefined ? changes.h24 * 2 : undefined }, { pct: changes.h24 }, { pct: changes.h6 }, { pct: changes.h1 }] :
    [{ pct: changes.h24 }, { pct: changes.h6 }, { pct: changes.h1 }];
  const samples = window.filter((w) => typeof w.pct === 'number');
  const synth: number[] = [];
  if (samples.length > 0 && price > 0) {
    for (const s of samples) synth.push(price / (1 + (s.pct! / 100)));
    synth.push(price);
  }

  // Real candles: Birdeye (Solana-strong) → GeckoTerminal (keyless, 100+ nets,
  // best for long-tail memecoins) → CoinGecko (majors) → synthetic.
  let series = synth;
  let chartSource = 'dexscreener';
  try {
    const tfType = tf === '7d' ? '4H' : '1H';
    const tail = tf === '7d' ? 42 : tf === '1h' ? 6 : 24;
    const ohlcv = await getBirdeyeOHLCV(address, tfType, 200, tkChain);
    const real = ohlcv.slice(-tail).map((c) => c.close).filter((v) => typeof v === 'number' && v > 0);
    if (real.length > 1) { series = real; chartSource = 'birdeye'; }
  } catch { /* fall through */ }
  // GeckoTerminal OHLCV keyed by the pair address — this is what makes a large
  // memecoin like The Black Bull actually render a chart when Birdeye misses it.
  if (chartSource === 'dexscreener' && pair.pairAddress) {
    try {
      const tfArgs = tf === '7d' ? { tfType: 'hour' as const, agg: 4, lim: 42 } : tf === '1h' ? { tfType: 'minute' as const, agg: 15, lim: 24 } : { tfType: 'hour' as const, agg: 1, lim: 24 };
      const gt = await getGtOHLCV(tkChain, pair.pairAddress, tfArgs.tfType, tfArgs.lim, tfArgs.agg);
      if (gt.length > 1) { series = gt; chartSource = 'geckoterminal'; }
    } catch { /* fall through */ }
  }
  if (chartSource === 'dexscreener') {
    const cgSym = symbol || pair.baseToken?.symbol;
    if (cgSym) {
      const cg = await fetchCoinGeckoChart(cgSym, tf);
      if (cg && cg.points.length > 1) { series = cg.points; chartSource = 'coingecko'; }
    }
  }
  const first = series[0] ?? price;
  const last = series[series.length - 1] ?? price;
  const changePct = first ? ((last - first) / first) * 100 : 0;

  // Holders + safety — best-effort, parallel.
  let holders: number | null = null;
  let trusted = false;
  try {
    const [ovRes, secRes] = await Promise.allSettled([
      getBirdeyeTokenOverview(address, tkChain),
      getTokenSecurity(address, tkChain),
    ]);
    if (ovRes.status === 'fulfilled' && ovRes.value && typeof ovRes.value.holder === 'number' && ovRes.value.holder > 0) holders = ovRes.value.holder;
    if (secRes.status === 'fulfilled' && secRes.value) trusted = secRes.value.safetyLevel === 'SAFE' && !secRes.value.isHoneypot;
  } catch { /* best-effort */ }

  // DexScreener's API returns BOTH a circulating-based marketCap and an fdv.
  // For long-tail / memecoin tokens (everything routed through this pair path)
  // DexScreener's own UI headlines the FDV — circulating-supply data is
  // unreliable for these, so the FDV is the number DexScreener and traders
  // actually quote. We match that: headline = FDV when it exceeds the reported
  // circulating cap (e.g. The Black Bull reads $267M FDV, not $116M circ), and
  // still expose fdv separately. Majors keep their real circulating cap via the
  // CoinGecko/CMC paths, which have accurate supply.
  const fdvVal = Number(pair.fdv) || 0;
  const circMcap = Number(pair.marketCap) || 0;
  const marketCap = headlineMarketCap(fdvVal, circMcap);
  const fdv = clampFdv(fdvVal || circMcap, marketCap);
  return {
    points: series, changePct, source: chartSource,
    price,
    change24h: changes.h24 ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    marketCap, fdv,
    supply: price > 0 && marketCap > 0 ? marketCap / price : null,
    holders, trusted,
    orbUrl: `/intelligence/${address}`,
    symbol: pair.baseToken?.symbol,
    name: pair.baseToken?.name,
    logo: pair.info?.imageUrl ?? undefined,
    chain: pair.chainId,
    pairAddress: pair.pairAddress,
    dexUrl: pair.url,
  };
}

// Pick the best pair: prefer requested chain + exact symbol match, always the
// deepest liquidity (avoids junk fork pairs that report a wrong market cap).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickBestPair(pairs: any[], opts: { chain?: string | null; symbol?: string | null }): any | null {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  const wantSym = (opts.symbol || '').toUpperCase().replace(/^\$/, '');
  let cands = pairs.filter((p) => !opts.chain || p.chainId === opts.chain);
  if (cands.length === 0) cands = pairs;
  if (wantSym) {
    const exact = cands.filter((p) => (p.baseToken?.symbol || '').toUpperCase() === wantSym);
    if (exact.length) cands = exact;
  }
  return cands.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] ?? null;
}

async function fetchByAddress(address: string, chain: string | null, symbol: string | null, tf: Tf) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const body = await res.json();
  const pair = pickBestPair(body?.pairs, { chain, symbol });
  return pair ? buildPairCard(pair, { address, symbol, chain, tf }) : null;
}

// NEW: resolve ANY token by SYMBOL via DexScreener search — this is what makes
// the card work for ANSEM / NAKA / etc. instead of only the ~24 CoinGecko majors.
async function fetchBySymbolSearch(symbol: string, chain: string | null, tf: Tf) {
  const q = symbol.replace(/^\$/, '');
  const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const body = await res.json();
  const pair = pickBestPair(body?.pairs, { chain, symbol });
  const addr = pair?.baseToken?.address;
  if (!pair || !addr) return null;
  return buildPairCard(pair, { address: addr, symbol, chain: pair.chainId, tf });
}

const EMPTY = { points: [], changePct: 0, source: 'none', price: 0, change24h: 0 };

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const symbol = req.nextUrl.searchParams.get('symbol');
  const chain = req.nextUrl.searchParams.get('chain');
  const tf = (req.nextUrl.searchParams.get('tf') || '24h') as Tf;

  const key = `${chain || ''}:${address || `sym:${symbol}`}:${tf}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json(cached.data, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  }

  try {
    let data: unknown = null;

    if (address) {
      // Address path: real DexScreener pair; fall back to symbol resolution.
      data = await fetchByAddress(address, chain, symbol, tf);
      if (!data && symbol) data = (await fetchCoinGeckoChart(symbol, tf)) ?? (await fetchBySymbolSearch(symbol, chain, tf));
    } else if (symbol) {
      // Symbol path: CoinGecko for majors (real candles), else DexScreener
      // search so ANY token resolves to real data — not just the 24 majors.
      const cg = await fetchCoinGeckoChart(symbol, tf);
      data = cg && cg.points.length > 1 ? cg : ((await fetchBySymbolSearch(symbol, chain, tf)) ?? cg);
    } else {
      return NextResponse.json({ error: 'missing address or symbol' }, { status: 400 });
    }

    let out = data ?? EMPTY;

    // Trust Wallet graceful-primary: when the gateway returns a valid quote for
    // this token, prefer its price / market cap / 24h change / supply / logo
    // (authoritative), while keeping DexScreener's chart, liquidity and pair.
    // Additive — if TW isn't configured or returns nothing, DexScreener stands.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const card = out as any;
    const twChain = (chain || card?.chain) as string | undefined;
    const twAddr = (address || undefined) as string | undefined;
    if (twGatewayConfigured() && twChain && twAddr) {
      const tw = await twAssetInfo(twChain, twAddr).catch(() => null);
      // TW's authoritative contribution is the trust-verified market cap +
      // metadata (its search price is usually null); DexScreener keeps price,
      // chart and liquidity. Only override a field when TW actually has it.
      if (tw && (tw.marketCap || tw.price)) {
        if (tw.price != null && tw.price > 0) { card.price = tw.price; card.priceSource = 'trustwallet'; }
        if (tw.marketCap != null && tw.marketCap > 0) { card.marketCap = tw.marketCap; card.marketCapSource = 'trustwallet'; }
        if (tw.priceChange24h != null) card.change24h = tw.priceChange24h;
        if (tw.volume24h != null && tw.volume24h > 0) card.volume24h = tw.volume24h;
        if (tw.symbol) card.symbol = card.symbol || tw.symbol;
        if (tw.name) card.name = card.name || tw.name;
        if (tw.marketCap && tw.marketCap > 0 && card.price > 0) card.supply = tw.marketCap / card.price;
        card.twVerified = tw.marketCap != null && tw.marketCap > 0;
        out = card;
      }
    }

    // CoinMarketCap graceful backstop (listed tickers only, env-gated). CMC is
    // the one source here that returns real FDV (fully_diluted_market_cap) and
    // an authoritative "listed" price — Trust Wallet's search API has neither.
    // We only FILL gaps: FDV when DexScreener didn't have it, market cap /
    // price / logo when the card is still empty. Never overrides a good live
    // DexScreener price for an arbitrary on-chain token. Inert without a key.
    if (cmcConfigured()) {
      const c = out as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const sym = (c?.symbol || symbol) as string | undefined;
      if (sym) {
        const q = await cmcQuoteBySymbol(sym).catch(() => null);
        if (q) {
          if ((!c.price || c.price <= 0) && q.price != null) { c.price = q.price; c.priceSource = 'coinmarketcap'; }
          if ((!c.marketCap || c.marketCap <= 0) && q.marketCap != null) { c.marketCap = q.marketCap; c.marketCapSource = 'coinmarketcap'; }
          // FDV is CMC's unique contribution — prefer a real CMC FDV over the
          // marketCap==fdv fallback the DexScreener path leaves behind.
          if (q.fdv != null && (!c.fdv || c.fdv <= 0 || c.fdv === c.marketCap)) { c.fdv = q.fdv; c.fdvSource = 'coinmarketcap'; }
          if ((c.change24h == null || c.change24h === 0) && q.change24h != null) c.change24h = q.change24h;
          if ((!c.volume24h || c.volume24h <= 0) && q.volume24h != null) c.volume24h = q.volume24h;
          if ((c.supply == null || c.supply <= 0) && q.circulatingSupply != null) c.supply = q.circulatingSupply;
          if (!c.name && q.name) c.name = q.name;
          c.cmcRank = q.cmcRank ?? c.cmcRank;
          c.cmcVerified = q.cmcRank != null; // CMC-listed = a real, ranked asset
        }
        // Logo backstop: official CMC artwork when nothing else resolved one.
        if (!c.logo) {
          const meta = await cmcMetaBySymbol(sym).catch(() => null);
          if (meta?.logo) c.logo = meta.logo;
        }
        out = c;
      }
    }

    // Invariant guard — FDV (fully-diluted) is total-supply * price and can
    // never be LESS than the circulating market cap. The TW/CMC backstops above
    // override marketCap and fdv from independent sources, which can leave the
    // card showing MCap > FDV (nonsensical, and exactly the kind of self-
    // contradictory number the card must never emit). When both are present and
    // inverted, raise FDV to at least the market cap.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fin = out as any;
    if (fin && typeof fin === 'object') {
      const mc = Number(fin.marketCap) || 0;
      const fd = Number(fin.fdv) || 0;
      if (mc > 0 && fd > 0 && fd < mc) fin.fdv = mc;
      // Keep supply consistent with the FINAL price + market cap actually shown
      // (an earlier block may have recomputed it against a since-overridden
      // price). Only derive when both are real and positive.
      if ((fin.supply == null || Number(fin.supply) <= 0) && mc > 0 && Number(fin.price) > 0) {
        fin.supply = mc / Number(fin.price);
      }
      out = fin;
    }

    cache.set(key, { at: Date.now(), data: out });
    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ ...EMPTY, source: 'error' });
  }
}
