import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GeckoTerminal network IDs for each supported chain
const GECKO_NETWORK: Record<string, string> = {
  solana:    'solana',
  ethereum:  'eth',
  bsc:       'bsc',
  polygon:   'polygon_pos',
  avalanche: 'avax',
  base:      'base',
  tron:      'tron',
  ton:       'ton',
};

// Timeframe → GeckoTerminal params mapping
const TF_PARAMS: Record<string, { timeframe: string; aggregate: number; limit: number }> = {
  '1H':  { timeframe: 'minute', aggregate: 1,  limit: 60  },
  '6H':  { timeframe: 'minute', aggregate: 5,  limit: 72  },
  '1D':  { timeframe: 'hour',   aggregate: 1,  limit: 24  },
  '1W':  { timeframe: 'hour',   aggregate: 4,  limit: 42  },
  '1M':  { timeframe: 'day',    aggregate: 1,  limit: 30  },
  '1Y':  { timeframe: 'day',    aggregate: 7,  limit: 52  },
  'ALL': { timeframe: 'day',    aggregate: 7,  limit: 500 },
};

export interface OhlcvCandle {
  time:   number; // Unix seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

function fetchWithTimeout(url: string, opts: RequestInit & { next?: any } = {}, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const chain = (searchParams.get('chain') ?? 'solana').toLowerCase();
  const pair  = searchParams.get('pair')  ?? '';
  const tf    = searchParams.get('tf')    ?? '1D';

  if (!pair) {
    return NextResponse.json({ error: 'pair is required' }, { status: 400 });
  }

  const network = GECKO_NETWORK[chain] ?? chain;
  const params  = TF_PARAMS[tf] ?? TF_PARAMS['1D'];

  try {
    const url =
      `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pair}/ohlcv/${params.timeframe}` +
      `?aggregate=${params.aggregate}&limit=${params.limit}&currency=usd&token=base`;

    const res = await fetchWithTimeout(url, {
      headers: { 'Accept': 'application/json;version=20230302' },
      next: { revalidate: 30 },
    }, 5000);

    if (!res.ok) {
      throw new Error(`GeckoTerminal ${res.status}`);
    }

    const json = await res.json();
    const raw: number[][] = json?.data?.attributes?.ohlcv_list ?? [];

    if (raw.length === 0) {
      return NextResponse.json({ candles: [] });
    }

    // GeckoTerminal returns newest-first — reverse for chronological order
    const candles: OhlcvCandle[] = raw
      .reverse()
      .map(([ts, o, h, l, c, v]) => ({
        time:   ts,
        open:   o,
        high:   h,
        low:    l,
        close:  c,
        volume: v,
      }));

    return NextResponse.json({ candles });
  } catch (err: any) {
    return NextResponse.json({ candles: [], error: err?.message }, { status: 200 });
  }
}
