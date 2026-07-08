import 'server-only';
import { NextResponse } from 'next/server';
import { getDLChains, getDLChainTvl, getDLGlobalTvl, getDLStablecoins } from '@/lib/services/defillama';
import { isBitqueryEnabled, getChainDexMetrics } from '@/lib/services/bitquery';
import { getMarketsByIds } from '@/lib/services/coingecko';
import { getSocialScore, type LunarCrushSocialScore } from '@/lib/services/lunarcrush';

export interface TrendSparkpoint { t: number; v: number }

// A single real signal that fed the momentum composite. `detail` is the raw
// metric (e.g. "TVL +4.2% 24h") so every score is traceable to real data.
export interface TrendFactor { label: string; detail: string; score: number }

export interface TrendCard {
  id: string;
  chain: string;
  metric: 'TVL' | 'Volume' | 'Stablecoins' | 'Gas' | 'Addresses' | 'Transactions';
  value: string;
  rawValue: number;
  change24h: number;
  change7d: number;
  sparkline: TrendSparkpoint[];  // last 14 data points
  direction: 'up' | 'down' | 'flat';
  hot: boolean;
  alert?: string;
  insight?: string;
  // ─── Momentum enrichment (real-signal composite) ────────────────────────────
  // 0–100 where 50 = neutral. Blended from the REAL signals available for this
  // card (TVL Δ, native-token price Δ from CoinGecko, LunarCrush social
  // sentiment). Weights renormalize over whichever signals resolved, so a
  // missing feed degrades gracefully rather than fabricating a number.
  momentum?: number;
  momentumLabel?: 'Accelerating' | 'Rising' | 'Stable' | 'Cooling' | 'Falling';
  factors?: TrendFactor[];
  // Native-asset price move (CoinGecko), when the chain has a mapped gecko_id.
  priceChange24h?: number;
  priceChange7d?: number;
  // LunarCrush social read for the chain's native token, when available.
  social?: { galaxyScore: number; sentiment: number; socialVolume24h: number; altRank: number };
}

export interface TrendAlertItem {
  id: string; chain: string; metric: string; message: string; severity: 'high' | 'medium' | 'low'; ts: number;
}

export interface TrendsResponse {
  cards: TrendCard[]; alerts: TrendAlertItem[]; updatedAt: string; chains: string[];
}

function fmtBig(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

function pctChange(current: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((current - prev) / prev) * 10000) / 100;
}

function fmtPct(p: number): string { return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`; }

function buildSparkline(history: { date: number; tvl: number }[]): TrendSparkpoint[] {
  const sorted = [...history].sort((a, b) => a.date - b.date);
  return sorted.slice(-14).map(p => ({ t: p.date, v: p.tvl }));
}

// ─── Momentum composite ─────────────────────────────────────────────────────
// Each contributing signal is squashed onto a 0–100 scale (50 = neutral) with a
// tanh so extreme % moves saturate instead of dominating. The composite is a
// weight-renormalized average over ONLY the signals that resolved to real data,
// so an unavailable feed (e.g. no LunarCrush key) is dropped, never guessed.

function sig(pct: number, scale: number): number {
  if (!Number.isFinite(pct)) return NaN;
  return 50 + 50 * Math.tanh(pct / scale);
}

interface WeightedFactor { label: string; detail: string; score: number; weight: number }

function buildMomentum(candidates: WeightedFactor[]): { score: number; label: TrendCard['momentumLabel']; factors: TrendFactor[] } | null {
  const present = candidates.filter(f => Number.isFinite(f.score));
  if (!present.length) return null;
  const totalW = present.reduce((s, f) => s + f.weight, 0) || 1;
  const score = Math.round(present.reduce((s, f) => s + f.score * f.weight, 0) / totalW);
  const label: TrendCard['momentumLabel'] =
    score >= 70 ? 'Accelerating' : score >= 58 ? 'Rising' : score >= 43 ? 'Stable' : score >= 30 ? 'Cooling' : 'Falling';
  return { score, label, factors: present.map(({ label, detail, score }) => ({ label, detail, score: Math.round(score) })) };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cache: { data: TrendsResponse; ts: number } | null = null;
const CACHE_TTL = 300_000; // 5 min

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain');
    if (!chain || chain === 'all') return NextResponse.json(cache.data);
    const filtered = { ...cache.data, cards: cache.data.cards.filter(c => c.chain.toLowerCase() === chain.toLowerCase()) };
    return NextResponse.json(filtered);
  }

  try {
    const [chains, globalHistory, stablecoins] = await Promise.all([
      getDLChains(),
      getDLGlobalTvl(),
      getDLStablecoins(),
    ]);

    const topChains = [...chains].sort((a, b) => b.tvl - a.tvl).slice(0, 8);
    const chainCards = topChains.slice(0, 5);
    const cards: TrendCard[] = [];
    const alerts: TrendAlertItem[] = [];

    // Real enrichment feeds pulled once for the whole per-chain set:
    //  · CoinGecko native-asset price move (mapped by DeFiLlama gecko_id)
    //  · LunarCrush social sentiment (mapped by native token symbol)
    // Both fail soft — a missing key/feed just drops that momentum signal.
    const geckoIds = [...new Set(chainCards.map(c => c.gecko_id).filter((v): v is string => !!v))];
    const symbols = [...new Set(chainCards.map(c => c.tokenSymbol).filter((v): v is string => !!v))];

    const [chainHistories, markets, socialSettled] = await Promise.all([
      Promise.allSettled(chainCards.map(c => getDLChainTvl(c.name))),
      getMarketsByIds(geckoIds, false).catch(() => []),
      Promise.allSettled(symbols.map(s => getSocialScore(s))),
    ]);

    const marketByGecko = new Map(markets.map(m => [m.id, m]));
    const socialBySymbol = new Map<string, LunarCrushSocialScore>();
    symbols.forEach((s, i) => {
      const r = socialSettled[i];
      if (r.status === 'fulfilled' && r.value) socialBySymbol.set(s.toUpperCase(), r.value);
    });

    // Global TVL card
    const globalSorted = [...globalHistory].sort((a, b) => a.date - b.date);
    const globalNow = globalSorted.at(-1)?.tvl ?? 0;
    const global24h = globalSorted.at(-2)?.tvl ?? globalNow;
    const global7d = globalSorted.at(-8)?.tvl ?? globalNow;
    const globalChange24h = pctChange(globalNow, global24h);
    const globalChange7d = pctChange(globalNow, global7d);
    // Only render the TVL card when DeFiLlama actually returned data. On a
    // DeFiLlama outage the history is [] → globalNow=0, and a "$0 TVL" card
    // reads as fabricated. Omit it instead (honest empty).
    if (globalNow > 0) {
      const mom = buildMomentum([
        { label: 'TVL 24h', detail: `TVL ${fmtPct(globalChange24h)} 24h`, score: sig(globalChange24h, 6), weight: 0.7 },
        { label: 'TVL 7d', detail: `TVL ${fmtPct(globalChange7d)} 7d`, score: sig(globalChange7d, 16), weight: 0.3 },
      ]);
      cards.push({
        id: 'global-tvl', chain: 'All Chains', metric: 'TVL',
        value: fmtBig(globalNow), rawValue: globalNow,
        change24h: globalChange24h, change7d: globalChange7d,
        sparkline: buildSparkline(globalHistory),
        direction: globalChange24h > 0.5 ? 'up' : globalChange24h < -0.5 ? 'down' : 'flat',
        hot: Math.abs(globalChange24h) > 3,
        momentum: mom?.score, momentumLabel: mom?.label, factors: mom?.factors,
      });
    }

    // Per-chain TVL cards (top 5), each enriched with a real-signal momentum score.
    for (let i = 0; i < chainCards.length; i++) {
      const chain = chainCards[i];
      const histResult = chainHistories[i];
      const hist = histResult.status === 'fulfilled' ? histResult.value : [];
      const spark = buildSparkline(hist);
      const now = chain.tvl;
      if (now <= 0) continue; // skip chains with no TVL data (honest empty)
      const prev24h = hist.at(-2)?.tvl ?? now;
      const prev7d = hist.at(-8)?.tvl ?? now;
      const ch24h = pctChange(now, prev24h);
      const ch7d = pctChange(now, prev7d);

      const market = chain.gecko_id ? marketByGecko.get(chain.gecko_id) : undefined;
      const priceCh24h = market?.price_change_percentage_24h;
      const priceCh7d = market?.price_change_percentage_7d_in_currency;
      const social = chain.tokenSymbol ? socialBySymbol.get(chain.tokenSymbol.toUpperCase()) : undefined;

      const mom = buildMomentum([
        { label: 'TVL 24h', detail: `TVL ${fmtPct(ch24h)} 24h`, score: sig(ch24h, 8), weight: 0.42 },
        { label: 'TVL 7d', detail: `TVL ${fmtPct(ch7d)} 7d`, score: sig(ch7d, 20), weight: 0.15 },
        { label: 'Price 24h', detail: `Price ${priceCh24h != null ? fmtPct(priceCh24h) : 'n/a'} 24h`, score: sig(priceCh24h ?? NaN, 12), weight: 0.28 },
        { label: 'Social', detail: social ? `Sentiment ${social.sentimentScore > 0 ? '+' : ''}${social.sentimentScore} · Galaxy ${social.galaxyScore}` : 'n/a', score: social ? (social.sentimentScore + 100) / 2 : NaN, weight: 0.15 },
      ]);

      const isHot = Math.abs(ch24h) > 5 || (!!mom && (mom.score >= 74 || mom.score <= 26));
      cards.push({
        id: `tvl-${chain.name.toLowerCase()}`,
        chain: chain.name, metric: 'TVL',
        value: fmtBig(now), rawValue: now,
        change24h: ch24h, change7d: ch7d, sparkline: spark,
        direction: ch24h > 0.5 ? 'up' : ch24h < -0.5 ? 'down' : 'flat', hot: isHot,
        momentum: mom?.score, momentumLabel: mom?.label, factors: mom?.factors,
        priceChange24h: priceCh24h != null ? Math.round(priceCh24h * 100) / 100 : undefined,
        priceChange7d: priceCh7d != null ? Math.round(priceCh7d * 100) / 100 : undefined,
        social: social ? {
          galaxyScore: social.galaxyScore,
          sentiment: social.sentimentScore,
          socialVolume24h: social.socialVolume24h,
          altRank: social.altRank,
        } : undefined,
      });
      // Generate alerts for big moves
      if (Math.abs(ch24h) > 10) {
        alerts.push({
          id: `alert-tvl-${chain.name}`, chain: chain.name, metric: 'TVL',
          message: `${chain.name} TVL ${ch24h > 0 ? 'surged' : 'dropped'} ${Math.abs(ch24h).toFixed(1)}% in 24h`,
          severity: Math.abs(ch24h) > 20 ? 'high' : 'medium',
          ts: Date.now(),
        });
      }
    }

    // Real 24h DEX volume + unique active traders per chain (Bitquery). No-op
    // when BITQUERY_API_KEY is unset; each card carries real data or is omitted.
    if (isBitqueryEnabled()) {
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const DL_TO_SLUG: Record<string, string> = {
        ethereum: 'ethereum', solana: 'solana', bsc: 'bsc', arbitrum: 'arbitrum',
        base: 'base', polygon: 'polygon', optimism: 'optimism',
      };
      const metricChains = chainCards
        .map(c => ({ name: c.name, slug: DL_TO_SLUG[c.name.toLowerCase()] }))
        .filter((c): c is { name: string; slug: string } => !!c.slug);
      // Pull the 24h window and the trailing 48h window in parallel. DEX volume
      // is an additive sum, so (48h − 24h) is the REAL prior-24h volume and lets
      // us compute a true 24h volume-momentum %. Unique-address counts are a
      // distinct-set metric and are NOT subtractable, so we leave their change
      // at 0 (honest) rather than fabricate a delta.
      const [m24, m48] = await Promise.all([
        Promise.allSettled(metricChains.map(c => getChainDexMetrics(c.slug, since24h))),
        Promise.allSettled(metricChains.map(c => getChainDexMetrics(c.slug, since48h))),
      ]);
      metricChains.forEach((c, i) => {
        const r = m24[i];
        const m = r.status === 'fulfilled' ? r.value : null;
        if (!m) return;
        if (m.volumeUsd > 0) {
          const r48 = m48[i];
          const cum48 = r48.status === 'fulfilled' ? r48.value?.volumeUsd ?? 0 : 0;
          const prior24 = cum48 > m.volumeUsd ? cum48 - m.volumeUsd : 0;
          const volCh24h = prior24 > 0 ? pctChange(m.volumeUsd, prior24) : 0;
          const volMom = buildMomentum([
            { label: 'Volume 24h', detail: `DEX volume ${fmtPct(volCh24h)} 24h`, score: sig(volCh24h, 15), weight: 1 },
          ]);
          cards.push({
            id: `vol-${c.slug}`, chain: c.name, metric: 'Volume',
            value: fmtBig(m.volumeUsd), rawValue: m.volumeUsd,
            change24h: volCh24h, change7d: 0, sparkline: [],
            direction: volCh24h > 1 ? 'up' : volCh24h < -1 ? 'down' : 'flat',
            hot: Math.abs(volCh24h) > 25,
            momentum: volMom?.score, momentumLabel: volMom?.label, factors: volMom?.factors,
          });
          if (Math.abs(volCh24h) > 40) {
            alerts.push({
              id: `alert-vol-${c.slug}`, chain: c.name, metric: 'Volume',
              message: `${c.name} DEX volume ${volCh24h > 0 ? 'jumped' : 'fell'} ${Math.abs(volCh24h).toFixed(0)}% vs the prior 24h`,
              severity: Math.abs(volCh24h) > 80 ? 'high' : 'medium', ts: Date.now(),
            });
          }
        }
        if (m.activeAddresses > 0) {
          cards.push({
            id: `addr-${c.slug}`, chain: c.name, metric: 'Addresses',
            value: m.activeAddresses.toLocaleString(), rawValue: m.activeAddresses,
            change24h: 0, change7d: 0, sparkline: [], direction: 'flat', hot: false,
          });
        }
      });
    }

    // Stablecoin marketcap card
    const totalStable = stablecoins.reduce((s, t) => s + (t.circulating?.peggedUSD ?? 0), 0);
    // Real 24h change: DeFiLlama returns circulatingPrevDay alongside circulating,
    // so we can report an honest aggregate stablecoin-supply move (a dollar-
    // liquidity momentum read) instead of a flat 0.
    const totalStablePrev = stablecoins.reduce((s, t) => s + (t.circulatingPrevDay?.peggedUSD ?? t.circulating?.peggedUSD ?? 0), 0);
    const stableCh24h = totalStablePrev > 0 ? pctChange(totalStable, totalStablePrev) : 0;
    if (totalStable > 0) {
      cards.push({
        id: 'stablecoins', chain: 'All Chains', metric: 'Stablecoins',
        value: fmtBig(totalStable), rawValue: totalStable,
        change24h: stableCh24h, change7d: 0,
        // No fabricated series: we don't have a real stablecoin-marketcap history
        // feed here, so the sparkline is empty rather than synthetic. The card
        // shows the real current total and its real 24h supply change.
        sparkline: [],
        direction: stableCh24h > 0.1 ? 'up' : stableCh24h < -0.1 ? 'down' : 'flat',
        hot: Math.abs(stableCh24h) > 1,
      });
    }

    const uniqueChains = ['All Chains', ...chainCards.map(c => c.name)];
    const result: TrendsResponse = { cards, alerts, updatedAt: new Date().toISOString(), chains: uniqueChains };
    cache = { data: result, ts: Date.now() };

    // Cache-poisoning fix: the chain filter used to mutate result.cards AFTER
    // it was stored in the module cache by reference, so a filtered request
    // permanently shrank the cached full set for every later caller. Build a
    // fresh response object and never touch the cached one.
    const { searchParams } = new URL(request.url);
    const chainFilter = searchParams.get('chain');
    const responseBody: TrendsResponse = (chainFilter && chainFilter !== 'all')
      ? { ...result, cards: result.cards.filter(c => c.chain.toLowerCase() === chainFilter.toLowerCase()) }
      : result;

    return NextResponse.json(responseBody, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch on-chain trends';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
