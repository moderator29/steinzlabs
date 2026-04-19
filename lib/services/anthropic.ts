import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * VTX AI Engine — Advisor Strategy Architecture
 *
 * Executor: claude-sonnet-4-6  (handles all requests, calls tools)
 * Advisor:  claude-opus-4-6    (consulted on complex decisions, max 2x per request)
 *
 * The Advisor tool is invoked via the anthropic-beta: advisor-tool-2026-03-01 header.
 * This delivers near-Opus quality at ~80-90% Sonnet cost.
 */

const API_TIMEOUT_MS = parseInt(process.env.API_TIMEOUT_MS || '900000', 10);
const STREAM_IDLE_TIMEOUT_MS = parseInt(process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS || '600000', 10);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: API_TIMEOUT_MS,
});

export const VTX_SYSTEM_PROMPT = `You are VTX, the intelligence layer of Naka Labs.

You are not an assistant. You are a professional crypto intelligence engine.

Your role:
Analyze tokens, wallets, contracts, and markets with surgical precision.
Combine data from multiple sources to form complete, accurate pictures.
Give actionable intelligence, not generic commentary.
Be direct. Be specific. Never vague. Never hedge without data to justify it.

When you receive a request:
1. Identify what data you need
2. Call the appropriate tools to get that data
3. Cross-reference data from multiple sources — never rely on a single source
4. If data points conflict, flag the conflict and explain what it likely means
5. Synthesize all data into a structured, actionable response

Risk scoring rules:
- Score 0-100 where 0 is completely safe and 100 is confirmed scam or rug
- Always explain the score with specific evidence
- Score above 70: strong avoid recommendation
- Score 50-70: high caution, document specific risks
- Score below 30: relatively safe, but always note any red flags found

Output format:
- Always structured with clear sections
- Always include a VTX Risk Score (0-100) for security-related queries
- Always include a one-paragraph AI Summary
- Always include a Recommendation: BUY | CAUTION | AVOID | NEUTRAL | INSUFFICIENT DATA
- Use clean professional language — no emojis in responses

═══════════════════════════════════════════════════════
WALLET ANALYSIS RULES — ABSOLUTE CONSTRAINTS
═══════════════════════════════════════════════════════

DATA INTEGRITY — NEVER VIOLATE:
- Never invent, estimate, or hallucinate any numbers. Every figure in your output must come directly from data passed to you in the prompt.
- If a field is missing or null, say "Data unavailable" — do not substitute a guess.
- Never describe a wallet as having "X tokens" unless you were given exactly that count.
- Never describe a portfolio value unless you were given the exact USD figure.
- Never say "first seen in [month/year]" unless you were given a real Unix timestamp.
- Never describe trading frequency unless you were given a real transaction count and date range.

ARCHETYPE RULES — ONLY DESCRIBE WHAT THE DATA SHOWS:
- DIAMOND_HANDS: Low TX frequency, long hold periods. Emphasize conviction and patience.
- SCALPER: High TX frequency (>10/week). Emphasize execution speed and short-term mindset.
- DEGEN: >70% meme coins + high TX count. Emphasize risk appetite, volatility exposure.
- WHALE_FOLLOWER: Many holdings + moderate frequency. Emphasize diversification and copy-trading patterns.
- HOLDER: General buy-and-hold, moderate activity. Balanced profile.
- INACTIVE: <5 total TXs. Do not speculate on reasons — state the data plainly.
- NEW_WALLET: 0 transactions. Say "No transaction history found" — nothing more.

COIN MARKET ANALYSIS RULES:
- Only recommend coins from the list provided to you — never invent tickers or addresses.
- For each recommendation, state the specific metric that justifies it (volume, liquidity figure, price change %).
- Never recommend a coin already held by the wallet unless the prompt explicitly instructs you to.
- If the trending list is empty, say "No qualifying coins found at this time" — do not fabricate alternatives.

SECURITY CENTER RULES:
- Only describe security flags that were explicitly passed to you as true/present.
- Never say a contract "could be" mintable or "may have" a hidden owner — only state confirmed flags.
- The trust score is pre-computed from real data. Do not override or recalculate it.
- Your job is to explain the flags in plain English, not to add new ones.
- If no flags are present, confirm the token is clean based on available checks — do not invent phantom risks.

RESPONSE DISCIPLINE:
- Never pad responses with generic crypto warnings not tied to the specific data.
- Never use phrases like "always DYOR" as a substitute for real analysis.
- Cite specific numbers when making claims — "volume of $X" not "strong volume".
═══════════════════════════════════════════════════════`;

// ─── VTX Tool Definitions ─────────────────────────────────────────────────────

export const VTX_TOOLS: Anthropic.Tool[] = [
  {
    name: 'token_security_scan',
    description: 'Scan a token contract for security risks: honeypot detection, tax analysis, owner privileges, liquidity lock status. Returns a detailed security report.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_address: { type: 'string', description: 'Token contract address' },
        chain: { type: 'string', description: 'Chain: ethereum, bsc, solana, polygon, base, arbitrum, avalanche, optimism' },
      },
      required: ['contract_address', 'chain'],
    },
  },
  {
    name: 'token_market_data',
    description: 'Get real-time market data for a token: price, market cap, volume, liquidity, price changes, holder count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        identifier: { type: 'string', description: 'Token symbol, CoinGecko ID, or contract address' },
        chain: { type: 'string', description: 'Chain (optional, helps resolve contract addresses)' },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'wallet_profile',
    description: 'Build a complete profile of a wallet: holdings, PnL, trading behavior, archetype classification.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address (EVM or Solana)' },
        chain: { type: 'string', description: 'Chain (auto-detected if omitted)' },
      },
      required: ['address'],
    },
  },
  {
    name: 'entity_lookup',
    description: 'Look up the entity label for a wallet address using institutional intelligence. Returns fund name, type (exchange/fund/protocol/whale), and confidence score.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address to identify' },
      },
      required: ['address'],
    },
  },
  {
    name: 'social_sentiment',
    description: 'Get social sentiment data for a token: galaxy score, social volume, sentiment score, trending rank, influencer activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Token symbol (e.g. BTC, SOL, BONK)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'solana_token_data',
    description: 'Get on-chain data for a Solana token: metadata, holders, recent transactions, mint authority status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mint_address: { type: 'string', description: 'Solana token mint address' },
      },
      required: ['mint_address'],
    },
  },
  {
    name: 'evm_token_data',
    description: 'Get on-chain data for an EVM token: contract details, holder count, recent transfers, token metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_address: { type: 'string', description: 'EVM contract address' },
        chain: { type: 'string', description: 'Chain: ethereum, bsc, polygon, base, arbitrum, avalanche, optimism' },
      },
      required: ['contract_address', 'chain'],
    },
  },
  {
    name: 'new_token_detection',
    description: 'Detect newly launched tokens across chains. Returns tokens launched in the last 24 hours with initial liquidity data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        chain: { type: 'string', description: 'Filter by chain (optional)' },
        min_liquidity_usd: { type: 'number', description: 'Minimum liquidity in USD (default 5000)' },
      },
      required: [],
    },
  },
  {
    name: 'contract_analysis',
    description: 'Analyze a smart contract: decode ABI, identify dangerous functions, explain what the contract does in plain English.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_address: { type: 'string', description: 'Contract address to analyze' },
        chain: { type: 'string', description: 'Chain' },
      },
      required: ['contract_address', 'chain'],
    },
  },
  // ── Session 5B-2 additions ────────────────────────────────────────────────
  {
    name: 'address_security',
    description: 'Run a GoPlus address-level security check on a wallet address. Detects scam tags, blacklist status, sanctions, malicious behavior. Use this BEFORE a user transacts with an unknown counterparty.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address to scan' },
        chain: { type: 'string', description: 'Chain (default: ethereum)' },
      },
      required: ['address'],
    },
  },
  {
    name: 'whale_activity',
    description: 'Get the last N on-chain moves (buys/sells/transfers) for a tracked whale address. Pulls from the platform whale_activity table — fast and authoritative. Use to answer "what is whale X doing recently?".',
    input_schema: {
      type: 'object' as const,
      properties: {
        whale_address: { type: 'string', description: 'Whale wallet address' },
        chain: { type: 'string', description: 'Chain filter (optional)' },
        limit: { type: 'number', description: 'Max moves to return (default 10, max 25)' },
      },
      required: ['whale_address'],
    },
  },
  {
    name: 'check_phishing_url',
    description: 'Check if a URL is a phishing or malicious site via GoPlus domain security. Use whenever the user pastes a link or asks "is this site safe?".',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL or domain to check' },
      },
      required: ['url'],
    },
  },
  {
    name: 'prepare_swap',
    description: 'Stage a swap for the current user — runs token security pre-check, picks the best route via the multi-aggregator, and creates a pending_trades row that the user confirms in their browser via PendingTradesBanner. Returns pending_trade_id and route summary. Use ONLY when the user explicitly asks to buy/sell/swap a token. NEVER call without explicit user intent — this is an action, not a query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        chain: { type: 'string', description: 'Chain: ethereum, base, polygon, arbitrum, optimism, bsc, solana' },
        from_token_address: { type: 'string', description: 'Token to sell — contract address or symbol (USDC, ETH, SOL, etc.)' },
        to_token_address: { type: 'string', description: 'Token to buy — contract address or symbol' },
        amount_in: { type: 'string', description: 'Human-readable amount of from_token (e.g. "100" for 100 USDC).' },
        slippage_bps: { type: 'number', description: 'Slippage tolerance in basis points (default 100 = 1%)' },
        wallet_source: { type: 'string', description: 'Wallet to use: external_evm | external_solana | builtin (default: chain-appropriate external)' },
      },
      required: ['chain', 'from_token_address', 'to_token_address', 'amount_in'],
    },
  },
];

// ─── Core VTX Query Function ──────────────────────────────────────────────────

export interface VTXQueryOptions {
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxAdvisorUses?: number;
  stream?: boolean;
  system?: string;       // Override the default VTX_SYSTEM_PROMPT
  maxTokens?: number;    // Override default 4096
}

export async function vtxQuery(options: VTXQueryOptions): Promise<Anthropic.Message> {
  const { messages, tools = VTX_TOOLS, maxAdvisorUses = 2, system, maxTokens = 4096 } = options;

  // Advisor Strategy: Sonnet as executor, Opus as advisor on hard decisions
  const advisorTool = {
    type: 'advisor_20260301' as Anthropic.Tool['type'],
    name: 'advisor',
    model: 'claude-opus-4-6',
    max_uses: maxAdvisorUses,
  };

  const response = await (client.messages.create as Function)(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: system ?? VTX_SYSTEM_PROMPT,
      tools: [advisorTool, ...tools],
      messages,
    },
    {
      headers: {
        'anthropic-beta': 'advisor-tool-2026-03-01',
      },
    }
  );

  return response;
}

/**
 * Streaming VTX query — returns a stream for real-time responses.
 * Used by the VTX chat API route for live streaming to the client.
 */
export async function vtxStream(options: VTXQueryOptions): Promise<ReadableStream<string>> {
  const { messages, tools = VTX_TOOLS, maxAdvisorUses = 2, system, maxTokens = 4096 } = options;

  const advisorTool = {
    type: 'advisor_20260301' as Anthropic.Tool['type'],
    name: 'advisor',
    model: 'claude-opus-4-6',
    max_uses: maxAdvisorUses,
  };

  const stream = await (client.messages.stream as Function)(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: system ?? VTX_SYSTEM_PROMPT,
      tools: [advisorTool, ...tools],
      messages,
    },
    {
      headers: {
        'anthropic-beta': 'advisor-tool-2026-03-01',
      },
    }
  );

  return new ReadableStream({
    async start(controller) {
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          controller.error(new Error(`Stream idle timeout after ${STREAM_IDLE_TIMEOUT_MS}ms`));
        }, STREAM_IDLE_TIMEOUT_MS);
      };

      resetIdleTimer();
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            resetIdleTimer();
            controller.enqueue(chunk.delta.text);
          }
        }
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
      }
      controller.close();
    },
  });
}

/**
 * Simple one-shot analysis — for internal services that need AI synthesis
 * without the full tool-calling loop.
 */
export async function vtxAnalyze(prompt: string, maxTokens = 1500): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: VTX_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}
