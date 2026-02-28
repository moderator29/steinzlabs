import { NextResponse } from 'next/server';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const COINGECKO_KEY = process.env.COINGECKO_API_KEY;
const HELIUS_KEY = process.env.HELIUS_KEY_1;

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

async function fetchEthPrice(): Promise<number> {
  try {
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana&vs_currencies=usd', { headers });
    const data = await res.json();
    return data?.ethereum?.usd || 3500;
  } catch { return 3500; }
}

async function fetchSolPrice(): Promise<number> {
  try {
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { headers });
    const data = await res.json();
    return data?.solana?.usd || 180;
  } catch { return 180; }
}

async function fetchAlchemyTransfers(): Promise<WhaleEvent[]> {
  if (!ALCHEMY_KEY) return [];
  try {
    const ethPrice = await fetchEthPrice();
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
        params: [{ fromBlock: `0x${(latestBlock - 20).toString(16)}`, toBlock: 'latest', category: ['external'], order: 'desc', maxCount: '0x14', withMetadata: true }]
      }),
    });
    const txData = await txRes.json();
    const transfers = txData.result?.transfers || [];
    const whaleTransfers = transfers.filter((tx: any) => (tx.value || 0) >= 10).slice(0, 6);

    return whaleTransfers.map((tx: any, i: number) => {
      const valueEth = tx.value || 0;
      const valueUsd = valueEth * ethPrice;
      const fmtValue = valueUsd >= 1000000 ? `$${(valueUsd / 1000000).toFixed(1)}M` : `$${(valueUsd / 1000).toFixed(0)}K`;
      let sentiment = 'BULLISH';
      let trustScore = 65 + Math.floor(Math.random() * 25);

      if (i % 4 === 2) sentiment = 'BEARISH';
      if (i % 4 === 3) sentiment = 'HYPE';

      return {
        id: tx.hash || `eth-${i}`,
        type: 'whale_transfer',
        sentiment,
        title: `ETH whale moved ${valueEth.toFixed(1)} ETH (${fmtValue})`,
        summary: `${valueEth.toFixed(2)} ETH transferred on Ethereum. Volume: ${fmtValue}. Whale wallet activity detected.`,
        from: tx.from || '0x0000',
        to: tx.to || '0x0000',
        value: valueEth,
        valueUsd: Math.round(valueUsd),
        chain: 'ethereum',
        trustScore,
        txHash: tx.hash || '',
        blockNumber: parseInt(tx.blockNum, 16) || 0,
        timestamp: tx.metadata?.blockTimestamp || new Date().toISOString(),
        tokenName: 'Ethereum',
        tokenSymbol: 'ETH',
        tokenPrice: `$${ethPrice.toFixed(2)}`,
        platform: 'Ethereum Mainnet',
      };
    });
  } catch (error) {
    console.error('Alchemy fetch error:', error);
    return [];
  }
}

async function fetchHeliusTransactions(): Promise<WhaleEvent[]> {
  if (!HELIUS_KEY) return [];
  try {
    const solPrice = await fetchSolPrice();
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
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
        id: `sol-perf-${slot}-${Date.now()}`,
        type: 'network_activity',
        sentiment: txCount > 3000 ? 'BULLISH' : 'HYPE',
        title: `Solana: ${txCount.toLocaleString()} txns processed`,
        summary: `${txCount.toLocaleString()} transactions at slot ${slot.toLocaleString()}. SOL: $${solPrice.toFixed(2)}.`,
        from: 'Solana Network',
        to: 'Validators',
        value: txCount,
        valueUsd: Math.round(txCount * 0.01 * solPrice),
        chain: 'solana',
        trustScore: 80 + Math.floor(Math.random() * 15),
        txHash: `slot-${slot}`,
        blockNumber: slot,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        tokenName: 'Solana',
        tokenSymbol: 'SOL',
        tokenPrice: `$${solPrice.toFixed(2)}`,
        platform: 'Solana Mainnet',
      };
    });
  } catch (error) {
    console.error('Helius fetch error:', error);
    return [];
  }
}

async function fetchPumpFunTokens(): Promise<WhaleEvent[]> {
  try {
    const res = await fetch(
      'https://client-api-2-74b1891ee9f9.herokuapp.com/coins?offset=0&limit=10&sort=last_trade_timestamp&order=DESC&includeNsfw=false',
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.slice(0, 5).map((token: any) => {
      const mcap = token.usd_market_cap || 0;
      const replyCount = token.reply_count || 0;
      const trustScore = Math.min(90, Math.max(20, replyCount * 3 + 25));
      let sentiment = 'HYPE';
      if (mcap > 100000) sentiment = 'BULLISH';
      if (mcap < 5000 && replyCount < 3) sentiment = 'BEARISH';

      const fmtMcap = mcap >= 1000000 ? `$${(mcap / 1000000).toFixed(1)}M` : mcap >= 1000 ? `$${(mcap / 1000).toFixed(1)}K` : `$${mcap.toFixed(0)}`;

      return {
        id: token.mint || `pump-${Date.now()}-${Math.random()}`,
        type: 'token_launch',
        sentiment,
        title: `${token.symbol || '???'} live on Pump.fun — MCap ${fmtMcap}`,
        summary: `${token.name || 'Unknown'} ($${token.symbol || '???'}) is live on Pump.fun. Market cap: ${fmtMcap}. ${replyCount} replies.`,
        from: (token.creator || '').slice(0, 12) || 'PumpFun',
        to: 'Pump.fun',
        value: 0,
        valueUsd: mcap,
        chain: 'solana',
        trustScore,
        txHash: token.mint || '',
        blockNumber: 0,
        timestamp: token.created_timestamp ? new Date(token.created_timestamp).toISOString() : new Date().toISOString(),
        tokenName: token.name || 'Unknown',
        tokenSymbol: token.symbol || '???',
        tokenMarketCap: mcap,
        platform: 'Pump.fun',
        tokenIcon: token.image_uri || '',
      };
    });
  } catch (error) {
    console.error('Pump.fun fetch error:', error);
    return [];
  }
}

async function fetchDexScreenerTrending(): Promise<WhaleEvent[]> {
  try {
    const boostsRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    if (!boostsRes.ok) return [];
    const boostsData = await boostsRes.json();
    if (!Array.isArray(boostsData)) return [];

    const topTokens = boostsData.slice(0, 8);

    const pairResults = await Promise.allSettled(
      topTokens.map((t: any) =>
        fetch(`https://api.dexscreener.com/latest/dex/search?q=${t.tokenAddress}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    const events: WhaleEvent[] = [];
    for (let i = 0; i < topTokens.length; i++) {
      const token = topTokens[i];
      const pairResult = pairResults[i];
      const pairData = pairResult.status === 'fulfilled' ? pairResult.value : null;
      const pair = pairData?.pairs?.[0];

      const boosts = token.totalAmount || token.amount || 0;
      const chainId = pair?.chainId || token.chainId || 'unknown';
      const name = pair?.baseToken?.name || token.tokenAddress?.slice(0, 8) + '...' || 'Unknown';
      const symbol = pair?.baseToken?.symbol || '???';
      const priceUsd = pair?.priceUsd || '0';
      const vol24h = pair?.volume?.h24 || 0;
      const liq = pair?.liquidity?.usd || 0;
      const mcap = pair?.marketCap || 0;
      const priceChange = pair?.priceChange?.h24 || 0;
      const buys = pair?.txns?.h24?.buys || 0;
      const sells = pair?.txns?.h24?.sells || 0;
      const pairAddress = pair?.pairAddress || '';
      const dexUrl = pair?.url || `https://dexscreener.com/${chainId}/${token.tokenAddress}`;
      const dexId = pair?.dexId || '';

      const fmtVol = vol24h >= 1000000 ? `$${(vol24h / 1000000).toFixed(1)}M` : vol24h >= 1000 ? `$${(vol24h / 1000).toFixed(0)}K` : `$${vol24h.toFixed(0)}`;
      const fmtLiq = liq >= 1000000 ? `$${(liq / 1000000).toFixed(1)}M` : liq >= 1000 ? `$${(liq / 1000).toFixed(0)}K` : `$${liq.toFixed(0)}`;
      const fmtMcap = mcap >= 1000000 ? `$${(mcap / 1000000).toFixed(1)}M` : mcap >= 1000 ? `$${(mcap / 1000).toFixed(0)}K` : mcap > 0 ? `$${mcap.toFixed(0)}` : '';

      let sentiment = 'HYPE';
      if (priceChange > 10) sentiment = 'BULLISH';
      if (priceChange < -15) sentiment = 'BEARISH';
      if (vol24h > 500000) sentiment = 'BULLISH';
      const trustScore = Math.min(90, Math.max(25, 40 + Math.min(boosts, 30) + (liq > 50000 ? 15 : 0)));

      let platformLabel = chainId;
      if (dexId.includes('pump') || dexId.includes('pumpswap')) platformLabel = 'Pump.fun';
      else if (dexId.includes('raydium')) platformLabel = 'Raydium';
      else if (dexId.includes('uniswap')) platformLabel = 'Uniswap';
      else if (dexId.includes('pancakeswap')) platformLabel = 'PancakeSwap';

      const summaryParts: string[] = [];
      summaryParts.push(`$${symbol} on ${platformLabel}`);
      if (vol24h > 0) summaryParts.push(`Vol: ${fmtVol}`);
      if (liq > 0) summaryParts.push(`Liq: ${fmtLiq}`);
      if (fmtMcap) summaryParts.push(`MCap: ${fmtMcap}`);
      if (buys + sells > 100) summaryParts.push(`${buys}B/${sells}S`);
      if (priceChange !== 0) summaryParts.push(`${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}% 24h`);

      events.push({
        id: `dex-${token.tokenAddress?.slice(0, 16) || i}-${Date.now()}`,
        type: 'trending',
        sentiment,
        title: `${name} ($${symbol}) trending on ${platformLabel}`,
        summary: summaryParts.join(' · '),
        from: 'DexScreener',
        to: token.tokenAddress?.slice(0, 12) || 'Unknown',
        value: boosts,
        valueUsd: mcap || vol24h,
        chain: chainId,
        trustScore,
        txHash: token.tokenAddress || '',
        blockNumber: 0,
        timestamp: new Date().toISOString(),
        tokenName: name,
        tokenSymbol: symbol,
        tokenPrice: priceUsd !== '0' ? `$${parseFloat(priceUsd) < 0.01 ? parseFloat(priceUsd).toFixed(6) : parseFloat(priceUsd).toFixed(4)}` : undefined,
        tokenVolume24h: vol24h,
        tokenLiquidity: liq,
        tokenMarketCap: mcap,
        tokenPriceChange24h: priceChange,
        pairAddress,
        dexUrl,
        tokenIcon: token.icon || '',
        platform: platformLabel,
        buys24h: buys,
        sells24h: sells,
      });
    }

    return events;
  } catch (error) {
    console.error('DexScreener fetch error:', error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const [alchemyEvents, heliusEvents, pumpEvents, dexEvents] = await Promise.all([
      fetchAlchemyTransfers(),
      fetchHeliusTransactions(),
      fetchPumpFunTokens(),
      fetchDexScreenerTrending(),
    ]);

    let events: WhaleEvent[] = [...dexEvents, ...pumpEvents, ...alchemyEvents, ...heliusEvents];
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const sources: string[] = [];
    if (alchemyEvents.length > 0) sources.push('alchemy');
    if (heliusEvents.length > 0) sources.push('helius');
    if (pumpEvents.length > 0) sources.push('pumpfun');
    if (dexEvents.length > 0) sources.push('dexscreener');

    return NextResponse.json({
      events: events.slice(0, limit),
      total: events.length,
      timestamp: new Date().toISOString(),
      source: sources.join('+'),
      counts: { alchemy: alchemyEvents.length, helius: heliusEvents.length, pumpfun: pumpEvents.length, dexscreener: dexEvents.length },
    });
  } catch (error) {
    console.error('Context feed error:', error);
    return NextResponse.json({ error: 'Failed to fetch context feed' }, { status: 500 });
  }
}
