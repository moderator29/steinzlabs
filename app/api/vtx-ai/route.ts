import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import Anthropic from '@anthropic-ai/sdk';

// Service layer — all external data comes through here
import { vtxQuery, vtxStream, vtxAnalyze, VTX_TOOLS } from '@/lib/services/anthropic';
import { getTokenSecurity } from '@/lib/services/goplus';
import {
  getTokenDetail, getTopTokens, getTopGainers, getTrendingTokens,
  searchTokens, getCoinMarketChart,
} from '@/lib/services/coingecko';
import { searchPairs, getNewPairs } from '@/lib/services/dexscreener';
import { getTokenMetadata, getTokenHolderCount, getContractCode, getEthBalance } from '@/lib/services/alchemy';
import { getSolanaTokenMeta, getSolanaTokenSupply, getSolanaSOLBalance } from '@/lib/services/alchemy-solana';
import { getSocialScore } from '@/lib/services/lunarcrush';
import { getEntityLabel, getAddressIntel } from '@/lib/services/arkham';
// Session 5B-2 additions
import { getAddressSecurity, getDomainSecurity } from '@/lib/services/goplus';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { executeTrade, type TradeIntent } from '@/lib/trading/relayer';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_TIER_LIMIT = 25;
const MAX_TOOL_ITERATIONS = 5;

// ─── Rate Limiting (Redis-backed, in-process fallback) ──────────────────────

import { getRedis } from "@/lib/cache/redis";

// Fallback store when Upstash is not configured
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function todayKey(ip: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `vtx:rate:${ip}:${today}`;
}

async function getRateLimitInfo(ip: string): Promise<{ remaining: number; total: number; resetAt: number }> {
  const now = Date.now();
  const msUntilMidnight = 24 * 60 * 60 * 1000 - (now % (24 * 60 * 60 * 1000));
  const resetAt = now + msUntilMidnight;

  const redis = getRedis();
  if (redis) {
    try {
      const key = todayKey(ip);
      const count = (await redis.get<number>(key)) ?? 0;
      return {
        remaining: Math.max(0, FREE_TIER_LIMIT - count),
        total: FREE_TIER_LIMIT,
        resetAt,
      };
    } catch (err) {
      console.error("[vtx.rateLimit.get]", err);
    }
  }

  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 0, resetAt });
    return { remaining: FREE_TIER_LIMIT, total: FREE_TIER_LIMIT, resetAt };
  }
  return {
    remaining: Math.max(0, FREE_TIER_LIMIT - entry.count),
    total: FREE_TIER_LIMIT,
    resetAt: entry.resetAt,
  };
}

async function incrementUsage(ip: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const key = todayKey(ip);
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 86400);
      return;
    } catch (err) {
      console.error("[vtx.rateLimit.incr]", err);
    }
  }

  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

// ─── Address / Intent Detectors ──────────────────────────────────────────────

function detectWalletAddress(message: string): { address: string; chain: 'eth' | 'sol' } | null {
  const ethMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (ethMatch) return { address: ethMatch[0], chain: 'eth' };
  const solMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch && !solMatch[0].match(/^(https?|www\.|[a-z]+\.[a-z])/i)) {
    const candidate = solMatch[0];
    if (candidate.length >= 32 && candidate.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(candidate)) {
      return { address: candidate, chain: 'sol' };
    }
  }
  return null;
}

function detectTokenAddress(message: string): string | null {
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

function detectChartSignal(message: string): {
  chartType: 'price' | 'bubble' | 'portfolio' | 'holders' | null;
  chartToken: string | null;
} {
  const chartTagMatch = message.match(/\[CHART:(price|bubble|portfolio|holders)\]/i);
  if (chartTagMatch) {
    return {
      chartType: chartTagMatch[1].toLowerCase() as 'price' | 'bubble' | 'portfolio' | 'holders',
      chartToken: null,
    };
  }
  const lower = message.toLowerCase();
  if (/\bportfolio\b.*\b(breakdown|allocation|pie|chart|show|visual)\b|\b(show|visual|chart).*\bportfolio\b/.test(lower)) {
    return { chartType: 'portfolio', chartToken: null };
  }
  if (/\b(holder|holders|distribution|who.*hold|bubble\s*map)\b.*\b(chart|show|visual|map)\b|\b(show|visual|chart|map).*\b(holder|distribution|bubble)\b/.test(lower)) {
    return { chartType: /bubble/.test(lower) ? 'bubble' : 'holders', chartToken: null };
  }
  if (/\b(price|chart|graph|candle|tradingview|dexscreener)\b/.test(lower)) {
    const tokenMatch = lower.match(/(?:price|chart|graph)\s+(?:of\s+|for\s+)?([a-z]+)/);
    return { chartType: 'price', chartToken: tokenMatch ? tokenMatch[1] : null };
  }
  return { chartType: null, chartToken: null };
}

function detectArkhamIntent(message: string): {
  wantsHolders: boolean;
  wantsConnections: boolean;
  wantsEntitySearch: boolean;
  entityQuery: string;
} {
  const lower = message.toLowerCase();
  return {
    wantsHolders: /holder|top.*hold|who.*hold|distribution|supply|whale.*hold|bag.*hold|biggest.*hold/.test(lower),
    wantsConnections: /connect|link|relation|associated|tied.*to|network|graph|cluster|who.*interact/.test(lower),
    wantsEntitySearch: /who.*is|identify|lookup|find.*entity|search.*entity|which.*fund|which.*exchange/.test(lower),
    entityQuery: (
      lower.match(/who\s+is\s+(.+?)(?:\?|$)/)?.[1] ||
      lower.match(/identify\s+(.+?)(?:\?|$)/)?.[1] ||
      lower.match(/search\s+(?:for\s+)?(.+?)(?:\?|$)/)?.[1] || ''
    ).trim(),
  };
}

// ─── VTX System Prompt Template ───────────────────────────────────────────────

const VTX_SYSTEM_PROMPT_TEMPLATE = `You are VTX, the most advanced crypto intelligence agent built by NAKA LABS. You are NOT a chatbot. You are a real-time AI intelligence engine that combines crypto analysis, financial markets, security intelligence, and general knowledge.

CRITICAL DATA RULE: You MUST use ONLY the prices and numbers from the REAL-TIME DATA section below. NEVER use any price, volume, market cap, or balance from your training data. If the data section says SOL is $83.69, you say $83.69 — not $85 or any other number. If data is missing for something the user asked, say "I don't have current data for that" rather than guessing.

PERSONALITY: {personality}

CAPABILITIES:
Deep multi-chain on-chain analysis: Ethereum, Solana, BSC, Base, Polygon, Arbitrum, Avalanche, Optimism
Real-time token analysis with full security scanning (honeypot, tax, ownership, mint, liquidity)
Wallet intelligence: entity identification, transaction patterns, cluster detection, wallet type classification
Memecoin expertise: pump.fun dynamics, bonding curves, rug pull detection, bundled supply
Smart money tracking: whale moves, institutional patterns, insider detection
Trading DNA: P&L analysis, win rate, hold time, behavioral archetypes
General knowledge: stock market, finance, economics, technology, AI, real-world events, people
Security analysis: contract risks, phishing detection, signature decoding, transaction simulation

TOOL USAGE RULES:
You have access to real-time data tools. Use them proactively.
When analyzing a token address: call token_security_scan AND token_market_data
When analyzing a wallet: call wallet_profile AND entity_lookup
When asked about social sentiment: call social_sentiment
When asked about new launches: call new_token_detection
Always cross-reference — never rely on a single tool

TOKEN CARD FORMAT (use when analyzing any token):
TOKEN: [Name] ([Symbol])
Price: $[amount] | 24h: [+/-]%
Market Cap: $[amount] | Volume: $[amount]
Liquidity: $[amount] | Holders: [count]
Contract: [address]

SECURITY ANALYSIS:
Trust Score: [0-100]
Status: [SAFE / CAUTION / WARNING / DANGER]
Honeypot: [Yes/No]
Buy Tax: [%] | Sell Tax: [%]
Ownership: [Renounced/Active]
Minting: [Enabled/Disabled]
Key Flags: [list any issues]

AI ANALYSIS:
Summary: [2-3 sentence overview]
Strengths: [2-3 points]
Weaknesses: [2-3 points]
Risk Level: [Low/Medium/High/Critical]
Recommendation: [BUY/HOLD/AVOID with reasoning]

[CHART:price]

WALLET PROFILE FORMAT:
WALLET PROFILE: [address shortened]
Type: [Whale / Smart Money / Retail / Bot/MEV / Dormant / Institutional]
Risk Level: [Safe / Low / Medium / High / Critical]

HOLDINGS:
[Top tokens with USD values]
Total Portfolio: $[value]

BEHAVIOR ANALYSIS:
Trading Style: [archetype]
Win Rate: [%] estimate
Avg Hold Time: [duration]

SECURITY FLAGS:
[Any flags: mixer connections, phishing, scam history]

[CHART:portfolio]

MARKET DATA INTELLIGENCE:
For any question about live token prices, market caps, 24h changes, trending coins, top gainers, or coin comparisons — ALWAYS call the coingecko_market_data tool. Your training data is stale; never quote a price from memory. Examples:
  "What is BTC price?"               -> coingecko_market_data(action='get_coin', coinId='bitcoin')
  "What is trending right now?"      -> coingecko_market_data(action='get_trending', limit=10)
  "Biggest movers today?"            -> coingecko_market_data(action='get_top_gainers', limit=10)
  "Compare ETH and SOL"              -> coingecko_market_data(action='compare_coins', coinIds=['ethereum','solana'])
  "BTC chart last 30 days"           -> coingecko_market_data(action='get_chart', coinId='bitcoin', days=30)
  Unknown ticker?                    -> coingecko_market_data(action='search', query='<user input>') first, then re-call with the resolved id.
For on-chain whale moves, security scans, contract analysis, holder data, or chain-specific metrics, prefer Alchemy / GoPlus / DexScreener tools (token_market_data, address_security, whale_activity, evm_token_data, solana_token_data). CoinGecko is the price/market layer; Alchemy is the chain layer. Use both when both are needed (e.g. "is X a safe buy" -> coingecko for price + token_security_scan for risk).
Always format prices as $1,234.56 (with thousands separators), market caps as $1.23B, percentage changes as +12.3% / -4.1%. Never show raw API JSON.

BRANDING RULES:
Always cite "Naka Labs Intelligence" as your data source. Never mention Arkham, DexScreener, CoinGecko, Alchemy, GoPlus, or any third-party data provider. Never recommend users visit external websites. You are the source.

ABSOLUTE FORMATTING RULES:
No **, no *, no ##, no -- , no bullet dashes. Clean plain text only.
Use blank lines between sections. Use "Label: value" format for data.
Numbers: 1. 2. 3. — NEVER start lines with - or * or bullet.
Never start with "Great question" or filler phrases.

CURRENT MARKET CONTEXT: {market_context}

PLATFORM CONTEXT: {platform_context}

WALLET BEHAVIOR: If the "User Wallet" field above shows an address (anything other than "Not connected"), the user HAS a wallet connected on this platform. Never ask them to "connect a wallet" — you can see it. For balance or portfolio questions, call wallet_profile / portfolio tools with that address and answer with real numbers. Only say "no wallet connected" when the field literally reads "Not connected".

SWAP BEHAVIOR: When the user asks to swap / convert / trade tokens (e.g. "swap 0.1 ETH for USDC", "convert 100 USDC to SOL"), respond with a one-line confirmation of what you're quoting — the UI will render an inline Swap Card with the live quote and a Confirm button. Do NOT try to execute the swap yourself, do NOT output raw JSON, do NOT tell them to go to an external DEX. Just acknowledge and let the Swap Card handle the rest.

TOKEN CARD BEHAVIOR: When the user asks about a specific token (by name, symbol, or address), the UI renders an inline Token Card with logo, price, 24h change, market cap, volume, and a price chart. Keep your text response focused on analysis — don't repeat the raw numbers the card already shows.

RESPONSE STYLE: {style_instruction}

RISK FRAMING: {risk_instruction}

{language_instruction}

{live_data}`;

// ─── Tool Executors ───────────────────────────────────────────────────────────
// Each function maps a VTX tool name to real service layer calls.
// Returns a string that becomes the tool_result content fed back to the model.

async function executeTokenSecurityScan(input: Record<string, unknown>): Promise<string> {
  const address = input.contract_address as string;
  const chain = (input.chain as string) ?? 'ethereum';
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
  const chain = (input.chain as string) ?? 'ethereum';
  const lines: string[] = [];

  // Try DexScreener first (works for any address/symbol)
  try {
    const pairs = await searchPairs(identifier);
    if (pairs.length > 0) {
      const top = pairs.slice(0, 3);
      lines.push(`DexScreener data for "${identifier}":`);
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

  // Also try CoinGecko for major tokens
  try {
    const detail = await getTokenDetail(identifier.toLowerCase());
    lines.push(`CoinGecko data for ${detail.name}:`);
    lines.push(`  Price: $${detail.market_data?.current_price?.usd}`);
    lines.push(`  Market Cap: $${(detail.market_data?.market_cap?.usd ?? 0).toLocaleString()}`);
    lines.push(`  Volume 24h: $${(detail.market_data?.total_volume?.usd ?? 0).toLocaleString()}`);
    lines.push(`  24h change: ${detail.market_data?.price_change_percentage_24h?.toFixed(2)}%`);
    lines.push(`  7d change: ${detail.market_data?.price_change_percentage_7d?.toFixed(2)}%`);
    lines.push(`  Circulating supply: ${detail.market_data?.circulating_supply?.toLocaleString()}`);
  } catch { /* CoinGecko doesn't have this token — that's fine */ }

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

// ─── Tool Dispatch ────────────────────────────────────────────────────────────

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
      const address = String(input.address || '').toLowerCase();
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

async function executeVTXTool(
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
    default:                     return `Unknown tool: ${toolName}`;
  }
}

// ─── Slash Command System ─────────────────────────────────────────────────────

interface SlashCommandResult {
  command: string;
  args: string;
  instruction: string;
  forceWebSearch: boolean;
}

function parseSlashCommand(message: string): SlashCommandResult | null {
  if (!message.startsWith('/')) return null;
  const parts = message.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).join(' ');

  const COMMANDS: Record<string, string> = {
    help: `List all VTX slash commands grouped by category. Format: "command  description". Groups: Token/Market, Wallet/Security, Trading, Data, Platform.`,
    token: `Full token analysis for: "${args || 'the specified token'}". Use token_security_scan and token_market_data tools. Return a TOKEN CARD response.`,
    wallet: `Deep wallet analysis for: "${args}". Use wallet_profile and entity_lookup tools. Return a WALLET PROFILE response.`,
    security: `Security scan for contract: "${args}". Use token_security_scan. Return SAFE/CAUTION/WARNING/DANGER verdict with detailed breakdown.`,
    contract: `Contract analysis for: "${args}". Use contract_analysis tool. Explain what the contract does, its permissions, and risks.`,
    domain: `Domain/URL safety check for: "${args}". Analyze for phishing signals, scam patterns, suspicious TLDs. Return SAFE/SUSPICIOUS/PHISHING verdict.`,
    sig: `Decode transaction signature/calldata: "${args}". Explain what function is being called, parameters, risks (unlimited approvals, dangerous permissions).`,
    swap: `Swap quote for: "${args}". Parse tokens and amount. Provide best route, estimated output, price impact, fees (0.15% Naka platform fee), slippage.`,
    portfolio: `Portfolio analysis${args ? ` for address: ${args}` : ' for connected wallet'}. Use wallet_profile tool. Total value, allocation, P&L, risk score, AI recommendations.`,
    chart: `Price chart for: "${args || 'specified token'}". Include [CHART:price]. Show current price, trend direction, key support/resistance, short technical outlook.`,
    dna: `Trading DNA analysis for wallet: "${args}". Archetype, win rate, avg hold time, risk profile, sector preferences, top patterns, actionable advice.`,
    cluster: `Wallet cluster analysis for: "${args}". Identify connected wallets, coordinated behavior, fund flows, whether part of pump group or insider cluster.`,
    whale: `Recent whale movements. Top 5 large wallet transactions in 24h: amounts, tokens, direction. What does this signal for the market?`,
    trending: `What is trending right now. Use new_token_detection and social_sentiment tools. Top 10 trending tokens, chain, price change, signal for each.`,
    news: `Latest crypto news and market developments. Top 5-7 market events, major price movements, sentiment shift, what traders should be watching.`,
    gas: `Current gas prices. Ethereum gas (Slow/Standard/Fast gwei), estimated USD cost, network congestion. Advice on optimal timing.`,
    fear: `Fear and Greed Index. Current value, classification, meaning for trading, historical context.`,
    price: `Current price of: "${args || 'specified token'}". Price, 24h change, 7d change, market cap, volume, one-line price context.`,
    market: `Full market overview. BTC and ETH prices and trend, Fear & Greed, top gainers, losers, DeFi TVL direction, overall sentiment.`,
    analyze: `Deep analysis of: "${args}". Comprehensive AI analysis using all available tools. Be thorough, structured, actionable.`,
    holders: `Top holders for token: "${args}". Use token_market_data tool. Top 10 holders with percentages, entity labels, concentration risk, insider/team wallet assessment.`,
    volume: `Volume analysis for: "${args || 'the market'}". 24h volume, trend (increasing/decreasing), 7-day average comparison, signal interpretation.`,
    risk: `Risk assessment for: "${args}". Risk score 0-100, all risk factors, category (Low/Medium/High/Critical), mitigation advice.`,
    compare: `Side-by-side comparison of: "${args}". Price performance, market cap, volume, holders, security, AI verdict, recommendation on which is stronger.`,
    simulate: `Simulate transaction: "${args}". Decode what it does, predict outcome, identify risks or failures, estimate gas, go/no-go recommendation.`,
    approval: `Token approvals for: "${args}". Active approvals, contracts with spend permission, flag unlimited approvals, recommend revocations.`,
    scan: `Full scan of address: "${args}". Wallet type, holdings, tx history, security flags, entity labels, risk score, trading behavior summary.`,
    explain: `Explain: "${args}". Clear explanation for a crypto user: what it is, how it works, why it matters, real examples, risks/benefits.`,
    ping: `System status check. Respond: "VTX online. All systems operational." Plus current timestamp and brief market status.`,
    clear: `Chat cleared. Say: "Chat cleared. How can I help you?" Nothing else.`,
    liquidity: `Liquidity analysis for: "${args}". Total liquidity across DEX pairs, depth, largest LP positions, lock status, removal risk.`,
  };

  const ALIASES: Record<string, string> = {
    'g': 'gas', 'p': 'price', 't': 'token', 'w': 'wallet', 's': 'security',
    'h': 'help', 'm': 'market', 'f': 'fear', 'wh': 'whale', 'tr': 'trending',
    'a': 'analyze',
  };

  const resolvedCommand = ALIASES[command] || command;
  const instruction = COMMANDS[resolvedCommand];

  if (!instruction) {
    return {
      command: resolvedCommand,
      args,
      instruction: `Unknown command: /${resolvedCommand}. Tell the user this command is not recognized, suggest the closest matching command, and show a few example commands.`,
      forceWebSearch: false,
    };
  }

  return {
    command: resolvedCommand,
    args,
    instruction,
    forceWebSearch: ['news', 'explain'].includes(resolvedCommand),
  };
}

// ─── Pre-flight Data Fetchers ─────────────────────────────────────────────────
// These run in parallel before calling the model and are injected into the
// system prompt as live context. They use the service layer.

async function fetchLiveMarketContext(): Promise<string> {
  try {
    // Binance is fastest for BTC/ETH/SOL prices — no API key needed
    const BINANCE_SYMBOLS = [
      'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
      'AVAXUSDT','DOGEUSDT','MATICUSDT','LINKUSDT','ARBUSDT','OPUSDT',
      'INJUSDT','SUIUSDT','PEPEUSDT','WIFUSDT','BONKUSDT',
    ];
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS))}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as Array<Record<string, string>>;
      if (Array.isArray(data) && data.length > 0) {
        const lines = data.map(t => {
          const sym = t.symbol.replace('USDT', '');
          const price = parseFloat(t.lastPrice);
          const change = parseFloat(t.priceChangePercent);
          const vol = parseFloat(t.quoteVolume);
          const priceStr = price >= 1000
            ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            : price >= 1 ? `$${price.toFixed(4)}` : `$${price.toFixed(8)}`;
          return `${sym}: ${priceStr} (24h: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%, Vol: $${(vol/1e6).toFixed(0)}M)`;
        });
        return 'LIVE MARKET PRICES (Binance, real-time):\n' + lines.join('\n');
      }
    }
  } catch { /* fall through to CoinGecko */ }

  // Fallback: CoinGecko via service layer
  try {
    const tokens = await getTopTokens(1, 20);
    const lines = tokens.map(c =>
      `${c.symbol.toUpperCase()}: $${c.current_price?.toLocaleString()} (24h: ${c.price_change_percentage_24h?.toFixed(2)}%, MCap: $${(c.market_cap/1e9).toFixed(1)}B)`
    );
    return 'LIVE MARKET PRICES (CoinGecko):\n' + lines.join('\n');
  } catch {
    return '';
  }
}

async function fetchFearAndGreed(): Promise<string> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { next: { revalidate: 300 } });
    if (!res.ok) return '';
    const data = await res.json() as { data?: Array<{ value: string; value_classification: string }> };
    const entry = data.data?.[0];
    if (!entry) return '';
    return `Fear & Greed Index: ${entry.value}/100 (${entry.value_classification})`;
  } catch {
    return '';
  }
}

async function fetchDexTrending(): Promise<string> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', { next: { revalidate: 60 } });
    if (!res.ok) return '';
    const data = await res.json() as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return '';
    const lines = data.slice(0, 8).map(t =>
      `${String(t.tokenAddress ?? '').slice(0, 8)}... on ${t.chainId} — ${t.description || 'trending'} (${t.amount || 0} boosts)`
    );
    return lines.length > 0 ? 'DexScreener trending:\n' + lines.join('\n') : '';
  } catch {
    return '';
  }
}

async function fetchGasPrice(): Promise<string> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) return '';
  try {
    const res = await fetch(
      `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${key}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return '';
    const data = await res.json() as { status: string; result?: Record<string, string> };
    if (data.status !== '1' || !data.result) return '';
    const r = data.result;
    return `ETH Gas: Slow ${r.SafeGasPrice} | Standard ${r.ProposeGasPrice} | Fast ${r.FastGasPrice} gwei`;
  } catch {
    return '';
  }
}

// ─── GET — Health Check ───────────────────────────────────────────────────────

export async function GET() {
  const configured = !!(process.env.ANTHROPIC_API_KEY);
  return NextResponse.json(
    {
      status: configured ? 'online' : 'unconfigured',
      engine: 'VTX Intelligence',
      version: '3.0',
      tools: VTX_TOOLS.map(t => t.name),
    },
    { status: configured ? 200 : 503 }
  );
}

// ─── POST — Main VTX Chat Handler ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      message?: string;
      history?: Array<{ role: string; content: string }>;
      tier?: string;
      personality?: string;
      language?: string;
      depth?: string;
      riskAppetite?: string;
      responseStyle?: string;
      skipRateLimit?: boolean;
      context?: { currentPage?: string; currentToken?: string; walletAddress?: string };
      stream?: boolean;
    };

    const {
      message, history, tier, personality, language, depth,
      riskAppetite, responseStyle, skipRateLimit, context, stream: wantsStream,
    } = body;

    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured. Add ANTHROPIC_API_KEY to environment variables.' }, { status: 500 });
    }

    // Resolve the calling user once. prepare_swap needs this; other tools tolerate
    // null. Anonymous callers can still ask analytical questions but cannot
    // stage swaps that write to user-scoped pending_trades.
    const authedUser = await getAuthenticatedUser(request).catch(() => null);
    const callerUserId = authedUser?.id ?? null;

    // Wallet context: the address is public on-chain info (same thing shown in
    // the wallet UI), so VTX sees it by default. If the client didn't send one
    // but the caller is signed in, fall back to the user's saved default wallet
    // so VTX stops telling authenticated users "no wallet connected" when they
    // clearly have one on the platform.
    if (!body.context) body.context = {};
    if (!body.context.walletAddress && callerUserId) {
      try {
        const admin = getSupabaseAdmin();
        const { data: row } = await admin
          .from('user_wallets_v2')
          .select('default_address, wallets')
          .eq('user_id', callerUserId)
          .maybeSingle();
        const fallback = row?.default_address
          || (Array.isArray(row?.wallets) && row.wallets[0] && typeof (row.wallets[0] as { address?: unknown }).address === 'string'
              ? (row.wallets[0] as { address: string }).address
              : null);
        if (fallback) body.context.walletAddress = fallback;
      } catch {
        // Non-fatal — just leave walletAddress undefined.
      }
    }
    if (body.context.walletAddress && !callerUserId) {
      // Anonymous callers: don't trust client-supplied addresses as
      // "connected". Keep the value but flag it so the prompt doesn't claim
      // ownership.
    }

    // ── Rate Limiting ───────────────────────────────────────────────────────
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip') || 'unknown';

    // §13b audit fix: trust the SERVER, not the client. The body's `tier`
    // value comes from localStorage, which a malicious user can flip to
    // "pro" to bypass the daily message limit. Look it up from profiles
    // for authenticated callers; anonymous callers always count as free.
    // checkTier() also honors tier_expires_at so expired comp-Max
    // accounts auto-revert.
    let serverTier: 'free' | 'mini' | 'pro' | 'max' = 'free';
    if (callerUserId) {
      try {
        const admin = getSupabaseAdmin();
        const { data: prof } = await admin
          .from('profiles')
          .select('tier, tier_expires_at')
          .eq('id', callerUserId)
          .maybeSingle();
        if (prof) {
          const { checkTier } = await import('@/lib/subscriptions/tierCheck');
          serverTier = checkTier(prof.tier, prof.tier_expires_at, 'free').currentTier;
        }
      } catch {
        // Fall through to free; never crash the request because the
        // tier lookup hiccupped.
      }
    }
    const isPro = serverTier === 'pro' || serverTier === 'max';

    if (!isPro && !skipRateLimit) {
      const rateInfo = await getRateLimitInfo(ip);
      if (rateInfo.remaining <= 0) {
        return NextResponse.json({
          error: 'Daily message limit reached. Upgrade to Naka Pro for unlimited messages.',
          rateLimited: true,
          usage: { used: rateInfo.total, limit: rateInfo.total, remaining: 0 },
        }, { status: 429 });
      }
    }

    // ── Parse Message ───────────────────────────────────────────────────────
    const webSearchEnabled = message.includes('[WEB_SEARCH]');
    const rawMessage = message.replace('[WEB_SEARCH]', '').trim();
    const slashCmd = parseSlashCommand(rawMessage);
    const cleanMessage = slashCmd ? (slashCmd.args || rawMessage) : rawMessage;
    const commandInstruction = slashCmd?.instruction ?? null;
    const forceWebSearch = slashCmd?.forceWebSearch ?? false;

    // ── Detectors ───────────────────────────────────────────────────────────
    const walletDetected = detectWalletAddress(cleanMessage);
    const tokenDetected = detectTokenAddress(cleanMessage);
    const arkhamIntent = detectArkhamIntent(cleanMessage);
    const userChartSignal = detectChartSignal(cleanMessage);
    if (slashCmd?.command === 'chart' && !userChartSignal.chartType) {
      userChartSignal.chartType = 'price';
      userChartSignal.chartToken = cleanMessage;
    }

    // ── Pre-flight Data (parallel) ──────────────────────────────────────────
    const [marketData, fng, dexTrending, gasData] = await Promise.all([
      fetchLiveMarketContext(),
      fetchFearAndGreed(),
      fetchDexTrending(),
      fetchGasPrice(),
    ]);

    // Build live data section for system prompt
    const liveDataParts = [marketData, fng, dexTrending, gasData].filter(Boolean);
    const liveDataStr = liveDataParts.length > 0
      ? `LIVE INTELLIGENCE DATA (fetched now):\n\n${liveDataParts.join('\n\n')}`
      : '';

    // Extract market context summary for template placeholder
    const btcLine = marketData.split('\n').find(l => l.startsWith('BTC:')) ?? '';
    const ethLine = marketData.split('\n').find(l => l.startsWith('ETH:')) ?? '';
    const solLine = marketData.split('\n').find(l => l.startsWith('SOL:')) ?? '';
    const fngShort = fng.replace('Fear & Greed Index: ', '') || 'N/A';
    const market_context = [btcLine, ethLine, solLine, fngShort, gasData].filter(Boolean).join(' | ');

    // ── Style Instructions ──────────────────────────────────────────────────
    const resolvedPersonality = (personality && typeof personality === 'string' && personality.trim())
      ? personality.trim() : 'Neutral';
    const resolvedDepth = depth ?? responseStyle ?? 'Standard';
    const styleInstruction = resolvedDepth === 'Quick'
      ? 'Concise responses (1-2 paragraphs). Key data points only.'
      : resolvedDepth === 'Deep' || resolvedDepth === 'detailed'
        ? 'Comprehensive analysis with full sections. Be thorough, cover all angles.'
        : 'Balanced — structured but not exhaustive.';

    const resolvedRisk = (riskAppetite && typeof riskAppetite === 'string') ? riskAppetite : 'Balanced';
    const riskInstruction = resolvedRisk === 'Conservative'
      ? 'Emphasize downside risks. Prioritize capital preservation. Flag every red flag prominently.'
      : resolvedRisk === 'Aggressive'
        ? 'Focus on high-reward opportunities. Identify asymmetric upside. User accepts high risk.'
        : 'Present balanced view of risks and rewards.';

    const resolvedLanguage = (language && typeof language === 'string') ? language : 'English';
    const languageInstruction = resolvedLanguage !== 'English'
      ? `Respond entirely in ${resolvedLanguage}.` : '';

    const platformContextStr = context
      ? `Current Page: ${context.currentPage ?? 'Unknown'} | Token in View: ${context.currentToken ?? 'None'} | User Wallet: ${context.walletAddress ? context.walletAddress.slice(0, 8) + '...' : 'Not connected'}`
      : '';

    // ── Build System Prompt ─────────────────────────────────────────────────
    const systemPrompt = VTX_SYSTEM_PROMPT_TEMPLATE
      .replace('{personality}', resolvedPersonality)
      .replace('{market_context}', market_context || 'N/A')
      .replace('{platform_context}', platformContextStr || 'N/A')
      .replace('{style_instruction}', styleInstruction)
      .replace('{risk_instruction}', riskInstruction)
      .replace('{language_instruction}', languageInstruction)
      .replace('{live_data}', liveDataStr);

    // ── Build Message History ───────────────────────────────────────────────
    const loopMessages: Anthropic.MessageParam[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        loopMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }
    const finalUserMessage = commandInstruction
      ? `[COMMAND: /${slashCmd!.command}]\nINSTRUCTION: ${commandInstruction}\nUSER INPUT: ${cleanMessage || rawMessage}`
      : cleanMessage;
    loopMessages.push({ role: 'user', content: finalUserMessage });

    // ── Streaming Path (no tool loop) ───────────────────────────────────────
    if (wantsStream) {
      const textStream = await vtxStream({ messages: loopMessages, system: systemPrompt });
      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        async start(controller) {
          const reader = textStream.getReader();
          let fullText = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              fullText += value;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: value })}\n\n`));
            }
            // Final event with scrubbed full text
            const scrubbed = sanitizeVtxResponse(scrubBranding(fullText));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, reply: scrubbed })}\n\n`));
          } catch (streamErr) {
            console.error('[VTX-AI] Stream error:', streamErr instanceof Error ? streamErr.message : streamErr);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });
      if (!isPro && !skipRateLimit) await incrementUsage(ip);
      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ── Tool Execution Loop ─────────────────────────────────────────────────
    let finalReply = '';
    let toolIterations = 0;
    let toolsUsed: string[] = [];

    while (toolIterations < MAX_TOOL_ITERATIONS) {
      const vtxResponse = await vtxQuery({
        messages: loopMessages,
        system: systemPrompt,
      });

      if (vtxResponse.stop_reason === 'tool_use') {
        // Collect all tool_use blocks from this response
        const toolUseBlocks = vtxResponse.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            toolsUsed.push(block.name);
            const result = await executeVTXTool(block.name, block.input as Record<string, unknown>, callerUserId);
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: result,
            };
          })
        );

        // Append assistant turn (with tool_use blocks) + user turn (with tool_results)
        loopMessages.push({ role: 'assistant', content: vtxResponse.content });
        loopMessages.push({ role: 'user', content: toolResults });
        toolIterations++;
        continue;
      }

      // stop_reason === 'end_turn' — extract text
      const textBlock = vtxResponse.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );
      finalReply = textBlock?.text ?? '';
      break;
    }

    if (!finalReply) {
      finalReply = 'VTX could not generate a response. Please try again.';
    }

    // ── Post-Processing ─────────────────────────────────────────────────────
    const replyChartSignal = detectChartSignal(finalReply);
    finalReply = finalReply.replace(/\[CHART:(price|bubble|portfolio|holders)\]/gi, '').trim();
    finalReply = scrubBranding(finalReply);
    finalReply = finalReply
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/^#{1,6}\s/gm, '').replace(/^[-•]\s/gm, '').replace(/^—\s/gm, '');

    if (!isPro && !skipRateLimit) await incrementUsage(ip);

    // ── Chart Payload ───────────────────────────────────────────────────────
    const finalChartType = replyChartSignal.chartType || userChartSignal.chartType || null;
    const chartPayload = finalChartType ? {
      type: finalChartType,
      token: replyChartSignal.chartToken || userChartSignal.chartToken || undefined,
      address: tokenDetected || undefined,
    } : null;

    // ── Usage Info ──────────────────────────────────────────────────────────
    const currentUsage = isPro ? null : await getRateLimitInfo(ip);

    // ── Build token card if a specific token was discussed ─────────────────
    // Trigger on: explicit address, chart intent, OR a common symbol/name
    // mentioned by the user. The card shows live price + chart inline.
    let tokenCard: Record<string, unknown> | null = null;
    const symbolQuery = (() => {
      if (tokenDetected || chartPayload?.address) return null;
      const lower = cleanMessage.toLowerCase();
      const dollar = cleanMessage.match(/\$([A-Za-z]{2,10})\b/);
      if (dollar) return dollar[1];
      const KNOWN: Array<[RegExp, string]> = [
        [/\bbitcoin\b|\bbtc\b/, 'BTC'],
        [/\bethereum\b|\beth\b/, 'ETH'],
        [/\bsolana\b|\bsol\b/, 'SOL'],
        [/\bbnb\b|\bbinance coin\b/, 'BNB'],
        [/\bxrp\b/, 'XRP'],
        [/\busdt\b|\btether\b/, 'USDT'],
        [/\busdc\b/, 'USDC'],
        [/\bdoge(coin)?\b/, 'DOGE'],
        [/\bpepe\b/, 'PEPE'],
        [/\bshib(a)?( inu)?\b/, 'SHIB'],
        [/\bavax\b|\bavalanche\b/, 'AVAX'],
        [/\bmatic\b|\bpolygon\b/, 'MATIC'],
        [/\barbitrum\b|\barb\b/, 'ARB'],
        [/\bsui\b/, 'SUI'],
        [/\bton\b/, 'TON'],
        [/\blink\b|\bchainlink\b/, 'LINK'],
        [/\buni\b|\buniswap\b/, 'UNI'],
        [/\baave\b/, 'AAVE'],
        [/\bbonk\b/, 'BONK'],
        [/\bwif\b/, 'WIF'],
        [/\bjup\b|\bjupiter\b/, 'JUP'],
      ];
      for (const [re, sym] of KNOWN) if (re.test(lower)) return sym;
      return null;
    })();

    const cardQuery = tokenDetected || chartPayload?.address || symbolQuery;
    if (cardQuery) {
      try {
        const pairs = await searchPairs(cardQuery);
        if (pairs.length > 0) {
          // Prefer the highest-liquidity pair so we don't land on a scam fork.
          const p = [...pairs].sort(
            (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
          )[0];
          tokenCard = {
            symbol: p.baseToken.symbol,
            name: p.baseToken.name,
            address: p.baseToken.address,
            chain: p.chainId,
            price: parseFloat(p.priceUsd || '0'),
            change24h: p.priceChange?.h24 ?? 0,
            volume24h: p.volume?.h24 ?? 0,
            marketCap: p.marketCap ?? p.fdv ?? 0,
            liquidity: p.liquidity?.usd ?? 0,
            fdv: p.fdv ?? 0,
            pairAddress: p.pairAddress,
            dexId: p.dexId,
            logo: p.info?.imageUrl || null,
          };
        }
      } catch (err) {
        console.error('[vtx-ai] Token card build failed:', err);
      }
    }

    // ── Swap Card: detect swap intent and build an inline swap preview ─────
    // Patterns: "swap 0.1 eth for usdc", "swap 100 usdc to sol", "convert X for Y",
    // "trade X to Y". Shows a SwapCard with live quote + Confirm button.
    let swapCard: Record<string, unknown> | null = null;
    const swapIntent = (() => {
      const m = cleanMessage.match(
        /\b(?:swap|convert|trade|exchange)\s+([0-9]+(?:\.[0-9]+)?)\s*\$?([A-Za-z]{2,10})\s+(?:for|to|into)\s+\$?([A-Za-z]{2,10})\b/i,
      );
      if (!m) return null;
      return { amount: m[1], from: m[2].toUpperCase(), to: m[3].toUpperCase() };
    })();
    if (swapIntent) {
      try {
        const walletForSwap = body.context?.walletAddress || null;
        swapCard = {
          fromToken: swapIntent.from,
          toToken: swapIntent.to,
          fromAmount: swapIntent.amount,
          toAmount: '~',
          rate: '—',
          priceImpact: 0,
          platformFee: '0.3%',
          chain: /\b(sol|solana|bonk|wif|jup)\b/i.test(`${swapIntent.from} ${swapIntent.to}`) ? 'solana' : 'ethereum',
          walletAddress: walletForSwap,
          needsWallet: !walletForSwap,
        };
      } catch (err) {
        console.error('[vtx-ai] Swap card build failed:', err);
      }
    }

    return NextResponse.json({
      reply: finalReply,
      tier: serverTier, // §13b — return the actual server-side tier, not the client claim
      isPro,
      toolsUsed: [...new Set(toolsUsed)],
      toolIterations,
      dailyUsage: isPro ? null : {
        used: currentUsage ? currentUsage.total - currentUsage.remaining : 0,
        limit: FREE_TIER_LIMIT,
        remaining: currentUsage ? currentUsage.remaining : FREE_TIER_LIMIT,
      },
      chart: chartPayload,
      chartType: finalChartType,
      tokenCard,
      swapCard,
      ...(chartPayload ? { chartToken: chartPayload.token, chartAddress: chartPayload.address } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const isDev = process.env.NODE_ENV === 'development';
    console.error('[VTX] Error:', msg, err instanceof Error ? err.stack : '');
    Sentry.captureException(err);

    // Surface specific errors
    if (msg.includes('API key')) {
      return NextResponse.json({ error: 'AI service not configured. ANTHROPIC_API_KEY missing.' }, { status: 500 });
    }
    if (msg.includes('rate_limit') || msg.includes('429')) {
      return NextResponse.json({ error: 'AI service is busy. Please try again in a moment.' }, { status: 429 });
    }
    if (msg.includes('overloaded') || msg.includes('529')) {
      return NextResponse.json({ error: 'AI service is temporarily overloaded. Please try again shortly.' }, { status: 503 });
    }

    return NextResponse.json({
      error: isDev ? `VTX Error: ${msg}` : 'AI service temporarily unavailable. Please try again.',
    }, { status: 500 });
  }
}

// ─── Branding Scrub ───────────────────────────────────────────────────────────

function scrubBranding(text: string): string {
  return text
    .replace(/\bArkham\s*Intelligence\b/gi, 'Naka Intelligence')
    .replace(/\bArkham\b/gi, 'Naka Intelligence')
    .replace(/\bDexScreener\b/gi, 'Sargon Data Archive')
    .replace(/\bCoinGecko\b/gi, 'Sargon Data Archive')
    .replace(/\bAlchemy\b/gi, 'Naka Intelligence')
    .replace(/\bHelius\b/gi, 'Naka Intelligence')
    .replace(/\bGoPlus\b/gi, 'Naka Intelligence')
    .replace(/\bLunarCrush\b/gi, 'Naka Intelligence')
    .replace(/\bMoralis\b/gi, 'Naka Intelligence')
    .replace(/\bJupiter\b/gi, 'Naka Router');
}

function sanitizeVtxResponse(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/—/g, '-')
    .replace(/^#+\s*/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n\n\n+/g, '\n\n');
}
