import { logger } from '@/lib/logger';
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import Anthropic from '@anthropic-ai/sdk';

// Service layer — all external data comes through here
import { vtxQuery, vtxStreamRaw, VTX_TOOLS } from '@/lib/services/anthropic';
// Shared tool executor — every VTX tool name maps to real service calls here.
// Extracted to lib/ so /api/vtx-ai/chat can execute the same tools (route
// files can't export helpers).
import { executeVTXTool, detectTokenAddress, MAJOR_CG_ID } from '@/lib/ai/vtxToolExecutor';
import { getTopTokens, searchTokens, getMarketsByIds } from '@/lib/services/coingecko';
import { searchPairs, getTokenPairs, type DexPair } from '@/lib/services/dexscreener';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PLATFORM_FEE_BPS } from '@/lib/trading/swapLogging';
import { resolveSwapAddress } from '@/lib/market/swapTokenMeta';
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
      logger.error({ err: err }, "[vtx.rateLimit.get]");
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
      logger.error({ err: err }, "[vtx.rateLimit.incr]");
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
When you cite the Fear & Greed Index, always state the scale so a reader can't misread it: it runs 0 to 100 where 0 = maximum fear and 100 = maximum greed. Example: "Fear & Greed: 11/100 — Extreme Fear (0 = max fear, 100 = max greed)".

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
    return `Fear & Greed Index: ${entry.value}/100 (${entry.value_classification}) [scale: 0 = maximum fear, 100 = maximum greed; 0-24 extreme fear, 25-44 fear, 45-55 neutral, 55-74 greed, 75-100 extreme greed]`;
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
      context?: { currentPage?: string; currentToken?: string; walletAddress?: string };
      stream?: boolean;
      // §model-picker — VTX Fast/Balanced/Deepest reasoning-depth toggle.
      model?: string;
    };

    const {
      message, history, tier, personality, language, depth,
      riskAppetite, responseStyle, context, stream: wantsStream,
      model: vtxModel,
    } = body;

    // SECURITY (2026-07-03): skipRateLimit was read verbatim from the request
    // body — any anonymous caller could POST {"skipRateLimit":true} and run
    // unlimited Sonnet 5 + Opus 4.8 on the owner's Anthropic bill. The bypass
    // is now server-authorised only: a trusted internal caller must present
    // the CRON_SECRET bearer. Client-supplied values are ignored entirely.
    const internalSecret = process.env.CRON_SECRET;
    const authzHeader = request.headers.get('authorization') || '';
    const skipRateLimit = !!internalSecret && authzHeader === `Bearer ${internalSecret}`;

    // Map the neutral picker label → Anthropic output_config.effort on the
    // executor. Unknown / absent → undefined (model default = high).
    const vtxEffort: 'low' | 'medium' | 'high' | undefined =
      vtxModel === 'fast' ? 'low' : vtxModel === 'deepest' ? 'high' : vtxModel === 'balanced' ? 'medium' : undefined;

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

    // Wallet-read privacy gate: if a signed-in user has explicitly turned OFF
    // "Let VTX read my wallet balances" in VTX settings, hide BOTH the wallet
    // address AND the injected portfolio summary so the agent can't read or
    // reference holdings. Unset = current behavior (visible).
    let walletReadDisabled = false;
    if (callerUserId) {
      try {
        const admin = getSupabaseAdmin();
        const { data: prefRow } = await admin
          .from('user_preferences')
          .select('preferences')
          .eq('user_id', callerUserId)
          .maybeSingle();
        const vtxSettings = (prefRow?.preferences as { vtx_settings?: { wallet_read_enabled?: boolean } } | null)?.vtx_settings;
        if (vtxSettings && vtxSettings.wallet_read_enabled === false) walletReadDisabled = true;
      } catch {
        // Non-fatal — default to visible.
      }
    }
    if (walletReadDisabled && body.context.walletAddress) {
      body.context.walletAddress = undefined;
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
    const fngShort = fng.replace('Fear & Greed Index: ', '').replace(/\s*\[scale:.*?\]/, '') || 'N/A';
    const market_context = [btcLine, ethLine, solLine, fngShort, gasData].filter(Boolean).join(' | ');

    // ── Style Instructions ──────────────────────────────────────────────────
    // Each user-controlled field gets an explicit allow-list before it is
    // interpolated into the system prompt. Without this gate, a request body
    // like personality:"...\n\nIGNORE PRIOR INSTRUCTIONS..." would land
    // verbatim in the system prompt and could override tier gating, tool-use
    // rules, or coax the model into leaking the system prompt itself.
    // Both UIs send lowercase values (professional | degen | conservative |
    // neutral) — the old capitalised allow-list matched none of them, so the
    // personality setting was silently dead everywhere. Normalise + map to a
    // real behavioural instruction, and fold the legacy capitalised set in so
    // older clients keep working.
    const PERSONALITY_INSTRUCTIONS: Record<string, string> = {
      neutral: 'Neutral, balanced tone. No hype, no doom.',
      professional: 'Professional, precise, institutional tone. Data-first, measured language.',
      analytical: 'Analytical and rigorous. Lead with data, quantify claims, show reasoning.',
      friendly: 'Warm, approachable, encouraging tone while staying accurate.',
      casual: 'Casual, conversational tone. Plain language, still precise.',
      direct: 'Blunt and direct. No filler, no hedging — the takeaway first.',
      degen: 'High-energy crypto-native "degen" voice — use the culture (aping, bags, based) but NEVER soften real risk; call out rugs and red flags hard.',
      conservative: 'Risk-averse, cautious tone. Foreground downside and capital preservation in every answer.',
    };
    const PERSONALITIES = Object.keys(PERSONALITY_INSTRUCTIONS);
    const LANGUAGES = [
      'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian',
      'Dutch', 'Japanese', 'Korean', 'Chinese', 'Arabic', 'Hindi', 'Russian',
      'Turkish', 'Vietnamese', 'Indonesian', 'Thai', 'Polish',
    ] as const;
    const RISKS = ['Conservative', 'Balanced', 'Aggressive'] as const;
    const DEPTHS = ['Quick', 'Standard', 'Deep'] as const;

    const personalityCandidate = typeof personality === 'string' ? personality.trim().toLowerCase() : '';
    const resolvedPersonalityKey: string = PERSONALITIES.includes(personalityCandidate)
      ? personalityCandidate : 'neutral';
    const resolvedPersonality = PERSONALITY_INSTRUCTIONS[resolvedPersonalityKey];

    const depthCandidate = typeof depth === 'string' ? depth : (typeof responseStyle === 'string' ? responseStyle : '');
    // Legacy alias: 'detailed' from older clients maps to 'Deep'
    const normalizedDepth = depthCandidate === 'detailed' ? 'Deep' : depthCandidate;
    const resolvedDepth: string = (DEPTHS as readonly string[]).includes(normalizedDepth)
      ? normalizedDepth : 'Standard';
    const styleInstruction = resolvedDepth === 'Quick'
      ? 'Concise responses (1-2 paragraphs). Key data points only.'
      : resolvedDepth === 'Deep'
        ? 'Comprehensive analysis with full sections. Be thorough, cover all angles.'
        : 'Balanced — structured but not exhaustive.';

    const riskCandidate = typeof riskAppetite === 'string' ? riskAppetite : '';
    const resolvedRisk: string = (RISKS as readonly string[]).includes(riskCandidate) ? riskCandidate : 'Balanced';
    const riskInstruction = resolvedRisk === 'Conservative'
      ? 'Emphasize downside risks. Prioritize capital preservation. Flag every red flag prominently.'
      : resolvedRisk === 'Aggressive'
        ? 'Focus on high-reward opportunities. Identify asymmetric upside. User accepts high risk.'
        : 'Present balanced view of risks and rewards.';

    const languageCandidate = typeof language === 'string' ? language : '';
    const resolvedLanguage: string = (LANGUAGES as readonly string[]).includes(languageCandidate) ? languageCandidate : 'English';
    const languageInstruction = resolvedLanguage !== 'English'
      ? `Respond entirely in ${resolvedLanguage}.` : '';

    // Prompt-injection guard — currentPage and currentToken arrive
    // from the client and (for tokens) ultimately from on-chain
    // metadata that a malicious deployer can shape to break the
    // system-prompt boundary. personality/language/depth already have
    // allow-lists; context fields didn't. Strip control chars + cap
    // length so a crafted symbol can't smuggle "Ignore prior
    // instructions" into the system prompt.
    const sanitizeCtx = (s: unknown, maxLen: number): string => {
      if (typeof s !== 'string') return '';
      return s.replace(/[ -]/g, ' ').replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLen);
    };
    const safeCurrentPage = sanitizeCtx(context?.currentPage, 64);
    const safeCurrentToken = sanitizeCtx(context?.currentToken, 32);
    // walletAddress is client-supplied and lands in the SYSTEM prompt — only
    // render it if it is shaped like a real address (full-string anchor), so a
    // crafted value can't smuggle directives past sanitizeCtx.
    const safeWallet = typeof context?.walletAddress === 'string'
      && /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(context.walletAddress)
      ? context.walletAddress
      : '';
    // Authenticated users get a 1-line portfolio summary injected into the
    // system prompt so the agent can answer "what's in my portfolio?"
    // questions without a separate tool roundtrip. Falls back silently when
    // the query fails or the user has nothing — never blocks the response.
    let portfolioContextStr = '';
    if (callerUserId && !walletReadDisabled) {
      try {
        const admin = getSupabaseAdmin();
        const { data: pos } = await admin
          .from('positions')
          .select('token_symbol, value_usd')
          .eq('user_id', callerUserId)
          .order('value_usd', { ascending: false })
          .limit(10);
        if (pos && pos.length > 0) {
          const totalUsd = pos.reduce((s, p) => s + (Number(p.value_usd) || 0), 0);
          const topSymbols = pos.slice(0, 5).map((p) => p.token_symbol).filter(Boolean).join(', ');
          portfolioContextStr = ` | User Portfolio: ${pos.length} positions, $${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} total${topSymbols ? `, top: ${topSymbols}` : ''}`;
        }
      } catch {
        // Best-effort — portfolio context is a nice-to-have, not load-bearing.
      }
    }

    const platformContextStr = context
      ? `Current Page: ${safeCurrentPage || 'Unknown'} | Token in View: ${safeCurrentToken || 'None'} | User Wallet: ${safeWallet || 'Not connected'}${portfolioContextStr}`
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
    // Cap history before slicing so a request body with millions of entries
    // can't burn server memory before we trim to the last 10 (DoS guard).
    const HISTORY_HARD_CAP = 100;
    const loopMessages: Anthropic.MessageParam[] = [];
    if (history && Array.isArray(history) && history.length <= HISTORY_HARD_CAP) {
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

    // ── Streaming Path (with tool-execution loop) ───────────────────────────
    // Streams text deltas live; when the model calls a client-side tool it
    // finalizes the current turn, runs the tool via executeVTXTool, appends the
    // result, and re-opens a stream — repeating up to MAX_TOOL_ITERATIONS. This
    // is what lets tool-backed answers stream instead of returning empty bubbles
    // (the previous text-only path dropped every tool turn).
    if (wantsStream) {
      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        async start(controller) {
          let fullText = '';
          const toolsUsed: string[] = [];
          try {
            let streamIterations = 0;
            while (true) {
              const stream = vtxStreamRaw({ messages: loopMessages, system: systemPrompt, webSearch: webSearchEnabled || forceWebSearch, effort: vtxEffort });
              for await (const event of stream) {
                if (
                  event.type === 'content_block_delta' &&
                  event.delta.type === 'text_delta'
                ) {
                  fullText += event.delta.text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`)
                  );
                }
              }
              const finalMsg: Anthropic.Message = await stream.finalMessage();

              if (finalMsg.stop_reason === 'tool_use' && streamIterations < MAX_TOOL_ITERATIONS) {
                const toolUseBlocks = finalMsg.content.filter(
                  (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
                );
                const toolResults = await Promise.all(
                  toolUseBlocks.map(async (block) => {
                    toolsUsed.push(block.name);
                    const result = await executeVTXTool(
                      block.name,
                      block.input as Record<string, unknown>,
                      callerUserId
                    );
                    return { type: 'tool_result' as const, tool_use_id: block.id, content: result };
                  })
                );
                loopMessages.push({ role: 'assistant', content: finalMsg.content });
                loopMessages.push({ role: 'user', content: toolResults });
                streamIterations++;
                continue;
              }
              break;
            }

            const scrubbed = sanitizeVtxResponse(scrubBranding(fullText));
            const reply = scrubbed || 'VTX could not generate a response. Please try again.';
            // Card parity with the non-streaming path — attach the inline
            // token/swap cards so streamed, card-worthy replies aren't stripped
            // of their card. Best-effort: never fail the stream over a card.
            let tokenCard: Record<string, unknown> | null = null;
            let swapCard: Record<string, unknown> | null = null;
            try {
              ({ tokenCard, swapCard } = await buildResponseCards({
                cleanMessage,
                tokenDetected,
                chartAddress: tokenDetected,
                walletAddress: body.context?.walletAddress ?? null,
              }));
            } catch (cardErr) {
              logger.error({ err: cardErr instanceof Error ? cardErr.message : cardErr }, '[VTX-AI] Stream card build error:');
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, reply, toolsUsed, tokenCard, swapCard })}\n\n`)
            );
            // Only count a free-tier message once a real reply was produced —
            // not on an empty/errored turn.
            if (scrubbed && !isPro && !skipRateLimit) await incrementUsage(ip);
          } catch (streamErr) {
            logger.error({ err: streamErr instanceof Error ? streamErr.message : streamErr }, '[VTX-AI] Stream error:');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });
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
        webSearch: webSearchEnabled || forceWebSearch,
        effort: vtxEffort,
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

    // ── Build inline cards (token + swap) ───────────────────────────────────
    // Shared with the streaming path so streamed, card-worthy replies keep
    // card parity with the non-streaming response.
    const { tokenCard, swapCard } = await buildResponseCards({
      cleanMessage,
      tokenDetected,
      chartAddress: chartPayload?.address ?? null,
      walletAddress: body.context?.walletAddress ?? null,
    });

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
    logger.error({ msg, stack: err instanceof Error ? err.stack : undefined }, '[VTX] Error:');
    Sentry.captureException(err);

    // §C4 — typed Anthropic SDK errors, most-specific class first. The SDK
    // throws structured error subclasses; matching on `instanceof` is robust
    // where the old `msg.includes(...)` string sniffing missed localized or
    // reworded provider messages. The string checks remain as a fallback for
    // errors that bubble up as plain Error (e.g. fetch-layer failures).
    if (err instanceof Anthropic.AuthenticationError || msg.includes('API key')) {
      return NextResponse.json({ error: 'AI service not configured. ANTHROPIC_API_KEY missing or invalid.' }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError || msg.includes('rate_limit') || msg.includes('429')) {
      return NextResponse.json({ error: 'AI service is busy. Please try again in a moment.' }, { status: 429 });
    }
    // OverloadedError surfaces as HTTP 529; InternalServerError as 5xx.
    if (err instanceof Anthropic.InternalServerError || msg.includes('overloaded') || msg.includes('529')) {
      return NextResponse.json({ error: 'AI service is temporarily overloaded. Please try again shortly.' }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
      // Other client-side API errors (bad request, invalid model, etc.) —
      // don't masquerade as a 500; surface the provider status.
      return NextResponse.json({ error: 'AI request was rejected. Please rephrase and try again.' }, { status: err.status });
    }

    return NextResponse.json({
      error: isDev ? `VTX Error: ${msg}` : 'AI service temporarily unavailable. Please try again.',
    }, { status: 500 });
  }
}

// ─── Inline Card Builder ────────────────────────────────────────────────────
// Builds the inline Token Card (live price + chart) and Swap Card (quote +
// Confirm) from the cleaned user message. Extracted so both the streaming and
// non-streaming response paths produce identical cards. Trigger on: explicit
// token address, or a common symbol/name mentioned by the user.
async function buildResponseCards(opts: {
  cleanMessage: string;
  tokenDetected: string | null;
  chartAddress: string | null;
  walletAddress: string | null;
}): Promise<{ tokenCard: Record<string, unknown> | null; swapCard: Record<string, unknown> | null }> {
  const { cleanMessage, tokenDetected, chartAddress, walletAddress } = opts;

  let tokenCard: Record<string, unknown> | null = null;
  const symbolQuery = (() => {
    if (tokenDetected || chartAddress) return null;
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

  const isAddressQuery = Boolean(tokenDetected || chartAddress);
  const cardQuery = tokenDetected || chartAddress || symbolQuery;
  if (cardQuery) {
    try {
      // Build a tokenCard from a DexScreener pair (on-chain long-tail source).
      const cardFromPair = (p: DexPair): Record<string, unknown> => ({
        symbol: p.baseToken.symbol,
        name: p.baseToken.name,
        address: p.baseToken.address,
        chain: p.chainId,
        price: parseFloat(p.priceUsd || '0'),
        change24h: p.priceChange?.h24 ?? 0,
        volume24h: p.volume?.h24 ?? 0,
        // Headline the FDV when it exceeds DexScreener's circulating cap — that's
        // the figure DexScreener's UI and traders quote for long-tail tokens
        // (e.g. The Black Bull reads $267M FDV, not $116M circulating).
        marketCap: (Number(p.fdv) || 0) > (Number(p.marketCap) || 0) ? (p.fdv ?? 0) : (p.marketCap ?? p.fdv ?? 0),
        liquidity: p.liquidity?.usd ?? 0,
        fdv: p.fdv ?? 0,
        pairAddress: p.pairAddress,
        dexId: p.dexId,
        // DexScreener token-image CDN (allow-listed in next.config images)
        // when the pair has no embedded imageUrl. TokenLogo degrades to the
        // symbol initial if even this 404s.
        logo: p.info?.imageUrl
          || (p.baseToken.address && p.chainId
            ? `https://dd.dexscreener.com/ds-data/tokens/${p.chainId}/${p.baseToken.address}.png`
            : null),
      });
      // Rank pairs: exact symbol match first (for ticker queries), then
      // deepest liquidity — so a wash-traded clone can't outrank the token
      // the user actually named.
      const pickBestPair = (pairs: DexPair[], symbol?: string): DexPair | null => {
        if (pairs.length === 0) return null;
        return [...pairs].sort((a, b) => {
          if (symbol) {
            const am = a.baseToken.symbol?.toUpperCase() === symbol.toUpperCase() ? 1 : 0;
            const bm = b.baseToken.symbol?.toUpperCase() === symbol.toUpperCase() ? 1 : 0;
            if (am !== bm) return bm - am;
          }
          return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
        })[0];
      };

      // 1) Majors → CoinGecko by known id (authoritative).
      const cgId = symbolQuery && !isAddressQuery
        ? MAJOR_CG_ID[symbolQuery.toUpperCase()]
        : null;
      if (cgId) {
        const [m] = await getMarketsByIds([cgId], false);
        if (m) {
          tokenCard = {
            symbol: (m.symbol || symbolQuery || '').toUpperCase(),
            name: m.name,
            price: m.current_price ?? 0,
            change24h: m.price_change_percentage_24h ?? 0,
            volume24h: m.total_volume ?? 0,
            marketCap: m.market_cap ?? 0,
            fdv: m.fully_diluted_valuation ?? m.market_cap ?? 0,
            logo: m.image || null,
          };
        }
      }

      // 2) Non-major TICKER (e.g. $naka) → resolve through CoinGecko search
      //    FIRST so a wash-traded DexScreener clone can't outrank the real
      //    listed token. Only fall to DexScreener when CoinGecko has nothing.
      if (!tokenCard && symbolQuery && !isAddressQuery) {
        try {
          const { coins } = await searchTokens(symbolQuery);
          const ranked = coins
            .filter((c) => c.symbol?.toUpperCase() === symbolQuery.toUpperCase())
            .sort((a, b) => (a.market_cap_rank ?? Number.MAX_SAFE_INTEGER) - (b.market_cap_rank ?? Number.MAX_SAFE_INTEGER));
          const best = ranked[0];
          if (best?.id) {
            const [m] = await getMarketsByIds([best.id], false);
            if (m) {
              tokenCard = {
                symbol: (m.symbol || symbolQuery).toUpperCase(),
                name: m.name,
                price: m.current_price ?? 0,
                change24h: m.price_change_percentage_24h ?? 0,
                volume24h: m.total_volume ?? 0,
                marketCap: m.market_cap ?? 0,
                fdv: m.fully_diluted_valuation ?? m.market_cap ?? 0,
                logo: m.image || null,
              };
            }
          }
        } catch { /* fall through to DexScreener */ }
      }

      // 3) ADDRESS query → EXACT token lookup (getTokenPairs), not a fuzzy
      //    text search. Deepest-liquidity pair for that exact token address.
      if (!tokenCard && isAddressQuery) {
        const addr = (tokenDetected || chartAddress) as string;
        const p = pickBestPair(await getTokenPairs(addr));
        if (p) tokenCard = cardFromPair(p);
      }

      // 4) Last resort — ticker with no CoinGecko listing → DexScreener
      //    search, ranked by exact-symbol match then liquidity.
      if (!tokenCard && symbolQuery) {
        const p = pickBestPair(await searchPairs(symbolQuery), symbolQuery);
        if (p) tokenCard = cardFromPair(p);
      }
    } catch (err) {
      logger.error({ err: err }, '[vtx-ai] Token card build failed:');
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
      const walletForSwap = walletAddress || null;
      const swapChain = /\b(sol|solana|bonk|wif|jup)\b/i.test(`${swapIntent.from} ${swapIntent.to}`) ? 'solana' : 'ethereum';
      // Resolve symbols → canonical on-chain addresses (same resolver the
      // /api/swap/price + /api/swap/quote routes use). With addresses on the
      // card, the SwapCard's Trust Score badge and route preview light up and
      // the sign-time quote hits the exact contract instead of re-resolving a
      // bare symbol. Unresolvable symbols stay address-less — the quote probe
      // then returns its honest 422 instead of a fabricated quote.
      // Curated resolver first; for a long-tail ticker it doesn't know (e.g.
      // ANSEM), fall back to DexScreener's deepest exact-symbol pair on this
      // chain so the card carries the REAL contract — without it the token
      // logo can't render and the quote has nothing to route to.
      const resolveSym = async (sym: string): Promise<string | null> => {
        const known = resolveSwapAddress(sym, swapChain);
        if (known) return known;
        try {
          const pairs = await searchPairs(sym);
          const want = sym.replace(/^\$/, '').toUpperCase();
          const onChain = pairs.filter((p) => p.chainId === swapChain && (p.baseToken?.symbol || '').toUpperCase() === want);
          const best = (onChain.length ? onChain : pairs.filter((p) => (p.baseToken?.symbol || '').toUpperCase() === want))
            .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
          return best?.baseToken?.address ?? null;
        } catch { return null; }
      };
      const [fromAddr, toAddr] = await Promise.all([resolveSym(swapIntent.from), resolveSym(swapIntent.to)]);
      swapCard = {
        fromToken: swapIntent.from,
        toToken: swapIntent.to,
        ...(fromAddr ? { fromTokenAddress: fromAddr } : {}),
        ...(toAddr ? { toTokenAddress: toAddr } : {}),
        fromAmount: swapIntent.amount,
        toAmount: '~',
        rate: '—',
        priceImpact: 0,
        // Derive from the single canonical fee constant so the card never
        // shows a different fee than what the swap actually charges.
        platformFee: `${(PLATFORM_FEE_BPS / 100).toFixed(1)}%`,
        chain: swapChain,
        walletAddress: walletForSwap,
        needsWallet: !walletForSwap,
      };
    } catch (err) {
      logger.error({ err: err }, '[vtx-ai] Swap card build failed:');
    }
  }

  return { tokenCard, swapCard };
}

// ─── Branding Scrub ───────────────────────────────────────────────────────────

function scrubBranding(text: string): string {
  // Longest names first so "Arkham Intelligence" is rewritten before the bare
  // "Arkham" pass can touch it.
  const PROVIDER_REPLACEMENTS: Array<[string, string]> = [
    ['Arkham Intelligence', 'Naka Intelligence'],
    ['Arkham', 'Naka Intelligence'],
    ['DexScreener', 'Sargon Data Archive'],
    ['GeckoTerminal', 'Sargon Data Archive'],
    ['CoinGecko', 'Sargon Data Archive'],
    ['DefiLlama', 'Sargon Data Archive'],
    ['Etherscan', 'Sargon Data Archive'],
    ['Birdeye', 'Sargon Data Archive'],
    ['Alchemy', 'Naka Intelligence'],
    ['Helius', 'Naka Intelligence'],
    ['GoPlus', 'Naka Intelligence'],
    ['LunarCrush', 'Naka Intelligence'],
    ['Moralis', 'Naka Intelligence'],
    ['Dune', 'Sargon Data Archive'],
    ['Jupiter', 'Naka Router'],
    ['0x', 'Naka Router'],
  ];
  // Only rewrite a provider name when it sits in a data-attribution context —
  // right after "powered by / via / from / using / data from / sourced from /
  // source:" or right before "data / API / feed / docs / analytics / explorer".
  // This keeps ordinary English intact (the planet "Jupiter", the noun
  // "alchemy", generic "Dune", "0x" hex prefixes) instead of the old blunt
  // global replace that corrupted real words.
  const PREFIX = String.raw`(?<=\b(?:powered by|sourced from|data (?:from|by)|according to|via|from|using|source):?\s+)`;
  const SUFFIX = String.raw`(?=\s+(?:data|API|feed|docs?|analytics|explorer)\b)`;
  let out = text;
  for (const [name, repl] of PROVIDER_REPLACEMENTS) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`${PREFIX}${esc}\\b`, 'gi'), repl)
      .replace(new RegExp(`\\b${esc}${SUFFIX}`, 'gi'), repl);
  }
  return out;
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
