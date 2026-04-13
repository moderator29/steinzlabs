import 'server-only';
import { NextResponse } from 'next/server';
import { getTopTokens } from '@/lib/services/coingecko';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

interface WhaleEvent {
  type: string;
  whale: string;
  whaleShort: string;
  token: string;
  amount: string;
  amountRaw: number;
  time: string;
  chain: string;
  label: string;
  txHash?: string;
  blockNum?: string;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: string | number): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function labelFromAddress(from: string, to: string): string {
  const known: Record<string, string> = {
    '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance',
    '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance',
    '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': 'Binance',
    '0x974caa59e49682cda0ad2bbe82983419a2ecc400': 'Coinbase',
    '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
    '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase',
    '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase',
    '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2': 'FTX Estate',
    '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance',
    '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503': 'Binance',
  };
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();
  if (known[fromLower]) return known[fromLower];
  if (known[toLower]) return known[toLower];
  return 'Whale';
}

async function getAlchemyTransfers(): Promise<WhaleEvent[]> {
  if (!ALCHEMY_KEY) return [];

  try {
    const blockRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    const blockData = await blockRes.json();
    const latestBlock = parseInt(blockData.result, 16);
    const fromBlock = '0x' + (latestBlock - 50).toString(16);

    const transferRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock,
          toBlock: 'latest',
          category: ['external'],
          order: 'desc',
          maxCount: '0x64',
          withMetadata: true,
        }],
      }),
    });
    const transferData = await transferRes.json();
    const transfers = transferData.result?.transfers || [];

    const whaleTransfers = transfers.filter((tx: any) => {
      const value = tx.value || 0;
      return value >= 100;
    });

    return whaleTransfers.slice(0, 20).map((tx: any) => {
      const value = tx.value || 0;
      const formattedAmount = value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(1);
      const label = labelFromAddress(tx.from, tx.to);
      const isExchangeFrom = ['Binance', 'Coinbase', 'FTX Estate'].includes(label) && tx.from.toLowerCase() !== tx.to.toLowerCase();

      let type = 'transfer';
      if (isExchangeFrom && label === labelFromAddress(tx.from, '')) {
        type = 'sell';
      } else if (isExchangeFrom) {
        type = 'buy';
      }

      return {
        type,
        whale: tx.from,
        whaleShort: shortenAddress(tx.from),
        token: tx.asset || 'ETH',
        amount: `$${formattedAmount}`,
        amountRaw: value,
        time: tx.metadata?.blockTimestamp ? timeAgo(tx.metadata.blockTimestamp) : 'recent',
        chain: 'Ethereum',
        label,
        txHash: tx.hash,
        blockNum: tx.blockNum,
      };
    });
  } catch (err) {

    return [];
  }
}

async function getCoinGeckoWhaleActivity(): Promise<WhaleEvent[]> {
  try {
    const coins = await getTopTokens(1, 10);
    return coins
      .filter(c => Math.abs(c.price_change_percentage_24h || 0) > 5)
      .slice(0, 5)
      .map(coin => {
        const isBuy = coin.price_change_percentage_24h > 0;
        const vol = coin.total_volume || 0;
        const volStr = vol >= 1e9 ? `${(vol / 1e9).toFixed(1)}B` : vol >= 1e6 ? `${(vol / 1e6).toFixed(1)}M` : `${(vol / 1e3).toFixed(0)}K`;
        return {
          type: isBuy ? 'buy' : 'sell',
          whale: 'market',
          whaleShort: 'Market Activity',
          token: coin.symbol?.toUpperCase() || '???',
          amount: `$${volStr}`,
          amountRaw: vol,
          time: 'recent',
          chain: 'Multi-chain',
          label: `${coin.name} ${isBuy ? '+' : '-'}${Math.abs(coin.price_change_percentage_24h).toFixed(1)}%`,
          txHash: undefined,
          blockNum: undefined,
        };
      });
  } catch { return []; }
}

export async function GET() {
  try {
    const [alchemyEvents, geckoEvents] = await Promise.all([
      getAlchemyTransfers(),
      getCoinGeckoWhaleActivity(),
    ]);

    const allEvents = [...alchemyEvents, ...geckoEvents];

    allEvents.sort((a, b) => {
      const parseTime = (t: string) => {
        const match = t.match(/(\d+)(s|m|h|d)/);
        if (!match) return 0;
        const val = parseInt(match[1]);
        const unit = match[2];
        if (unit === 's') return val;
        if (unit === 'm') return val * 60;
        if (unit === 'h') return val * 3600;
        if (unit === 'd') return val * 86400;
        return 0;
      };
      return parseTime(a.time) - parseTime(b.time);
    });

    return NextResponse.json({ events: allEvents, timestamp: Date.now() }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {

    return NextResponse.json({ events: [], timestamp: Date.now(), error: 'Failed to fetch whale data' }, { status: 500 });
  }
}
