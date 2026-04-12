import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenPairs } from '@/lib/services/dexscreener';
import { getTokenSecurity } from '@/lib/services/goplus';
import type { DexPair } from '@/lib/services/dexscreener';
import type { TokenSecurityResult } from '@/lib/services/goplus';

const CHAIN_MAP: Record<string, string> = {
  ETH: 'ethereum', ethereum: 'ethereum', BSC: 'bsc', bsc: 'bsc',
  BASE: 'base', base: 'base', ARB: 'arbitrum', arb: 'arbitrum',
  POLY: 'polygon', poly: 'polygon', SOL: 'solana', sol: 'solana',
};

function buildTokenData(pairs: DexPair[], address: string) {
  if (pairs.length === 0) return null;
  const top = pairs[0];
  return {
    name: top.baseToken?.name || 'Unknown',
    symbol: top.baseToken?.symbol || '???',
    address: top.baseToken?.address || address,
    price: parseFloat(top.priceUsd || '0'),
    priceChange5m: top.priceChange?.m5 || 0,
    priceChange1h: top.priceChange?.h1 || 0,
    priceChange6h: top.priceChange?.h6 || 0,
    priceChange24h: top.priceChange?.h24 || 0,
    volume24h: top.volume?.h24 || 0,
    volume6h: top.volume?.h6 || 0,
    volume1h: top.volume?.h1 || 0,
    liquidity: top.liquidity?.usd || 0,
    liquidityBase: top.liquidity?.base || 0,
    liquidityQuote: top.liquidity?.quote || 0,
    fdv: top.fdv || 0,
    marketCap: top.fdv || 0,
    pairAddress: top.pairAddress,
    dexId: top.dexId,
    chain: top.chainId,
    url: top.url,
    image: top.info?.imageUrl || null,
    websites: top.info?.websites || [],
    socials: [],
    txns24h: top.txns?.h24 || { buys: 0, sells: 0 },
    txns6h: top.txns?.h6 || { buys: 0, sells: 0 },
    txns1h: top.txns?.h1 || { buys: 0, sells: 0 },
    createdAt: top.pairCreatedAt,
  };
}

function buildSecurity(sec: TokenSecurityResult) {
  const raw = sec.raw as Record<string, unknown>;
  type RawHolder = { address?: string; percent?: string; is_contract?: number; is_locked?: number };
  return {
    isHoneypot: sec.isHoneypot,
    buyTax: sec.buyTax * 100,
    sellTax: sec.sellTax * 100,
    isOpenSource: sec.isOpenSource,
    isProxy: sec.isProxy,
    isMintable: sec.isMintable,
    ownershipRenounced: !sec.canTakeBackOwnership,
    hasBlacklist: raw.is_blacklisted === '1',
    holderCount: sec.holderCount,
    lpHolderCount: parseInt(String(raw.lp_holder_count || '0')),
    totalSupply: raw.total_supply,
    creatorAddress: sec.creatorAddress,
    ownerAddress: sec.ownerAddress,
    topHolders: ((raw.holders as RawHolder[]) || []).slice(0, 10).map(h => ({
      address: h.address,
      percent: (parseFloat(h.percent || '0') * 100).toFixed(2),
      isContract: h.is_contract === 1,
      isLocked: h.is_locked === 1,
    })),
    lpHolders: (sec.lpHolders as RawHolder[]).slice(0, 5).map(h => ({
      address: h.address,
      percent: (parseFloat(h.percent || '0') * 100).toFixed(2),
      isLocked: h.is_locked === 1,
    })),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const chain = searchParams.get('chain') || 'ethereum';

  if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

  const normalizedChain = CHAIN_MAP[chain] || 'ethereum';
  const isSolana = normalizedChain === 'solana';

  try {
    const [pairsResult, secResult] = await Promise.allSettled([
      getTokenPairs(address),
      isSolana ? Promise.resolve(null) : getTokenSecurity(address, normalizedChain),
    ]);

    const pairs = pairsResult.status === 'fulfilled' ? (pairsResult.value ?? []).slice(0, 10) : [];
    const tokenData = buildTokenData(pairs, address);
    const security = (!isSolana && secResult.status === 'fulfilled' && secResult.value)
      ? buildSecurity(secResult.value)
      : null;

    if (!tokenData && !security) {
      return NextResponse.json({ error: 'Token not found', address }, { status: 404 });
    }

    return NextResponse.json({
      token: tokenData,
      security,
      pairs: pairs.map(p => ({
        dex: p.dexId,
        pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
        price: p.priceUsd,
        liquidity: p.liquidity?.usd,
        volume24h: p.volume?.h24,
        chain: p.chainId,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Lookup failed', message: (e as Error).message }, { status: 500 });
  }
}
