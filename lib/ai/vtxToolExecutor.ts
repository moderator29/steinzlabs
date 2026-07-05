import 'server-only';

/**
 * VTX tool executor — maps every tool name declared in VTX_TOOLS
 * (lib/services/anthropic.ts) to real service-layer calls and returns the
 * string that becomes the tool_result content fed back to the model.
 *
 * Extracted from app/api/vtx-ai/route.ts so BOTH VTX endpoints share one
 * executor: Next.js route files may only export HTTP handlers, which meant
 * /api/vtx-ai/chat could not reuse the executor and silently dropped every
 * tool call (the model was handed the full tool list with nobody wired to
 * run it — tool-worthy queries returned "VTX could not generate a response").
 */

import { dispatchP2BTool } from '@/lib/ai/vtxToolsP2B';
import { dispatchDuneTool } from '@/lib/ai/vtxToolsDune';
import { getTokenSecurity, getAddressSecurity, getDomainSecurity } from '@/lib/services/goplus';
import {
  getTokenDetail, getTopGainers, getTrendingTokens,
  searchTokens, getCoinMarketChart,
} from '@/lib/services/coingecko';
import { searchPairs, getNewPairs, getTokenPairs } from '@/lib/services/dexscreener';
import { getTokenMetadata, getTokenHolderCount, getContractCode, getEthBalance } from '@/lib/services/alchemy';
import { getSolanaTokenMeta, getSolanaTokenSupply, getSolanaSOLBalance } from '@/lib/services/alchemy-solana';
import { getSocialScore } from '@/lib/services/lunarcrush';
import { cmcConfigured, cmcQuoteBySymbol } from '@/lib/services/coinmarketcap';
import { getEntityLabel, getAddressIntel } from '@/lib/services/arkham';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { executeTrade, type TradeIntent } from '@/lib/trading/relayer';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

// Recognised majors → CoinGecko id. For these we price from CoinGecko and omit
// a contract address, so the card never lands on a same-ticker DexScreener
// scam/derivative pair. Mirrors the SYMBOL_TO_CG map in /api/vtx/token-card.
export const MAJOR_CG_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2',
  MATIC: 'matic-network', POL: 'matic-network', ARB: 'arbitrum', SUI: 'sui',
  LINK: 'chainlink', UNI: 'uniswap', AAVE: 'aave', PEPE: 'pepe', SHIB: 'shiba-inu',
  USDT: 'tether', USDC: 'usd-coin', BONK: 'bonk', WIF: 'dogwifcoin', JUP: 'jupiter-exchange-solana',
  TON: 'the-open-network', OP: 'optimism', LTC: 'litecoin', TRX: 'tron',
};

export function detectTokenAddress(message: string): string | null {
  const ethMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (ethMatch) return ethMatch[0];
  const solMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch && !solMatch[0].match(/^(https?|www\.|[a-z]+\.[a-z])/i)) {
    const candidate = solMatch[0];
    if (candidate.length >= 32 && candidate.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

// ─── Tool Executors ───────────────────────────────────────────────────────────

async function executeTokenSecurityScan(input: Record<string, unknown>): Promise<string> {
  const address = input.contract_address as string;
  // Chain is required by the tool schema, but be defensive: a base58 address
  // with a missing/blank chain must scan against Solana, not ethereum.
  const chain = (typeof input.chain === 'string' && input.chain.length > 0)
    ? (input.chain as string)
    : (address && !address.startsWith('0x') ? 'solana' : 'ethereum');
  try {
    const result = await getTokenSecurity(address, chain);
    if (!result) return `Security scan unavailable for ${address} on ${chain}.`;
    return JSON.stringify(result, null, 2);
  } catch {
    return `Security scan failed for ${address}.`;
  }
}

async function executeTokenMarketData(input: Record<string, unknown>): Promise<string> {
  const identifier = input.identifier as string;
  // Only honor an EXPLICIT chain from the model. Defaulting to 'ethereum'
  // here made a chainless symbol query (e.g. "BONK") filter down to
  // ethereum-only pairs — i.e. bridged/fake ERC-20 clones — hiding the real
  // token that DexScreener's relevance ordering would have surfaced first.
  const chainSpecified = typeof input.chain === 'string' && (input.chain as string).length > 0;
  const chain = chainSpecified ? (input.chain as string) : null;
  const lines: string[] = [];
  // An address query is an exact lookup; a symbol/name query is a fuzzy search.
  const isAddress = detectTokenAddress(identifier) !== null;

  // DexScreener — address → exact token pairs, symbol → text search. Prefer
  // pairs on the requested chain (input.chain, e.g. "ethereum"/"solana") so a
  // same-ticker pair on the wrong chain doesn't shadow the one the caller asked
  // about; fall back to all pairs when none match that chain.
  try {
    const rawPairs = isAddress ? await getTokenPairs(identifier) : await searchPairs(identifier);
    // chainId is a chain name (not an address), so lowercasing for the
    // case-insensitive compare is safe here.
    const onChain = chain ? rawPairs.filter((p) => p.chainId?.toLowerCase() === chain.toLowerCase()) : [];
    const pairs = onChain.length > 0 ? onChain : rawPairs;
    if (pairs.length > 0) {
      const top = pairs.slice(0, 3);
      lines.push(`DexScreener data for "${identifier}"${onChain.length > 0 ? ` (chain: ${chain})` : ''}:`);
      for (const p of top) {
        lines.push(`  ${p.baseToken.name} (${p.baseToken.symbol}) on ${p.chainId}/${p.dexId}`);
        lines.push(`  Price: $${p.priceUsd} | 24h: ${p.priceChange?.h24 ?? 0}%`);
        lines.push(`  Volume 24h: $${(p.volume?.h24 ?? 0).toLocaleString()}`);
        lines.push(`  Liquidity: $${(p.liquidity?.usd ?? 0).toLocaleString()}`);
        lines.push(`  FDV: $${(p.fdv ?? 0).toLocaleString()}`);
        lines.push(`  Buys/Sells 24h: ${p.txns?.h24?.buys ?? 0} / ${p.txns?.h24?.sells ?? 0}`);
        lines.push(`  Contract: ${p.baseToken.address}`);
        lines.push('');
      }
    }
  } catch { /* fall through */ }

  // Also try CoinGecko for listed tokens. CoinGecko is keyed by coin-id, not
  // symbol/address — calling getTokenDetail(symbol) 404s. Resolve symbol →
  // coin-id via the majors map or searchTokens first; skip entirely for raw
  // addresses (CoinGecko has no by-address detail endpoint here).
  try {
    let coinId: string | null = null;
    if (!isAddress) {
      const upper = identifier.toUpperCase();
      coinId = MAJOR_CG_ID[upper] ?? null;
      if (!coinId) {
        const { coins } = await searchTokens(identifier);
        const match = coins.find((c) => c.symbol?.toUpperCase() === upper) ?? coins[0];
        coinId = match?.id ?? null;
      }
    }
    if (!coinId) throw new Error('no coingecko id');
    const detail = await getTokenDetail(coinId);
    lines.push(`CoinGecko data for ${detail.name}:`);
    lines.push(`  Price: $${detail.market_data?.current_price?.usd}`);
    lines.push(`  Market Cap: $${(detail.market_data?.market_cap?.usd ?? 0).toLocaleString()}`);
    lines.push(`  Volume 24h: $${(detail.market_data?.total_volume?.usd ?? 0).toLocaleString()}`);
    lines.push(`  24h change: ${detail.market_data?.price_change_percentage_24h?.toFixed(2)}%`);
    lines.push(`  7d change: ${detail.market_data?.price_change_percentage_7d?.toFixed(2)}%`);
    lines.push(`  Circulating supply: ${detail.market_data?.circulating_supply?.toLocaleString()}`);
  } catch { /* CoinGecko doesn't have this token — that's fine */ }

  // CoinMarketCap (env-gated) — authoritative for LISTED tickers and the only
  // source here that returns real FDV (fully-diluted valuation). Symbol queries
  // only; CMC free tier is keyed by symbol/id, not contract address.
  if (!isAddress && cmcConfigured()) {
    try {
      const q = await cmcQuoteBySymbol(identifier);
      if (q && (q.price != null || q.marketCap != null)) {
        lines.push(`CoinMarketCap data for ${q.name} (${q.symbol})${q.cmcRank ? `, rank #${q.cmcRank}` : ''}:`);
        if (q.price != null) lines.push(`  Price: $${q.price}`);
        if (q.marketCap != null) lines.push(`  Market Cap: $${q.marketCap.toLocaleString()}`);
        if (q.fdv != null) lines.push(`  FDV (fully diluted): $${q.fdv.toLocaleString()}`);
        if (q.volume24h != null) lines.push(`  Volume 24h: $${q.volume24h.toLocaleString()}`);
        if (q.change24h != null) lines.push(`  24h change: ${q.change24h.toFixed(2)}%`);
        if (q.change7d != null) lines.push(`  7d change: ${q.change7d.toFixed(2)}%`);
        if (q.circulatingSupply != null) lines.push(`  Circulating supply: ${q.circulatingSupply.toLocaleString()}`);
        if (q.maxSupply != null) lines.push(`  Max supply: ${q.maxSupply.toLocaleString()}`);
      }
    } catch { /* CMC unlisted / unconfigured — fine, other sources cover it */ }
  }

  return lines.length > 0 ? lines.join('\n') : `No market data found for "${identifier}".`;
}

async function executeWalletProfile(input: Record<string, unknown>): Promise<string> {
  const address = input.address as string;
  const chain = (input.chain as string) ?? 'ethereum';
  const lines: string[] = [`Wallet profile for ${address}:`];

  try {
    const isSolana = !address.startsWith('0x');
    if (isSolana) {
      const [balance, meta] = await Promise.all([
        getSolanaSOLBalance(address).catch(() => 0),
        getAddressIntel(address).catch(() => null),
      ]);
      lines.push(`  Chain: Solana`);
      lines.push(`  SOL Balance: ${balance.toFixed(4)} SOL`);
      if (meta?.arkhamEntity) {
        lines.push(`  Entity: ${meta.arkhamEntity.name} (${meta.arkhamEntity.type})`);
        lines.push(`  Verified: ${meta.arkhamEntity.verified}`);
      }
      if (meta?.labels?.length) lines.push(`  Labels: ${meta.labels.join(', ')}`);
    } else {
      const [balance, intel] = await Promise.all([
        getEthBalance(address, chain).catch(() => '0'),
        getAddressIntel(address).catch(() => null),
      ]);
      lines.push(`  Chain: ${chain}`);
      lines.push(`  ETH Balance: ${balance} ETH`);
      if (intel?.arkhamEntity) {
        lines.push(`  Entity: ${intel.arkhamEntity.name} (${intel.arkhamEntity.type})`);
        lines.push(`  Verified: ${intel.arkhamEntity.verified}`);
      }
      if (intel?.labels?.length) lines.push(`  Labels: ${intel.labels.join(', ')}`);
      if (intel?.scamHistory) {
        lines.push(`  [WARNING] SCAM HISTORY: ${intel.scamHistory.totalRugs} rugs, ${intel.scamHistory.totalStolen} stolen`);
      }
    }
  } catch {
    lines.push('  Could not fetch wallet data.');
  }

  return lines.join('\n');
}

async function executeEntityLookup(input: Record<string, unknown>): Promise<string> {
  const address = input.address as string;
  try {
    const label = await getEntityLabel(address);
    if (label.confidence === 0) return `No entity identified for ${address}. Unknown wallet.`;
    return [
      `Entity lookup for ${address}:`,
      `  Name: ${label.entity}`,
      `  Type: ${label.type}`,
      `  Confidence: ${label.confidence}%`,
      `  Verified: ${label.verified}`,
      label.website ? `  Website: ${label.website}` : '',
    ].filter(Boolean).join('\n');
  } catch {
    return `Entity lookup failed for ${address}.`;
  }
}

async function executeSocialSentiment(input: Record<string, unknown>): Promise<string> {
  const symbol = input.symbol as string;
  try {
    const score = await getSocialScore(symbol);
    if (!score) return `No social data found for ${symbol}.`;
    return [
      `Social sentiment for ${symbol}:`,
      `  Galaxy Score: ${score.galaxyScore}/100`,
      `  Alt Rank: #${score.altRank}`,
      `  Social Volume 24h: ${score.socialVolume24h.toLocaleString()} posts`,
      `  Sentiment Score: ${score.sentimentScore} (-100 bearish to +100 bullish)`,
      `  Social Dominance: ${score.socialDominance?.toFixed(2)}%`,
      `  Influencers: ${score.influencerCount}`,
      score.bullishPercent !== undefined ? `  Bullish: ${score.bullishPercent?.toFixed(1)}%` : '',
      score.bearishPercent !== undefined ? `  Bearish: ${score.bearishPercent?.toFixed(1)}%` : '',
    ].filter(Boolean).join('\n');
  } catch {
    return `Social sentiment fetch failed for ${symbol}.`;
  }
}

async function executeSolanaTokenData(input: Record<string, unknown>): Promise<string> {
  const mint = input.mint_address as string;
  const lines: string[] = [`Solana token data for ${mint}:`];
  try {
    const [meta, supply] = await Promise.all([
      getSolanaTokenMeta(mint).catch(() => null),
      getSolanaTokenSupply(mint).catch(() => 0),
    ]);
    if (meta) {
      lines.push(`  Name: ${meta.name}`);
      lines.push(`  Symbol: ${meta.symbol}`);
      lines.push(`  Decimals: ${meta.decimals}`);
      lines.push(`  Mint Authority: ${meta.mintAuthority ?? 'Renounced'}`);
      lines.push(`  Freeze Authority: ${meta.freezeAuthority ?? 'None'}`);
      if (meta.description) lines.push(`  Description: ${meta.description.slice(0, 200)}`);
    }
    lines.push(`  Total Supply: ${supply.toLocaleString()}`);
  } catch {
    lines.push('  Could not fetch Solana token data.');
  }
  return lines.join('\n');
}

async function executeEvmTokenData(input: Record<string, unknown>): Promise<string> {
  const address = input.contract_address as string;
  const chain = (input.chain as string) ?? 'ethereum';
  const lines: string[] = [`EVM token data for ${address} on ${chain}:`];
  try {
    const [meta, holderCount] = await Promise.all([
      getTokenMetadata(address, chain).catch(() => null),
      getTokenHolderCount(address, chain).catch(() => 0),
    ]);
    if (meta) {
      lines.push(`  Name: ${meta.name ?? 'Unknown'}`);
      lines.push(`  Symbol: ${meta.symbol ?? 'Unknown'}`);
      lines.push(`  Decimals: ${meta.decimals ?? 18}`);
      if (meta.logo) lines.push(`  Logo: ${meta.logo}`);
    }
    lines.push(`  Holder Count (sampled): ${holderCount.toLocaleString()}`);
  } catch {
    lines.push('  Could not fetch EVM token data.');
  }
  return lines.join('\n');
}

async function executeNewTokenDetection(input: Record<string, unknown>): Promise<string> {
  const chain = (input.chain as string) ?? undefined;
  const minLiq = (input.min_liquidity_usd as number) ?? 5000;
  try {
    const pairs = await getNewPairs(minLiq, chain);
    if (pairs.length === 0) return 'No new token launches found matching criteria.';
    const lines = [`New token launches (last 24h, min liquidity $${minLiq.toLocaleString()}):`];
    for (const p of pairs.slice(0, 10)) {
      const ageMins = Math.floor((Date.now() - (p.pairCreatedAt ?? 0)) / 60_000);
      lines.push(`  ${p.baseToken.symbol} on ${p.chainId} (${p.dexId})`);
      lines.push(`    Age: ${ageMins}m | Price: $${p.priceUsd} | Liquidity: $${(p.liquidity?.usd ?? 0).toLocaleString()}`);
      lines.push(`    Contract: ${p.baseToken.address}`);
    }
    return lines.join('\n');
  } catch {
    return 'New token detection failed.';
  }
}

async function executeContractAnalysis(input: Record<string, unknown>): Promise<string> {
  const address = input.contract_address as string;
  const chain = (input.chain as string) ?? 'ethereum';
  try {
    const code = await getContractCode(address, chain);
    if (!code || code === '0x') return `${address} is not a contract on ${chain} (EOA wallet or non-existent).`;
    // Use VTX internal analysis to interpret the bytecode length as a signal
    const sizeKb = (code.length / 2 / 1024).toFixed(1);
    const summary = await vtxAnalyze(
      `Analyze this EVM smart contract on ${chain}. Contract address: ${address}. Bytecode size: ${sizeKb}KB. Based on the bytecode size and address, provide a brief security assessment. Note: actual bytecode not included for brevity. Focus on what can be inferred.`,
      600
    ).catch(() => '');
    return [
      `Contract analysis for ${address} on ${chain}:`,
      `  Bytecode size: ${sizeKb}KB`,
      `  Status: Contract exists and is deployed`,
      summary ? `\nAI Assessment:\n${summary}` : '',
    ].filter(Boolean).join('\n');
  } catch {
    return `Contract analysis failed for ${address}.`;
  }
}

// ─── Session 5B-2 tool executors ──────────────────────────────────────────────

async function executeAddressSecurity(input: Record<string, unknown>): Promise<string> {
  const address = String(input.address || '');
  const chain = String(input.chain || 'ethereum');
  if (!address) return JSON.stringify({ error: 'address required' });
  try {
    const sec = await getAddressSecurity(address, chain);
    return JSON.stringify({
      address,
      chain,
      isScam: (sec as unknown as Record<string, unknown>).isScam ?? false,
      isBlacklisted: (sec as unknown as Record<string, unknown>).isBlacklisted ?? false,
      riskFlags: (sec as unknown as Record<string, unknown>).riskFlags ?? [],
      raw: sec,
    });
  } catch (err) {
    return JSON.stringify({ address, chain, error: err instanceof Error ? err.message : String(err) });
  }
}

async function executeWhaleActivity(input: Record<string, unknown>): Promise<string> {
  const whaleAddress = String(input.whale_address || '');
  if (!whaleAddress) return JSON.stringify({ error: 'whale_address required' });
  const chain = input.chain ? String(input.chain) : null;
  const limit = Math.min(25, Math.max(1, Number(input.limit) || 10));
  try {
    const admin = getSupabaseAdmin();
    let query = admin
      .from('whale_activity')
      .select('tx_hash, chain, action, token_address, token_symbol, value_usd, timestamp')
      .eq('whale_address', whaleAddress)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (chain) query = query.eq('chain', chain);
    const { data, error } = await query;
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({
      whale_address: whaleAddress,
      chain,
      count: data?.length ?? 0,
      moves: data ?? [],
    });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function executeWhaleProfile(input: Record<string, unknown>): Promise<string> {
  const action = String(input.action || (input.address ? 'get' : 'list'));
  const admin = getSupabaseAdmin();
  try {
    if (action === 'get') {
      // Canonical form, NOT .toLowerCase() — Solana whale addresses are
      // case-sensitive base58 and a lowercased key never matches the stored
      // row. normalizeAddress lowercases EVM only.
      const address = normalizeAddress(String(input.address || ''), input.chain ? String(input.chain) : undefined);
      if (!address) return JSON.stringify({ error: 'address required for action=get' });
      let q = admin.from('whales').select('address, chain, label, entity_type, portfolio_value_usd, pnl_7d_usd, pnl_30d_usd, win_rate, trade_count_30d, whale_score, follower_count, verified, last_active_at, x_handle, archetype').eq('address', address).eq('is_active', true);
      if (input.chain) q = q.eq('chain', String(input.chain));
      const { data, error } = await q.maybeSingle();
      if (error) return JSON.stringify({ error: error.message });
      if (!data) return JSON.stringify({ found: false, message: 'Whale not in directory. Use whale_activity tool to check on-chain moves, or suggest user submit via the whale tracker.' });
      return JSON.stringify({ found: true, whale: data });
    }
    // action=list
    const chain = input.chain ? String(input.chain) : null;
    const entityType = input.entity_type ? String(input.entity_type) : null;
    const minPortfolio = input.min_portfolio_usd ? Number(input.min_portfolio_usd) : null;
    const sort = String(input.sort || 'portfolio');
    const limit = Math.min(25, Math.max(1, Number(input.limit) || 10));

    const sortCol = sort === 'pnl_30d' ? 'pnl_30d_usd'
      : sort === 'trade_count_30d' ? 'trade_count_30d'
      : sort === 'win_rate' ? 'win_rate'
      : sort === 'score' ? 'whale_score'
      : 'portfolio_value_usd';

    let q = admin.from('whales').select('address, chain, label, entity_type, portfolio_value_usd, pnl_30d_usd, win_rate, trade_count_30d, whale_score').eq('is_active', true).order(sortCol, { ascending: false, nullsFirst: false }).limit(limit);
    if (chain) q = q.eq('chain', chain);
    if (entityType) q = q.eq('entity_type', entityType);
    if (minPortfolio !== null) q = q.gte('portfolio_value_usd', minPortfolio);

    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ count: data?.length ?? 0, sort_by: sortCol, whales: data ?? [] });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function executeCheckPhishingUrl(input: Record<string, unknown>): Promise<string> {
  const url = String(input.url || '');
  if (!url) return JSON.stringify({ error: 'url required' });
  try {
    const result = await getDomainSecurity(url);
    return JSON.stringify({
      url,
      verdict: (result as unknown as Record<string, unknown>).verdict ?? 'UNKNOWN',
      isPhishing: (result as unknown as Record<string, unknown>).isPhishing ?? false,
      isMalicious: (result as unknown as Record<string, unknown>).isMalicious ?? false,
      signals: (result as unknown as Record<string, unknown>).signals ?? [],
      raw: result,
    });
  } catch (err) {
    return JSON.stringify({ url, error: err instanceof Error ? err.message : String(err) });
  }
}

async function executeCoingeckoMarketData(input: Record<string, unknown>): Promise<string> {
  const action = String(input.action || '');
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 25);
  try {
    switch (action) {
      case 'get_coin': {
        const coinId = String(input.coinId || '');
        if (!coinId) return JSON.stringify({ error: 'coinId required' });
        const d = await getTokenDetail(coinId);
        return JSON.stringify({
          id: d.id, name: d.name, symbol: d.symbol.toUpperCase(),
          price_usd: d.market_data?.current_price?.usd ?? 0,
          market_cap_usd: d.market_data?.market_cap?.usd ?? 0,
          rank: d.market_cap_rank,
          volume_24h_usd: d.market_data?.total_volume?.usd ?? 0,
          change_24h_pct: d.market_data?.price_change_percentage_24h ?? 0,
          change_7d_pct: d.market_data?.price_change_percentage_7d ?? 0,
          change_30d_pct: d.market_data?.price_change_percentage_30d ?? 0,
          ath_usd: d.market_data?.ath?.usd ?? 0,
          ath_change_pct: d.market_data?.ath_change_percentage?.usd ?? 0,
          circulating_supply: d.market_data?.circulating_supply ?? 0,
        });
      }
      case 'get_trending': {
        const t = await getTrendingTokens();
        return JSON.stringify({ trending: t.slice(0, limit).map((c) => ({
          id: c.id, name: c.name, symbol: c.symbol.toUpperCase(),
          rank: c.market_cap_rank,
          change_24h_pct: c.data?.price_change_percentage_24h?.usd ?? null,
        })) });
      }
      case 'search': {
        const q = String(input.query || '');
        if (!q) return JSON.stringify({ error: 'query required' });
        const r = await searchTokens(q);
        return JSON.stringify({ matches: (r.coins ?? []).slice(0, 8).map((c) => ({
          id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), rank: c.market_cap_rank,
        })) });
      }
      case 'compare_coins': {
        const ids = Array.isArray(input.coinIds) ? (input.coinIds as string[]).slice(0, 5) : [];
        if (ids.length < 2) return JSON.stringify({ error: 'compare_coins needs at least 2 coinIds' });
        const all = await Promise.all(ids.map(async (id) => {
          try {
            const d = await getTokenDetail(id);
            return {
              id: d.id, name: d.name, symbol: d.symbol.toUpperCase(),
              price_usd: d.market_data?.current_price?.usd ?? 0,
              market_cap_usd: d.market_data?.market_cap?.usd ?? 0,
              rank: d.market_cap_rank,
              change_24h_pct: d.market_data?.price_change_percentage_24h ?? 0,
              change_7d_pct: d.market_data?.price_change_percentage_7d ?? 0,
            };
          } catch { return { id, error: 'fetch failed' }; }
        }));
        return JSON.stringify({ coins: all });
      }
      case 'get_chart': {
        const coinId = String(input.coinId || '');
        const days = Math.min(Math.max(Number(input.days) || 7, 1), 365);
        if (!coinId) return JSON.stringify({ error: 'coinId required' });
        const points = await getCoinMarketChart(coinId, days);
        // Trim to a reasonable density for the LLM context window
        const stride = Math.max(1, Math.floor(points.length / 50));
        const sampled = points.filter((_, i) => i % stride === 0);
        return JSON.stringify({ id: coinId, days, point_count: sampled.length, points: sampled });
      }
      case 'get_top_gainers': {
        const g = await getTopGainers(limit);
        return JSON.stringify({ gainers: g.map((c) => ({
          id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
          price_usd: c.current_price, market_cap_usd: c.market_cap,
          change_24h_pct: c.price_change_percentage_24h,
        })) });
      }
      default:
        return JSON.stringify({ error: `unknown action "${action}"` });
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function executePrepareSwap(
  input: Record<string, unknown>,
  userId: string | null,
): Promise<string> {
  if (!userId) {
    return JSON.stringify({
      error: 'authentication_required',
      message: 'You need to sign in to prepare a swap. Please sign in and ask again.',
    });
  }
  const chain = String(input.chain || '');
  const fromTokenAddress = String(input.from_token_address || '');
  const toTokenAddress = String(input.to_token_address || '');
  const amountIn = String(input.amount_in || '');
  if (!chain || !fromTokenAddress || !toTokenAddress || !amountIn) {
    return JSON.stringify({ error: 'missing_required_fields', need: ['chain', 'from_token_address', 'to_token_address', 'amount_in'] });
  }
  const slippageBps = Number(input.slippage_bps) || 100;
  const walletSourceRaw = input.wallet_source ? String(input.wallet_source) : '';
  const walletSource: TradeIntent['walletSource'] =
    walletSourceRaw === 'external_solana' || walletSourceRaw === 'external_evm' || walletSourceRaw === 'builtin'
      ? walletSourceRaw
      : (chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol')
        ? 'external_solana'
        : 'external_evm';

  const result = await executeTrade({
    userId,
    chain,
    walletSource,
    fromTokenAddress,
    toTokenAddress,
    amountIn,
    slippageBps,
    reason: 'vtx_chat',
    sourceOrderId: null,
    sourceOrderTable: null,
  });

  if (result.success && result.awaitingUserConfirmation) {
    return JSON.stringify({
      ok: true,
      pending_trade_id: result.pendingTradeId,
      route_provider: result.route?.provider ?? null,
      expected_amount_out: result.route?.amountOut ?? null,
      message: 'Swap staged. Open the PendingTradesBanner to confirm in your browser.',
    });
  }
  return JSON.stringify({
    ok: false,
    blocked: result.securityBlocked === true,
    reason: result.failureReason ?? 'unknown',
  });
}

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

export async function executeVTXTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string | null = null,
): Promise<string> {
  switch (toolName) {
    case 'token_security_scan':  return executeTokenSecurityScan(toolInput);
    case 'token_market_data':    return executeTokenMarketData(toolInput);
    case 'wallet_profile':       return executeWalletProfile(toolInput);
    case 'entity_lookup':        return executeEntityLookup(toolInput);
    case 'social_sentiment':     return executeSocialSentiment(toolInput);
    case 'solana_token_data':    return executeSolanaTokenData(toolInput);
    case 'evm_token_data':       return executeEvmTokenData(toolInput);
    case 'new_token_detection':  return executeNewTokenDetection(toolInput);
    case 'contract_analysis':    return executeContractAnalysis(toolInput);
    // Session 5B-2 additions
    case 'address_security':     return executeAddressSecurity(toolInput);
    case 'whale_activity':       return executeWhaleActivity(toolInput);
    case 'whale_profile':        return executeWhaleProfile(toolInput);
    case 'check_phishing_url':   return executeCheckPhishingUrl(toolInput);
    case 'prepare_swap':         return executePrepareSwap(toolInput, userId);
    case 'coingecko_market_data': return executeCoingeckoMarketData(toolInput);
    default: {
      // §3 P2-B — 10 tools live in lib/ai/vtxToolsP2B and dispatch via
      // a shared helper so this main dispatcher stays readable.
      const p2b = await dispatchP2BTool(toolName, toolInput, userId);
      if (p2b !== null) return p2b;
      // §5 Dune tools (tier-1 + tier-2, 17 total) — same shared-helper
      // pattern. Both are checked; first non-null wins. Falls through
      // to "Unknown tool" only when neither recognizes the name.
      const dune = await dispatchDuneTool(toolName, toolInput, userId);
      if (dune !== null) return dune;
      return `Unknown tool: ${toolName}`;
    }
  }
}
