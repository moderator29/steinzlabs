import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const chain = searchParams.get('chain') || 'ethereum';

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  const chainMap: Record<string, string> = {
    ETH: '1', ethereum: '1', BSC: '56', bsc: '56', BASE: '8453', base: '8453',
    ARB: '42161', arb: '42161', POLY: '137', poly: '137', SOL: 'solana', sol: 'solana',
  };
  const goplusChainId = chainMap[chain] || '1';

  try {
    const [dexRes, secRes] = await Promise.allSettled([
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { signal: AbortSignal.timeout(8000) }),
      goplusChainId !== 'solana'
        ? fetch(`https://api.gopluslabs.io/api/v1/token_security/${goplusChainId}?contract_addresses=${address}`, { signal: AbortSignal.timeout(8000) })
        : Promise.resolve(null),
    ]);

    let tokenData: any = null;
    let pairs: any[] = [];
    if (dexRes.status === 'fulfilled' && dexRes.value && 'ok' in dexRes.value && dexRes.value.ok) {
      const data = await dexRes.value.json();
      pairs = (data.pairs || []).slice(0, 10);
      if (pairs.length > 0) {
        const top = pairs[0];
        tokenData = {
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
          marketCap: top.marketCap || top.fdv || 0,
          pairAddress: top.pairAddress,
          dexId: top.dexId,
          chain: top.chainId,
          url: top.url,
          image: top.info?.imageUrl || null,
          websites: top.info?.websites || [],
          socials: top.info?.socials || [],
          txns24h: top.txns?.h24 || { buys: 0, sells: 0 },
          txns6h: top.txns?.h6 || { buys: 0, sells: 0 },
          txns1h: top.txns?.h1 || { buys: 0, sells: 0 },
          createdAt: top.pairCreatedAt,
        };
      }
    }

    let security: any = null;
    if (secRes.status === 'fulfilled' && secRes.value && 'ok' in secRes.value) {
      const secData = await secRes.value.json();
      const addrLower = address.toLowerCase();
      const info = secData?.result?.[addrLower];
      if (info) {
        security = {
          isHoneypot: info.is_honeypot === '1',
          buyTax: parseFloat(info.buy_tax || '0') * 100,
          sellTax: parseFloat(info.sell_tax || '0') * 100,
          isOpenSource: info.is_open_source === '1',
          isProxy: info.is_proxy === '1',
          isMintable: info.is_mintable === '1',
          ownershipRenounced: info.can_take_back_ownership !== '1',
          hasBlacklist: info.is_blacklisted === '1',
          holderCount: parseInt(info.holder_count || '0'),
          lpHolderCount: parseInt(info.lp_holder_count || '0'),
          totalSupply: info.total_supply,
          creatorAddress: info.creator_address,
          ownerAddress: info.owner_address,
          topHolders: (info.holders || []).slice(0, 10).map((h: any) => ({
            address: h.address,
            percent: (parseFloat(h.percent || '0') * 100).toFixed(2),
            isContract: h.is_contract === 1,
            isLocked: h.is_locked === 1,
          })),
          lpHolders: (info.lp_holders || []).slice(0, 5).map((h: any) => ({
            address: h.address,
            percent: (parseFloat(h.percent || '0') * 100).toFixed(2),
            isLocked: h.is_locked === 1,
          })),
        };
      }
    }

    if (!tokenData && !security) {
      return NextResponse.json({ error: 'Token not found', address }, { status: 404 });
    }

    return NextResponse.json({
      token: tokenData,
      security,
      pairs: pairs.map((p: any) => ({
        dex: p.dexId,
        pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
        price: p.priceUsd,
        liquidity: p.liquidity?.usd,
        volume24h: p.volume?.h24,
        chain: p.chainId,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Lookup failed', message: e.message }, { status: 500 });
  }
}
