import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { DUNE_TOOLS } from '@/lib/ai/vtxToolsDune';

/**
 * VTX AI Engine — Advisor Strategy Architecture
 *
 * Executor: claude-sonnet-4-6  (handles all requests, calls tools)
 * Advisor:  claude-opus-4-8    (consulted on complex decisions, max 2x per request)
 *
 * The Advisor tool is invoked via the anthropic-beta: advisor-tool-2026-03-01 header.
 * This delivers near-Opus quality at ~80-90% Sonnet cost.
 *
 * IMPORTANT — advisor pairing: the advisor model must be at least as capable as
 * the executor. For a claude-sonnet-4-6 executor the ONLY valid advisors are
 * claude-opus-4-8 / claude-opus-4-7; claude-opus-4-6 is rejected with HTTP 400
 * (this was the cause of every VTX advisor call silently failing).
 */

const API_TIMEOUT_MS = parseInt(process.env.API_TIMEOUT_MS || '900000', 10);
const STREAM_IDLE_TIMEOUT_MS = parseInt(process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS || '600000', 10);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: API_TIMEOUT_MS,
});

// VTX model configuration.
// The advisor tool requires an advisor model at least as capable as the
// executor. For a claude-sonnet-4-6 executor the only valid advisors are
// claude-opus-4-8 / claude-opus-4-7 — claude-opus-4-6 is rejected with HTTP 400.
const VTX_EXECUTOR_MODEL = 'claude-sonnet-4-6';
const VTX_ADVISOR_MODEL = 'claude-opus-4-8';
const ADVISOR_BETA = 'advisor-tool-2026-03-01';

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

import { P2B_TOOLS } from '@/lib/ai/vtxToolsP2B';

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
    name: 'whale_profile',
    description: 'Look up a tracked whale in our directory. Returns name/label, entity_type (trader/exchange/VC/dev), 30d and 7d PnL in USD, win rate, trade count (30d), portfolio USD value, whale score (0-100), follower count, verified status, last_active_at, and x_handle if linked. Use for questions like "who is whale X?", "what is Vitalik\'s PnL?", "how many whales are tracked?", "show me top 10 whales by portfolio". When action=list, filters by chain/entity_type/min_portfolio and returns ranked results. When action=get, returns one whale by address. Tier-gated: Pro+ only for content; Free/Mini get an upgrade prompt.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'list'],
          description: 'get = single whale by address · list = top whales with filters',
        },
        address: { type: 'string', description: 'Whale wallet address (required for action=get)' },
        chain: { type: 'string', description: 'Chain filter: ethereum, base, bsc, polygon, arbitrum, optimism, solana' },
        entity_type: { type: 'string', description: 'Filter: trader, influencer, dev, exchange, institutional, fund, vc' },
        min_portfolio_usd: { type: 'number', description: 'Minimum portfolio USD to include (action=list)' },
        sort: {
          type: 'string',
          enum: ['portfolio', 'pnl_30d', 'trade_count_30d', 'win_rate', 'score'],
          description: 'Ranking for action=list (default: portfolio)',
        },
        limit: { type: 'number', description: 'Max results for action=list (default 10, max 25)' },
      },
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
  {
    name: 'coingecko_market_data',
    description: 'Get authoritative real-time market data from CoinGecko: live prices, market cap, 24h volume, trending coins, side-by-side coin comparisons, and price-history charts. ALWAYS use this for "what is the price of X" / "what is X market cap" / "what is trending right now" / "compare X and Y" queries — your training data is stale. Falls back to Alchemy/DexScreener via other tools when CoinGecko does not index a token. Coin ids are CoinGecko slugs (bitcoin, ethereum, solana, jupiter-exchange-solana, etc.) — if unsure, call action="search" first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['get_coin', 'get_trending', 'search', 'compare_coins', 'get_chart', 'get_top_gainers'],
          description: 'get_coin = full detail for one coin · get_trending = current trending list · search = find a coin by name/ticker · compare_coins = side-by-side stats for 2-5 coins · get_chart = price history (set days) · get_top_gainers = biggest 24h movers',
        },
        coinId: { type: 'string', description: 'CoinGecko slug for get_coin / get_chart (e.g. "bitcoin")' },
        coinIds: { type: 'array', items: { type: 'string' }, description: 'Array of CoinGecko slugs for compare_coins' },
        query: { type: 'string', description: 'Search query for action="search"' },
        days: { type: 'number', description: 'Days of price history for get_chart (default 7, max 365)' },
        limit: { type: 'number', description: 'Result count cap for trending / top_gainers (default 10)' },
      },
      required: ['action'],
    },
  },
  // §3 P2-B — 10 new tools (whale_tracker_specific, realized_pnl_30d,
  // cross_token_comparison, portfolio_performance,
  // portfolio_rebalance_suggestion, alert_subscribe, copy_trade_create,
  // explain_transaction, transaction_simulator, approval_audit) sourced
  // from lib/ai/vtxToolsP2B.ts.
  ...P2B_TOOLS,
  // §5 Dune Analytics tier-1 + tier-2 tools (17 total) from
  // lib/ai/vtxToolsDune. Handlers read materialized tables populated by
  // the dune-refresh cron — VTX latency stays low even though Dune
  // queries themselves take seconds-to-minutes.
  ...DUNE_TOOLS,
];

// ─── Core VTX Query Function ──────────────────────────────────────────────────

export interface VTXQueryOptions {
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxAdvisorUses?: number;
  stream?: boolean;
  system?: string;       // Override the default VTX_SYSTEM_PROMPT
  maxTokens?: number;    // Override default 4096
  // §C4 — when the client sends the [WEB_SEARCH] flag, attach Anthropic's
  // hosted web_search server tool so VTX can pull live information past its
  // training cutoff. The flag was parsed by the route but never wired to a
  // tool, so toggling it did nothing.
  webSearch?: boolean;
}

// Hosted web-search server tool. The `_20260209` variant (dynamic filtering)
// is the right version for the Sonnet 4.6 executor; results return inline as
// `web_search_tool_result` blocks — no client-side execution loop needed, so
// it composes with the existing advisor/custom-tool loop. Inserted BEFORE the
// custom tools so a cacheable custom tool stays the cache breakpoint.
const WEB_SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search' } as unknown as Anthropic.Tool;

function withWebSearch(tools: Anthropic.Tool[], enabled?: boolean): Anthropic.Tool[] {
  return enabled ? [WEB_SEARCH_TOOL, ...tools] : tools;
}

/**
 * §13b: Wrap a system prompt + tool list with Anthropic ephemeral
 * prompt-cache breakpoints. Cuts ~80% off the input-token cost of every
 * repeat VTX request because the system prompt (~8KB) and the tools
 * array (~12KB) are stable across turns. The cache lives 5 minutes by
 * default — well-suited to chat where users send several messages in a
 * row. We mark the system as an array with cache_control on the last
 * (only) block, and put cache_control on the LAST tool so everything
 * before it lands in the cached prefix.
 *
 * Docs: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */
function buildCachedSystem(system: string): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
  return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
}

function tagToolsForCache(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  if (tools.length === 0) return tools;
  // Mark only the last tool — Anthropic caches everything up to and
  // including the cache_control breakpoint, so a single tag covers
  // the whole tool array as the cached prefix. cache_control is a
  // first-class field on Anthropic.Tool in current SDK versions, so
  // no type assertion is needed here.
  const head = tools.slice(0, -1);
  const last = tools[tools.length - 1];
  return [...head, { ...last, cache_control: { type: 'ephemeral' } }];
}

export async function vtxQuery(options: VTXQueryOptions): Promise<Anthropic.Message> {
  const { messages, tools = VTX_TOOLS, maxAdvisorUses = 2, system, maxTokens = 4096, webSearch } = options;

  // Advisor Strategy: Sonnet as executor, Opus as advisor on hard decisions
  const advisorTool = {
    type: 'advisor_20260301' as Anthropic.Tool['type'],
    name: 'advisor',
    model: VTX_ADVISOR_MODEL,
    max_uses: maxAdvisorUses,
  };

  const response = await (client.messages.create as Function)(
    {
      model: VTX_EXECUTOR_MODEL,
      max_tokens: maxTokens,
      system: buildCachedSystem(system ?? VTX_SYSTEM_PROMPT),
      tools: tagToolsForCache([advisorTool, ...withWebSearch(tools, webSearch)] as Anthropic.Tool[]),
      messages,
    },
    {
      headers: {
        'anthropic-beta': ADVISOR_BETA,
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
  const { messages, tools = VTX_TOOLS, maxAdvisorUses = 2, system, maxTokens = 4096, webSearch } = options;

  const advisorTool = {
    type: 'advisor_20260301' as Anthropic.Tool['type'],
    name: 'advisor',
    model: VTX_ADVISOR_MODEL,
    max_uses: maxAdvisorUses,
  };

  const stream = await (client.messages.stream as Function)(
    {
      model: VTX_EXECUTOR_MODEL,
      max_tokens: maxTokens,
      // §13b: same prompt-cache wrapping as vtxQuery — keeps streaming
      // and non-streaming paths on the same cached prefix.
      system: buildCachedSystem(system ?? VTX_SYSTEM_PROMPT),
      tools: tagToolsForCache([advisorTool, ...withWebSearch(tools, webSearch)] as Anthropic.Tool[]),
      messages,
    },
    {
      headers: {
        'anthropic-beta': ADVISOR_BETA,
      },
    }
  );

  return new ReadableStream({
    async start(controller) {
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let firstDeltaAt: number | null = null;
      let totalDeltas = 0;
      const startedAt = Date.now();

      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          // §vtx-no-response observability: log the failure mode so we can
          // tell idle-timeout from API-error from rate-limit in prod logs.
          console.error('[vtxStream] idle timeout', {
            elapsedMs: Date.now() - startedAt,
            firstDeltaAt,
            totalDeltas,
            timeoutMs: STREAM_IDLE_TIMEOUT_MS,
          });
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
            if (firstDeltaAt === null) firstDeltaAt = Date.now() - startedAt;
            totalDeltas++;
            resetIdleTimer();
            controller.enqueue(chunk.delta.text);
          }
        }
        // Empty completion (no text deltas at all) is the silent-no-reply
        // failure mode the owner reported. Log so it's visible.
        if (totalDeltas === 0) {
          console.error('[vtxStream] completed with 0 text deltas', {
            elapsedMs: Date.now() - startedAt,
          });
        }
      } catch (err) {
        console.error('[vtxStream] stream errored', {
          elapsedMs: Date.now() - startedAt,
          firstDeltaAt,
          totalDeltas,
          err: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
      }
      controller.close();
    },
  });
}

/**
 * Raw streaming VTX query — returns the SDK MessageStream so callers can BOTH
 * forward text deltas live AND inspect finalMessage() to drive a tool-execution
 * loop. `vtxStream` above wraps a text-only ReadableStream for callers that
 * don't run tools; the main /api/vtx-ai route uses this to stream tool-backed
 * answers instead of returning empty replies.
 */
export function vtxStreamRaw(options: VTXQueryOptions): ReturnType<typeof client.messages.stream> {
  const { messages, tools = VTX_TOOLS, maxAdvisorUses = 2, system, maxTokens = 4096, webSearch } = options;

  const advisorTool = {
    type: 'advisor_20260301' as Anthropic.Tool['type'],
    name: 'advisor',
    model: VTX_ADVISOR_MODEL,
    max_uses: maxAdvisorUses,
  };

  return (client.messages.stream as Function)(
    {
      model: VTX_EXECUTOR_MODEL,
      max_tokens: maxTokens,
      system: buildCachedSystem(system ?? VTX_SYSTEM_PROMPT),
      tools: tagToolsForCache([advisorTool, ...withWebSearch(tools, webSearch)] as Anthropic.Tool[]),
      messages,
    },
    {
      headers: {
        'anthropic-beta': ADVISOR_BETA,
      },
    }
  ) as ReturnType<typeof client.messages.stream>;
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
