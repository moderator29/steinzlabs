import { NextRequest, NextResponse } from 'next/server';

const GOPLUS_API_KEY = '6qqc3yyg7Q7MA59r2QF0';
const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1/token_security';

// Map our chain identifiers to GoPlus chain IDs
const CHAIN_ID_MAP: Record<string, string> = {
  ethereum: '1',
  eth: '1',
  bsc: '56',
  binance: '56',
  solana: 'solana',
  sol: 'solana',
  base: '8453',
  arbitrum: '42161',
  polygon: '137',
  matic: '137',
  avalanche: '43114',
  avax: '43114',
};

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

function scoreToken(data: any): GoPlusResult['status'] {
  if (data.is_honeypot === '1') return 'BLOCKED';
  const buyTax = parseFloat(data.buy_tax ?? '0') * 100;
  const sellTax = parseFloat(data.sell_tax ?? '0') * 100;
  if (buyTax > 10 || sellTax > 10) return 'RISKY';
  const liqUsd = parseFloat(data.dex?.[0]?.liquidity ?? '0');
  if (liqUsd > 0 && liqUsd < 50000) return 'CAUTION';
  if (data.is_blacklisted === '1' || data.cannot_sell_all === '1') return 'RISKY';
  return 'SAFE';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, chain } = body as { address: string; chain: string };

    if (!address || !chain) {
      return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
    }

    const chainId = CHAIN_ID_MAP[chain.toLowerCase()] ?? chain;

    const url = `${GOPLUS_BASE}/${chainId}?contract_addresses=${address}`;
    const res = await fetch(url, {
      headers: {
        'X-API-KEY': GOPLUS_API_KEY,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      // GoPlus returned an error — return a neutral CAUTION result
      return NextResponse.json({
        address,
        chain,
        isHoneypot: false,
        buyTax: 0,
        sellTax: 0,
        liquidity: 0,
        isOpenSource: false,
        isMintable: false,
        hasBlacklist: false,
        holderCount: 0,
        top10HolderPercent: 0,
        status: 'CAUTION',
        flags: ['Security data unavailable'],
      } satisfies GoPlusResult);
    }

    const json = await res.json();
    const tokenData = json?.result?.[address.toLowerCase()] ?? json?.result?.[address] ?? null;

    if (!tokenData) {
      return NextResponse.json({
        address,
        chain,
        isHoneypot: false,
        buyTax: 0,
        sellTax: 0,
        liquidity: 0,
        isOpenSource: false,
        isMintable: false,
        hasBlacklist: false,
        holderCount: 0,
        top10HolderPercent: 0,
        status: 'CAUTION',
        flags: ['No security data found'],
      } satisfies GoPlusResult);
    }

    const buyTax = Math.round(parseFloat(tokenData.buy_tax ?? '0') * 100 * 10) / 10;
    const sellTax = Math.round(parseFloat(tokenData.sell_tax ?? '0') * 100 * 10) / 10;
    const liqUsd = parseFloat(tokenData.dex?.[0]?.liquidity ?? '0');
    const holderCount = parseInt(tokenData.holder_count ?? '0', 10);
    const top10 = parseFloat(tokenData.holders?.slice(0, 10).reduce((acc: number, h: any) => acc + parseFloat(h.percent ?? '0'), 0).toFixed(2) ?? '0');

    const flags: string[] = [];
    if (tokenData.is_honeypot === '1') flags.push('Honeypot');
    if (tokenData.is_mintable === '1') flags.push('Mintable');
    if (tokenData.cannot_sell_all === '1') flags.push('Cannot sell all');
    if (tokenData.is_blacklisted === '1') flags.push('Blacklist function');
    if (tokenData.has_trading_cooldown === '1') flags.push('Trading cooldown');
    if (buyTax > 10) flags.push(`High buy tax (${buyTax}%)`);
    if (sellTax > 10) flags.push(`High sell tax (${sellTax}%)`);

    const result: GoPlusResult = {
      address,
      chain,
      isHoneypot: tokenData.is_honeypot === '1',
      buyTax,
      sellTax,
      liquidity: liqUsd,
      isOpenSource: tokenData.is_open_source === '1',
      isMintable: tokenData.is_mintable === '1',
      hasBlacklist: tokenData.is_blacklisted === '1',
      holderCount,
      top10HolderPercent: top10,
      status: scoreToken(tokenData),
      flags,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[sniper/security]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
