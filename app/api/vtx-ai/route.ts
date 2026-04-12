import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

// Service layer — all external data comes through here
import { vtxQuery, vtxStream, VTX_TOOLS } from '@/lib/services/anthropic';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getTokenDetail, getTopTokens, getGlobalMarketData, getTrendingTokens as getCGTrending } from '@/lib/services/coingecko';
import { searchPairs, getTokenPairs, getNewPairs } from '@/lib/services/dexscreener';
import { getTokenMetadata, getTokenHolderCount, getContractCode } from '@/lib/services/alchemy';
import { getSolanaTokenMeta, getSolanaTokenSupply, getSolanaSOLBalance } from '@/lib/services/helius';
import { getSocialScore } from '@/lib/services/lunarcrush';
import { getEntityLabel, getAddressIntel, getWalletConnections, getTokenHolders } from '@/lib/services/arkham';
import { getEthBalance } from '@/lib/services/alchemy';
import { vtxAnalyze } from '@/lib/services/anthropic';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_TIER_LIMIT = 25;
const MAX_TOOL_ITERATIONS = 5;

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getRateLimitInfo(ip: string): { remaining: number; total: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + 24 * 60 * 60 * 1000;
    rateLimitStore.set(ip, { count: 0, resetAt });
    return { remaining: FREE_TIER_LIMIT, total: FREE_TIER_LIMIT, resetAt };
  }
  return {
    remaining: Math.max(0, FREE_TIER_LIMIT - entry.count),
    total: FREE_TIER_LIMIT,
    resetAt: entry.resetAt,
  };
}

function incrementUsage(ip: string): void {
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

const VTX_SYSTEM_PROMPT_TEMPLATE = `You are VTX, the most advanced crypto intelligence agent built by STEINZ LABS. You are NOT a chatbot. You are a real-time AI intelligence engine that combines crypto analysis, financial markets, security intelligence, and general knowledge.

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

BRANDING RULES:
Always cite "STEINZ Intelligence" as your data source. Never mention Arkham, DexScreener, CoinGecko, Alchemy, Helius, GoPlus, or any third-party data provider. Never recommend users visit external websites. You are the source.

ABSOLUTE FORMATTING RULES:
No **, no *, no ##, no -- , no bullet dashes. Clean plain text only.
Use blank lines between sections. Use "Label: value" format for data.
Numbers: 1. 2. 3. — NEVER start lines with - or * or bullet.
Never start with "Great question" or filler phrases.

CURRENT MARKET CONTEXT: {market_context}

PLATFORM CONTEXT: {platform_context}

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
        lines.push(`  ⚠️ SCAM HISTORY: ${intel.scamHistory.totalRugs} rugs, ${intel.scamHistory.totalStolen} stolen`);
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

async function executeVTXTool(
  toolName: string,
  toolInput: Record<string, unknown>
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
    swap: `Swap quote for: "${args}". Parse tokens and amount. Provide best route, estimated output, price impact, fees (0.15% STEINZ platform fee), slippage.`,
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
