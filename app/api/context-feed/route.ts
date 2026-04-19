import 'server-only';
import { NextResponse } from 'next/server';
import { applyContextFilter, type PersonalContext } from '@/lib/contextFeed/filter';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function buildPersonalContext(request: Request): Promise<PersonalContext | undefined> {
  try {
    const user = await getAuthenticatedUser(request as unknown as import('next/server').NextRequest);
    if (!user) return undefined;
    const supabase = getSupabaseAdmin();
    const [watchlistR, followsR] = await Promise.all([
      supabase.from('watchlist').select('token_id').eq('user_id', user.id).limit(200),
      supabase.from('user_whale_follows').select('whale_address').eq('user_id', user.id).limit(200),
    ]);
    const watchlistSymbols = new Set<string>();
    (watchlistR.data ?? []).forEach((w: { token_id: string | null }) => {
      if (w.token_id) watchlistSymbols.add(w.token_id.toUpperCase());
    });
    const followedAddresses = new Set<string>();
    (followsR.data ?? []).forEach((f: { whale_address: string | null }) => {
      if (f.whale_address) followedAddresses.add(f.whale_address.toLowerCase());
    });
    return { watchlistSymbols, followedAddresses };
  } catch {
    return undefined;
  }
}

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const COINGECKO_KEY = process.env.COINGECKO_API_KEY;
const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
  || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

interface WhaleEvent {
  id: string;
  type: string;
  sentiment: string;
  title: string;
  summary: string;
  from: string;
  to: string;
  value: number;
  valueUsd: number;
  chain: string;
  trustScore: number;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenPrice?: string;
  tokenVolume24h?: number;
  tokenLiquidity?: number;
  tokenMarketCap?: number;
  tokenPriceChange24h?: number;
  pairAddress?: string;
  dexUrl?: string;
  tokenIcon?: string;
  platform?: string;
  buys24h?: number;
  sells24h?: number;
}

function fmtUsd(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function fmtPrice(price: string | number): string {
  const p = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(p) || p === 0) return '';
  if (p < 0.0001) return `$${p.toFixed(8)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(2)}`;
}

function recentTimestamp(): string {
  // Return actual current time — no artificial randomization
  return new Date().toISOString();
}

const priceCache: { eth: number; sol: number; bnb: number; matic: number; avax: number; ts: number } = { eth: 0, sol: 0, bnb: 0, matic: 0, avax: 0, ts: 0 };

const responseCache: Record<string, { data: WhaleEvent[]; ts: number; sources: string[] }> = {};
const CACHE_TTL = 5000;

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const eventStore: Map<string, WhaleEvent & { fetchedAt: number }> = new Map();

function storeEvents(events: WhaleEvent[]): void {
  const now = Date.now();
  events.forEach(event => {
    if (!eventStore.has(event.id)) {
      eventStore.set(event.id, { ...event, fetchedAt: now });
    }
  });
  const keysToDelete: string[] = [];
  eventStore.forEach((stored, id) => {
    if (now - stored.fetchedAt > TWENTY_FOUR_HOURS * 3) {
      keysToDelete.push(id);
    }
  });
  keysToDelete.forEach(id => eventStore.delete(id));
}

function getLiveEvents(chain: string): WhaleEvent[] {
  const now = Date.now();
  const live: WhaleEvent[] = [];
  eventStore.forEach(stored => {
    if (now - stored.fetchedAt <= TWENTY_FOUR_HOURS) {
      if (chain === 'all' || stored.chain === chain) {
        const { fetchedAt, ...event } = stored;
        live.push(event);
      }
    }
  });
  live.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return live;
}

// Hard-cap any source fetch so a single hung upstream (DexScreener, Alchemy,
// pump.fun) cannot drag the whole feed into the 15-min Vercel timeout. The
// route must always return within a few seconds even if half the sources die.
async function withSrcTimeout<T>(p: Promise<T[]>, ms: number, label: string): Promise<T[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T[]>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[context-feed] ${label} timed out after ${ms}ms`);
      resolve([] as T[]);
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } catch (err) {
    console.warn(`[context-feed] ${label} threw:`, err);
    return [] as T[];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getArchivedEvents(chain: string): WhaleEvent[] {
  const now = Date.now();
  const archived: WhaleEvent[] = [];
  eventStore.forEach(stored => {
    if (now - stored.fetchedAt > TWENTY_FOUR_HOURS && now - stored.fetchedAt <= TWENTY_FOUR_HOURS * 3) {
      if (chain === 'all' || stored.chain === chain) {
        const { fetchedAt, ...event } = stored;
        archived.push(event);
      }
    }
  });
  archived.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return archived;
}

async function fetchPrices(): Promise<void> {
  if (Date.now() - priceCache.ts < 30000) return;
  try {
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana,binancecoin,matic-network,avalanche-2&vs_currencies=usd', { headers });
    const data = await res.json();
    priceCache.eth = data?.ethereum?.usd || priceCache.eth;
    priceCache.sol = data?.solana?.usd || priceCache.sol;
    priceCache.bnb = data?.binancecoin?.usd || priceCache.bnb;
    priceCache.matic = data?.['matic-network']?.usd || priceCache.matic;
    priceCache.avax = data?.['avalanche-2']?.usd || priceCache.avax;
    priceCache.ts = Date.now();
  } catch (err) {
    console.error('[context-feed] Fetch prices from CoinGecko failed:', err);
  }
}

async function fetchAlchemyTransfers(): Promise<WhaleEvent[]> {
  if (!ALCHEMY_KEY) return [];
  try {
    await fetchPrices();
    const blockRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    const blockData = await blockRes.json();
    const latestBlock = parseInt(blockData.result, 16);

    const txRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'alchemy_getAssetTransfers',
        params: [{ fromBlock: `0x${(latestBlock - 50).toString(16)}`, toBlock: 'latest', category: ['external', 'erc20'], order: 'desc', maxCount: '0x32', withMetadata: true }]
      }),
    });
    const txData = await txRes.json();
    const transfers = txData.result?.transfers || [];
    const whaleTransfers = transfers.filter((tx: any) => {
      if (tx.category === 'erc20') return true;
      return (tx.value || 0) >= 1;
    }).slice(0, 50);

    return whaleTransfers.map((tx: any, i: number) => {
      const isErc20 = tx.category === 'erc20';
      const valueEth = tx.value || 0;
      const valueUsd = isErc20 ? (tx.rawContract?.value ? parseInt(tx.rawContract.value, 16) / 1e18 * priceCache.eth : 0) : valueEth * priceCache.eth;

      // Deterministic sentiment based on transfer type, not position index
      const tokenSym = isErc20 ? (tx.asset || 'ERC20') : 'ETH';
      const isStable = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'].includes(tokenSym.toUpperCase());
      const sentiment = isStable ? 'HYPE' : isErc20 ? 'HYPE' : 'BULLISH';

      // Deterministic trust score based on USD value of transfer
      const trustScore = valueUsd >= 1_000_000 ? 92
        : valueUsd >= 500_000 ? 88
        : valueUsd >= 100_000 ? 80
        : valueUsd >= 50_000 ? 72
        : 65;

      const tokenSymbol = isErc20 ? (tx.asset || 'ERC20') : 'ETH';
      const tokenName = isErc20 ? (tx.asset || 'ERC-20 Token') : 'Ethereum';
      const titleVal = isErc20
        ? `${tokenSymbol} token transfer detected (${fmtUsd(valueUsd > 0 ? valueUsd : valueEth)})`
        : `ETH whale moved ${valueEth.toFixed(1)} ETH (${fmtUsd(valueUsd)})`;

      return {
        id: tx.hash ? `${tx.hash}-${i}` : `eth-${i}-${Date.now()}`,
        type: isErc20 ? 'token_transfer' : 'whale_transfer',
        sentiment,
        title: titleVal,
        summary: isErc20
          ? `${tokenSymbol} transferred on Ethereum. Whale wallet activity detected.`
          : `${valueEth.toFixed(2)} ETH transferred on Ethereum. Volume: ${fmtUsd(valueUsd)}. Whale wallet activity detected.`,
        from: tx.from || '0x0000',
        to: tx.to || '0x0000',
        value: valueEth,
        valueUsd: Math.round(valueUsd),
        chain: 'ethereum',
        trustScore,
        txHash: tx.hash || '',
        blockNumber: parseInt(tx.blockNum, 16) || 0,
        timestamp: tx.metadata?.blockTimestamp || new Date().toISOString(),
        tokenName,
        tokenSymbol,
        tokenPrice: fmtPrice(priceCache.eth),
        platform: 'Ethereum Mainnet',
      };
    });
  } catch (error) {

    return [];
  }
}

async function fetchSolanaNetworkActivity(): Promise<WhaleEvent[]> {
  if (!SOLANA_RPC) return [];
  try {
    await fetchPrices();
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getRecentPerformanceSamples', params: [5] }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const samples = data.result || [];

    return samples.slice(0, 3).map((sample: any, i: number) => {
      const txCount = sample.numTransactions || 0;
      const slot = sample.slot || 0;
      return {
        id: `sol-perf-${slot}`,
        type: 'network_activity',
        sentiment: txCount > 3000 ? 'BULLISH' : 'HYPE',
        title: `Solana: ${txCount.toLocaleString()} txns processed`,
        summary: `${txCount.toLocaleString()} transactions at slot ${slot.toLocaleString()}. SOL: $${priceCache.sol.toFixed(2)}.`,
        from: 'Solana Network',
        to: 'Validators',
        value: txCount,
        valueUsd: Math.round(txCount * 0.01 * priceCache.sol),
        chain: 'solana',
        trustScore: txCount > 5000 ? 95 : txCount > 2000 ? 90 : 85,
        txHash: `slot-${slot}`,
        blockNumber: slot,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        tokenName: 'Solana',
        tokenSymbol: 'SOL',
        tokenPrice: fmtPrice(priceCache.sol),
        platform: 'Solana Mainnet',
      };
    });
  } catch {
    return [];
  }
}

async function fetchPumpFunTokens(): Promise<WhaleEvent[]> {
  // Use DexScreener as reliable source for pump.fun tokens (the Heroku endpoint is unstable)
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=pump.fun',
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const pairs = (data.pairs || [])
      .filter((p: any) => p.chainId === 'solana' && (p.dexId === 'pump' || p.dexId === 'raydium'))
      .sort((a: any, b: any) => (parseFloat(b.volume?.h24 || 0)) - (parseFloat(a.volume?.h24 || 0)))
      .slice(0, 10);

    return pairs.map((pair: any) => {
      const mcap = pair.fdv || pair.marketCap || 0;
      const vol24h = pair.volume?.h24 || 0;
      const change24h = pair.priceChange?.h24 || 0;
      const trustScore = Math.min(90, Math.max(20, 40 + (mcap > 100000 ? 20 : 0) + (vol24h > 10000 ? 15 : 0)));
      const sentiment = change24h > 10 ? 'BULLISH' : change24h < -10 ? 'BEARISH' : 'HYPE';

      return {
        id: pair.pairAddress || pair.baseToken?.address || `pump-${pair.baseToken?.symbol || Date.now()}`,
        type: 'token_launch',
        sentiment,
        title: `${pair.baseToken?.symbol || '???'} on Pump.fun — MCap ${fmtUsd(mcap)}`,
        summary: `${pair.baseToken?.name || 'Unknown'} ($${pair.baseToken?.symbol || '???'}) trading on pump.fun. MCap: ${fmtUsd(mcap)}. 24h vol: ${fmtUsd(vol24h)}. Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(1)}%.`,
        from: pair.baseToken?.address?.slice(0, 12) || 'Pump.fun',
        to: 'Pump.fun',
        value: 0,
        valueUsd: mcap,
        chain: 'solana',
        trustScore,
        txHash: pair.baseToken?.address || '',
        blockNumber: 0,
        timestamp: new Date().toISOString(),
        tokenName: pair.baseToken?.name || 'Unknown',
        tokenSymbol: pair.baseToken?.symbol || '???',
        tokenMarketCap: mcap,
        platform: 'Pump.fun',
        tokenIcon: pair.info?.imageUrl || '',
      };
    });
  } catch (error) {

    return [];
  }
}

function getDexPlatformLabel(dexId: string): string {
  if (dexId.includes('pump') || dexId.includes('pumpswap')) return 'Pump.fun';
  if (dexId.includes('raydium')) return 'Raydium';
  if (dexId.includes('meteora')) return 'Meteora';
  if (dexId.includes('jupiter')) return 'Jupiter';
  if (dexId.includes('orca')) return 'Orca';
  if (dexId.includes('uniswap')) return 'Uniswap';
  if (dexId.includes('pancakeswap')) return 'PancakeSwap';
  if (dexId.includes('fourmeme') || dexId.includes('four.meme') || dexId.includes('four_meme')) return 'FourMeme';
  if (dexId.includes('quickswap')) return 'QuickSwap';
  if (dexId.includes('sushiswap')) return 'SushiSwap';
  if (dexId.includes('traderjoe') || dexId.includes('joe')) return 'TraderJoe';
  if (dexId.includes('pangolin')) return 'Pangolin';
  return dexId;
}

function generateEventTitle(name: string, symbol: string, priceChange: number, vol24h: number, platformLabel: string, pairCreatedAt?: number): string {
  if (pairCreatedAt && Date.now() - pairCreatedAt < 3600000) {
    return `New pair: ${name} ($${symbol}) just launched on ${platformLabel}`;
  }
  if (priceChange > 20) {
    return `${name} surging +${priceChange.toFixed(1)}% on ${platformLabel}`;
  }
  if (priceChange < -20) {
    return `${name} dropping ${priceChange.toFixed(1)}% on ${platformLabel}`;
  }
  if (vol24h > 1000000) {
    return `${name} high volume (${fmtUsd(vol24h)}) on ${platformLabel}`;
  }
  return `${name} ($${symbol}) trending on ${platformLabel}`;
}

function mapDexPairToEvent(pair: any, source: string): WhaleEvent | null {
  try {
    const chainId = pair.chainId || 'unknown';
    const name = pair.baseToken?.name || 'Unknown';
    const symbol = pair.baseToken?.symbol || '???';
    const priceUsd = pair.priceUsd || '0';
    const vol24h = pair.volume?.h24 || 0;
    const liq = pair.liquidity?.usd || 0;
    const mcap = pair.marketCap || pair.fdv || 0;
    const priceChange = pair.priceChange?.h24 || 0;
    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;
    const pairAddress = pair.pairAddress || '';
    const dexId = pair.dexId || '';
    const dexUrl = pair.url || '';
    const tokenAddress = pair.baseToken?.address || '';
    const pairCreatedAt = pair.pairCreatedAt || undefined;

    if (vol24h < 100 && liq < 100) return null;

    const platformLabel = getDexPlatformLabel(dexId);

    let sentiment = 'HYPE';
    if (priceChange > 10) sentiment = 'BULLISH';
    if (priceChange < -15) sentiment = 'BEARISH';
    if (vol24h > 500000) sentiment = 'BULLISH';
    const trustScore = Math.min(90, Math.max(25, 40 + (liq > 50000 ? 15 : liq > 10000 ? 10 : 0) + (vol24h > 100000 ? 15 : vol24h > 10000 ? 10 : 0)));

    const title = generateEventTitle(name, symbol, priceChange, vol24h, platformLabel, pairCreatedAt);

    const summaryParts: string[] = [];
    summaryParts.push(`$${symbol} on ${platformLabel}`);
    if (vol24h > 0) summaryParts.push(`Vol: ${fmtUsd(vol24h)}`);
    if (liq > 0) summaryParts.push(`Liq: ${fmtUsd(liq)}`);
    if (mcap > 0) summaryParts.push(`MCap: ${fmtUsd(mcap)}`);
    if (buys + sells > 10) summaryParts.push(`${buys}B/${sells}S`);
    if (priceChange !== 0) summaryParts.push(`${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}% 24h`);

    let chain = chainId;
    if (chainId === 'bsc') chain = 'bsc';
    else if (chainId === 'ethereum') chain = 'ethereum';
    else if (chainId === 'solana') chain = 'solana';
    else if (chainId === 'polygon') chain = 'polygon';
    else if (chainId === 'avalanche') chain = 'avalanche';

    return {
      id: `${source}-${chain}-${symbol}-${tokenAddress?.slice(0, 10) || pairAddress?.slice(0, 10)}`,
      type: 'trending',
      sentiment,
      title,
      summary: summaryParts.join(' · '),
      from: source,
      to: tokenAddress?.slice(0, 12) || 'Unknown',
      value: 0,
      valueUsd: mcap || vol24h,
      chain,
      trustScore,
      txHash: tokenAddress || pairAddress || '',
      blockNumber: 0,
      timestamp: recentTimestamp(),
      tokenName: name,
      tokenSymbol: symbol,
      tokenPrice: fmtPrice(priceUsd),
      tokenVolume24h: vol24h,
      tokenLiquidity: liq,
      tokenMarketCap: mcap,
      tokenPriceChange24h: priceChange,
      pairAddress,
      dexUrl,
      tokenIcon: pair.info?.imageUrl || '',
      platform: platformLabel,
      buys24h: buys,
      sells24h: sells,
    };
  } catch {
    return null;
  }
}

async function fetchDexScreenerTrending(): Promise<WhaleEvent[]> {
  try {
    const boostsRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    if (!boostsRes.ok) return [];
    const boostsData = await boostsRes.json();
    if (!Array.isArray(boostsData)) return [];

    const topTokens = boostsData.slice(0, 40);

    const pairResults = await Promise.allSettled(
      topTokens.map((t: any) =>
        fetch(`https://api.dexscreener.com/latest/dex/search?q=${t.tokenAddress}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    const events: WhaleEvent[] = [];
    for (let i = 0; i < topTokens.length; i++) {
      const pairResult = pairResults[i];
      const pairData = pairResult.status === 'fulfilled' ? pairResult.value : null;
      const pair = pairData?.pairs?.[0];
      if (!pair) continue;

      const event = mapDexPairToEvent(pair, 'DexScreener');
      if (event) events.push(event);
    }

    return events;
  } catch (error) {

    return [];
  }
}

async function fetchDexScreenerProfiles(chainId: string, count: number = 15): Promise<WhaleEvent[]> {
  try {
    const profilesRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
    if (!profilesRes.ok) return [];
    const profiles = await profilesRes.json();
    if (!Array.isArray(profiles)) return [];

    const chainTokens = profiles.filter((p: any) => p.chainId === chainId).slice(0, count);
    if (chainTokens.length === 0) return [];

    const pairResults = await Promise.allSettled(
      chainTokens.map((t: any) =>
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    const events: WhaleEvent[] = [];
    for (let i = 0; i < chainTokens.length; i++) {
      const pairResult = pairResults[i];
      const pairData = pairResult.status === 'fulfilled' ? pairResult.value : null;
      const pairs = pairData?.pairs;
      if (!pairs || pairs.length === 0) continue;

      const bestPair = pairs.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
      const event = mapDexPairToEvent(bestPair, 'DexScreener-Profiles');
      if (event) events.push(event);
    }

    return events;
  } catch (error) {

    return [];
  }
}

async function fetchDexSearchPairs(query: string, chainFilter: string, count: number = 5): Promise<WhaleEvent[]> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const pairs = data?.pairs || [];

    const filtered = pairs
      .filter((p: any) => chainFilter === 'all' || p.chainId === chainFilter)
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, count);

    const events: WhaleEvent[] = [];
    for (const pair of filtered) {
      const event = mapDexPairToEvent(pair, `DexSearch-${query}`);
      if (event) events.push(event);
    }
    return events;
  } catch {
    return [];
  }
}

async function fetchEthereumDexEvents(): Promise<WhaleEvent[]> {
  const ethTokens = ['PEPE', 'SHIB', 'LINK', 'UNI', 'AAVE', 'DOGE', 'MATIC', 'ARB', 'OP', 'MKR', 'LDO', 'CRV', 'COMP', 'SNX', 'ENS'];
  const searches = ethTokens.slice(0, 8).map(t => fetchDexSearchPairs(t, 'ethereum', 2));
  const results = await Promise.all([
    ...searches,
    fetchDexScreenerProfiles('ethereum', 15),
  ]);
  return results.flat();
}

async function fetchSolanaDexEvents(): Promise<WhaleEvent[]> {
  const [raydiumEvents, meteoraEvents, jupiterEvents, orcaEvents, profileEvents] = await Promise.all([
    fetchDexSearchPairs('raydium', 'solana', 5),
    fetchDexSearchPairs('meteora', 'solana', 5),
    fetchDexSearchPairs('jupiter', 'solana', 5),
    fetchDexSearchPairs('orca', 'solana', 5),
    fetchDexScreenerProfiles('solana', 15),
  ]);
  return [...raydiumEvents, ...meteoraEvents, ...jupiterEvents, ...orcaEvents, ...profileEvents];
}

async function fetchBSCDexEvents(): Promise<WhaleEvent[]> {
  const [pancakeEvents, fourmemeEvents, fourmeme2Events, profileEvents] = await Promise.all([
    fetchDexSearchPairs('pancakeswap', 'bsc', 8),
    fetchDexSearchPairs('fourmeme', 'bsc', 8),
    fetchDexSearchPairs('four.meme', 'bsc', 8),
    fetchDexScreenerProfiles('bsc', 15),
  ]);
  return [...pancakeEvents, ...fourmemeEvents, ...fourmeme2Events, ...profileEvents];
}

async function fetchAvalancheDexEvents(): Promise<WhaleEvent[]> {
  const avaxTokens = ['AVAX', 'JOE', 'WAVAX', 'GMX', 'sAVAX'];
  const searches = avaxTokens.map(t => fetchDexSearchPairs(t, 'avalanche', 3));
  const results = await Promise.all([
    ...searches,
    fetchDexScreenerProfiles('avalanche', 15),
  ]);
  return results.flat();
}

async function fetchPolygonDexEvents(): Promise<WhaleEvent[]> {
  const polyTokens = ['MATIC', 'QUICK', 'AAVE', 'SUSHI', 'WETH'];
  const searches = polyTokens.map(t => fetchDexSearchPairs(t, 'polygon', 3));
  const results = await Promise.all([
    ...searches,
    fetchDexScreenerProfiles('polygon', 15),
  ]);
  return results.flat();
}

// FIX 5A.1 / Phase 7: Base / Arbitrum / Optimism coverage was missing — every event
// on those L2s got dropped, which is a big part of why the feed felt thin and pump.fun-heavy.
async function fetchBaseDexEvents(): Promise<WhaleEvent[]> {
  const tokens = ['ETH', 'AERO', 'BRETT', 'DEGEN', 'WETH', 'USDC', 'WELL'];
  const searches = tokens.map(t => fetchDexSearchPairs(t, 'base', 3));
  const results = await Promise.all([...searches, fetchDexScreenerProfiles('base', 15)]);
  return results.flat();
}

async function fetchArbitrumDexEvents(): Promise<WhaleEvent[]> {
  const tokens = ['ARB', 'GMX', 'MAGIC', 'GNS', 'PENDLE', 'WETH', 'USDC'];
  const searches = tokens.map(t => fetchDexSearchPairs(t, 'arbitrum', 3));
  const results = await Promise.all([...searches, fetchDexScreenerProfiles('arbitrum', 15)]);
  return results.flat();
}

async function fetchOptimismDexEvents(): Promise<WhaleEvent[]> {
  const tokens = ['OP', 'VELO', 'WELL', 'SNX', 'WETH', 'USDC'];
  const searches = tokens.map(t => fetchDexSearchPairs(t, 'optimism', 3));
  const results = await Promise.all([...searches, fetchDexScreenerProfiles('optimism', 15)]);
  return results.flat();
}

function eventScore(e: WhaleEvent): number {
  const tsMs = new Date(e.timestamp).getTime() || Date.now();
  const ageMin = Math.max(0, (Date.now() - tsMs) / 60000);
  // Newer is better — but only mildly. Quality dominates.
  const recency = Math.max(0, 120 - ageMin); // 0..120 points from last 2h
  const trust = e.trustScore || 0; // 0..100
  const usdScore = Math.min(50, Math.log10(Math.max(1, e.valueUsd || 0))); // ~0..50
  const pumpPenalty = (e.platform || '').toLowerCase().includes('pump') ? -40 : 0;
  const whaleBoost = e.type === 'whale_transfer' ? 20 : 0;
  return recency + trust + usdScore + pumpPenalty + whaleBoost;
}

function deduplicateEvents(events: WhaleEvent[]): WhaleEvent[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  return events.filter(e => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    const addr = e.pairAddress || e.txHash || '';
    const platform = e.platform || '';
    const key = `${platform}-${(e.tokenSymbol || '').toLowerCase()}-${e.chain}-${addr.slice(0, 10)}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '150');
    const limit = Math.min(Math.max(rawLimit, 1), 200);
    const chain = searchParams.get('chain') || 'all';
    const archived = searchParams.get('archived') === 'true';

    if (archived) {
      const archivedEvents = getArchivedEvents(chain);
      return NextResponse.json({
        events: archivedEvents.slice(0, limit),
        total: archivedEvents.length,
        timestamp: new Date().toISOString(),
        source: 'archive',
        chain,
        archived: true,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }

    const cached = responseCache[chain];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      storeEvents(cached.data);
      const liveEvents = getLiveEvents(chain);
      const personalCached = await buildPersonalContext(request);
      let cachedFiltered = applyContextFilter(liveEvents, { minMarketCap: 500_000, personal: personalCached });
      if (cachedFiltered.length < 5) {
        cachedFiltered = applyContextFilter(liveEvents, { minMarketCap: 0, personal: personalCached });
      }
      return NextResponse.json({
        events: cachedFiltered.slice(0, limit),
        total: cachedFiltered.length,
        timestamp: new Date().toISOString(),
        source: cached.sources.join('+'),
        chain,
        cached: true,
        hasArchive: getArchivedEvents(chain).length > 0,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
      });
    }

    await fetchPrices();

    let events: WhaleEvent[] = [];
    const sources: string[] = [];

    if (chain === 'all') {
      // FIX 5A.1 / Phase 7: added base/arbitrum/optimism branches — user-reported "only Solana /
      // pump.fun trash" was largely driven by these L2s having zero coverage.
      const SRC_TIMEOUT = 5000;
      const [alchemyEvents, solanaNetEvents, pumpEvents, dexTrending, ethDex, solDex, bscDex, polygonDex, avalancheDex, baseDex, arbDex, opDex] = await Promise.all([
        withSrcTimeout(fetchAlchemyTransfers(), SRC_TIMEOUT, 'alchemy'),
        withSrcTimeout(fetchSolanaNetworkActivity(), SRC_TIMEOUT, 'alchemy-solana'),
        withSrcTimeout(fetchPumpFunTokens(), SRC_TIMEOUT, 'pumpfun'),
        withSrcTimeout(fetchDexScreenerTrending(), SRC_TIMEOUT, 'dex-trending'),
        withSrcTimeout(fetchEthereumDexEvents(), SRC_TIMEOUT, 'dex-ethereum'),
        withSrcTimeout(fetchSolanaDexEvents(), SRC_TIMEOUT, 'dex-solana'),
        withSrcTimeout(fetchBSCDexEvents(), SRC_TIMEOUT, 'dex-bsc'),
        withSrcTimeout(fetchPolygonDexEvents(), SRC_TIMEOUT, 'dex-polygon'),
        withSrcTimeout(fetchAvalancheDexEvents(), SRC_TIMEOUT, 'dex-avalanche'),
        withSrcTimeout(fetchBaseDexEvents(), SRC_TIMEOUT, 'dex-base'),
        withSrcTimeout(fetchArbitrumDexEvents(), SRC_TIMEOUT, 'dex-arbitrum'),
        withSrcTimeout(fetchOptimismDexEvents(), SRC_TIMEOUT, 'dex-optimism'),
      ]);

      events = [...dexTrending, ...ethDex, ...solDex, ...bscDex, ...polygonDex, ...avalancheDex, ...baseDex, ...arbDex, ...opDex, ...pumpEvents, ...alchemyEvents, ...solanaNetEvents];
      if (alchemyEvents.length > 0) sources.push('alchemy');
      if (solanaNetEvents.length > 0) sources.push('alchemy-solana');
      if (pumpEvents.length > 0) sources.push('pumpfun');
      if (dexTrending.length > 0) sources.push('dexscreener');
      if (ethDex.length > 0) sources.push('dex-ethereum');
      if (solDex.length > 0) sources.push('dex-solana');
      if (bscDex.length > 0) sources.push('dex-bsc');
      if (polygonDex.length > 0) sources.push('dex-polygon');
      if (avalancheDex.length > 0) sources.push('dex-avalanche');
      if (baseDex.length > 0) sources.push('dex-base');
      if (arbDex.length > 0) sources.push('dex-arbitrum');
      if (opDex.length > 0) sources.push('dex-optimism');

    } else if (chain === 'base') {
      events = await withSrcTimeout(fetchBaseDexEvents(), 5000, 'dex-base');
      if (events.length > 0) sources.push('dexscreener');
    } else if (chain === 'arbitrum') {
      events = await withSrcTimeout(fetchArbitrumDexEvents(), 5000, 'dex-arbitrum');
      if (events.length > 0) sources.push('dexscreener');
    } else if (chain === 'optimism') {
      events = await withSrcTimeout(fetchOptimismDexEvents(), 5000, 'dex-optimism');
      if (events.length > 0) sources.push('dexscreener');
    } else if (chain === 'solana') {
      const [solanaNetEvents, pumpEvents, solDex] = await Promise.all([
        withSrcTimeout(fetchSolanaNetworkActivity(), 5000, 'alchemy-solana'),
        withSrcTimeout(fetchPumpFunTokens(), 5000, 'pumpfun'),
        withSrcTimeout(fetchSolanaDexEvents(), 5000, 'dex-solana'),
      ]);

      events = [...solDex, ...pumpEvents, ...solanaNetEvents];
      if (solanaNetEvents.length > 0) sources.push('alchemy-solana');
      if (pumpEvents.length > 0) sources.push('pumpfun');
      if (solDex.length > 0) sources.push('dexscreener');

    } else if (chain === 'ethereum') {
      const [alchemyEvents, ethDex] = await Promise.all([
        withSrcTimeout(fetchAlchemyTransfers(), 5000, 'alchemy'),
        withSrcTimeout(fetchEthereumDexEvents(), 5000, 'dex-ethereum'),
      ]);

      events = [...ethDex, ...alchemyEvents];
      if (alchemyEvents.length > 0) sources.push('alchemy');
      if (ethDex.length > 0) sources.push('dexscreener');

    } else if (chain === 'bsc') {
      const bscEvents = await withSrcTimeout(fetchBSCDexEvents(), 5000, 'dex-bsc');
      events = bscEvents;
      if (bscEvents.length > 0) sources.push('dexscreener');

    } else if (chain === 'polygon') {
      const polygonEvents = await withSrcTimeout(fetchPolygonDexEvents(), 5000, 'dex-polygon');
      events = polygonEvents;
      if (polygonEvents.length > 0) sources.push('dexscreener');

    } else if (chain === 'avalanche') {
      const avalancheEvents = await withSrcTimeout(fetchAvalancheDexEvents(), 5000, 'dex-avalanche');
      events = avalancheEvents;
      if (avalancheEvents.length > 0) sources.push('dexscreener');
    }

    // FIX 5A.1 / Phase 7: was pure-timestamp sort, which let low-quality pump.fun tokens
    // (always freshly timestamped) dominate the top of the feed. Now uses a composite score
    // of trust + USD value + recency, with a penalty for pump.fun and a boost for whale events.
    events.sort((a, b) => eventScore(b) - eventScore(a));

    events = deduplicateEvents(events);

    responseCache[chain] = { data: events, ts: Date.now(), sources };

    storeEvents(events);

    const liveEvents = getLiveEvents(chain);
    const personal = await buildPersonalContext(request);
    // Progressive relaxation: start with the $500K market-cap gate that
    // filters out junk pump.fun tokens. If that leaves the feed sparse
    // (<5 events) or empty, drop the gate so we never show users a blank
    // feed just because our live sources only returned microcaps that tick.
    let filtered = applyContextFilter(liveEvents, { minMarketCap: 500_000, personal });
    if (filtered.length < 5) {
      filtered = applyContextFilter(liveEvents, { minMarketCap: 0, personal });
    }

    return NextResponse.json({
      events: filtered.slice(0, limit),
      total: filtered.length,
      timestamp: new Date().toISOString(),
      source: sources.join('+'),
      chain,
      hasArchive: getArchivedEvents(chain).length > 0,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to fetch context feed' }, { status: 500 });
  }
}
