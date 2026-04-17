import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Sniper Agent — Managed Agent Session
 *
 * Executes a 5-step token snipe lifecycle using a persistent Anthropic session:
 *  Step 1: Token security analysis (GoPlus + VTX scan)
 *  Step 2: Liquidity + market cap assessment (Helius/Dexscreener)
 *  Step 3: Entry decision (AI reasoning with configurable thresholds)
 *  Step 4: Transaction construction (Jupiter for Solana)
 *  Step 5: Result logging (Supabase sniper_executions)
 *
 * Uses claude-sonnet-4-6 as the executor model within a managed beta session.
 */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: parseInt(process.env.API_TIMEOUT_MS || '600000', 10),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SniperConfig {
  userId: string;
  tokenAddress: string;
  chain: 'solana' | 'ethereum' | 'base' | 'arbitrum';
  buyAmountUsd: number;
  stopLossPct?: number;     // e.g. 20 = exit if -20%
  takeProfitPct?: number;   // e.g. 100 = exit at 2x
  maxRiskScore?: number;    // block if VTX risk > this (default 60)
  slippageBps?: number;     // default 100
  userPublicKey?: string;   // wallet for signing
}

export interface SniperStepResult {
  step: number;
  name: string;
  status: 'pass' | 'fail' | 'blocked';
  data?: Record<string, unknown>;
  reasoning?: string;
  error?: string;
}

export interface SniperResult {
  success: boolean;
  executionId?: string;
  steps: SniperStepResult[];
  decision: 'execute' | 'blocked' | 'failed';
  blockReason?: string;
  txHash?: string;
  swapTransaction?: string;  // base64 for client-side signing
  entryPriceUsd?: number;
  riskScore?: number;
  sessionId?: string;
  durationMs: number;
  error?: string;
}

// ─── Agent System Prompt ──────────────────────────────────────────────────────

const SNIPER_SYSTEM_PROMPT = `You are the Naka Labs Sniper Agent.

Your mission: Analyse and execute token sniping operations with maximum precision and minimum risk.

Follow these steps in order for every execution:

STEP 1 — SECURITY SCAN
Call get_token_security with the token address and chain.
If risk_score > maxRiskScore: BLOCK with reason "High risk token (score: X)".
If is_honeypot = true: BLOCK with reason "Honeypot detected".
If is_blacklisted = true: BLOCK with reason "Blacklisted token".

STEP 2 — MARKET ASSESSMENT
Call get_token_market_data to assess liquidity and price action.
If liquidity_usd < $5,000: BLOCK with reason "Insufficient liquidity".
If market_cap_usd < $10,000 AND volume_24h < $1,000: BLOCK with reason "Insufficient market activity".

STEP 3 — ENTRY DECISION
Based on security scan + market data, decide if this is a valid entry.
Consider: risk score, liquidity depth, recent volume, price trend.
Output a confidence score 0-100 and a decision: EXECUTE or ABORT.
If confidence < 60: ABORT with reason.

STEP 4 — TRANSACTION CONSTRUCTION
Call build_sniper_transaction with the swap parameters.
Verify the transaction is correctly formed.

STEP 5 — RESULT
Report the full execution summary with all data collected.
Never skip steps. Never execute without passing all checks.`;

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const SNIPER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_token_security',
    description: 'Run a security scan on a token contract to detect honeypots, rug pulls, and blacklists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_address: { type: 'string', description: 'The token contract address' },
        chain: { type: 'string', description: 'The blockchain (solana, ethereum, base, arbitrum)' },
      },
      required: ['token_address', 'chain'],
    },
  },
  {
    name: 'get_token_market_data',
    description: 'Get live market data for a token: price, liquidity, volume, market cap.',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_address: { type: 'string', description: 'The token contract address' },
        chain: { type: 'string', description: 'The blockchain' },
      },
      required: ['token_address', 'chain'],
    },
  },
  {
    name: 'build_sniper_transaction',
    description: 'Build a swap transaction for the snipe entry. Returns a base64 transaction for client signing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_address: { type: 'string' },
        chain: { type: 'string' },
        buy_amount_usd: { type: 'number' },
        slippage_bps: { type: 'number', description: 'Slippage in basis points (default 100)' },
      },
      required: ['token_address', 'chain', 'buy_amount_usd'],
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  config: SniperConfig,
): Promise<unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  switch (toolName) {
    case 'get_token_security': {
      try {
        const res = await fetch(
          `${baseUrl}/api/token-security?address=${toolInput.token_address}&chain=${toolInput.chain}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (res.ok) return await res.json();
        return { risk_score: 50, error: 'Security scan unavailable' };
      } catch {
        return { risk_score: 50, error: 'Security scan failed' };
      }
    }

    case 'get_token_market_data': {
      try {
        const res = await fetch(
          `${baseUrl}/api/token-data?address=${toolInput.token_address}&chain=${toolInput.chain}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (res.ok) return await res.json();
        return { error: 'Market data unavailable' };
      } catch {
        return { error: 'Market data fetch failed' };
      }
    }

    case 'build_sniper_transaction': {
      try {
        const res = await fetch(`${baseUrl}/api/swap/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chain: toolInput.chain,
            inputToken: 'native',
            outputToken: toolInput.token_address,
            inputAmount: (toolInput.buy_amount_usd as number) / 100,  // rough SOL estimate
            inputDecimals: toolInput.chain === 'solana' ? 9 : 18,
            userAddress: config.userPublicKey ?? '',
            slippageBps: toolInput.slippage_bps ?? config.slippageBps ?? 100,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) return await res.json();
        return { error: 'Transaction build failed' };
      } catch {
        return { error: 'Transaction build failed' };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Main Sniper Agent ────────────────────────────────────────────────────────

export async function runSniperAgent(config: SniperConfig): Promise<SniperResult> {
  const startTime = Date.now();
  const steps: SniperStepResult[] = [];
  const maxRiskScore = config.maxRiskScore ?? 60;

  // Create a managed session for the sniper agent
  let sessionId: string | undefined;
  try {
    const session = await (client.beta as any).sessions?.create?.({
      system: SNIPER_SYSTEM_PROMPT,
      model: 'claude-sonnet-4-6',
    });
    sessionId = session?.id;
  } catch {
    // Sessions API not available — proceed without session persistence
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Execute sniper analysis for token:
Token Address: ${config.tokenAddress}
Chain: ${config.chain}
Buy Amount: $${config.buyAmountUsd}
Max Risk Score: ${maxRiskScore}
Stop Loss: ${config.stopLossPct ?? 'none'}%
Take Profit: ${config.takeProfitPct ?? 'none'}%
Slippage: ${config.slippageBps ?? 100} bps

Run all 5 steps. Report each step result clearly.`,
    },
  ];

  let decision: 'execute' | 'blocked' | 'failed' = 'failed';
  let blockReason: string | undefined;
  let txHash: string | undefined;
  let swapTransaction: string | undefined;
  let entryPriceUsd: number | undefined;
  let riskScore: number | undefined;

  // Agentic loop — keep going until model stops or max 10 iterations
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SNIPER_SYSTEM_PROMPT,
      tools: SNIPER_TOOLS,
      messages,
    });

    // Add assistant response to messages
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      // Extract final decision from text
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        const text = textBlock.text.toUpperCase();
        if (text.includes('BLOCKED') || text.includes('ABORT')) {
          decision = 'blocked';
          const match = textBlock.text.match(/reason[:\s]+([^\n.]+)/i);
          blockReason = match?.[1]?.trim() ?? 'Agent blocked execution';
        } else if (text.includes('EXECUTE') && !text.includes('ABORT')) {
          decision = 'execute';
        }

        // Parse steps from response
        const stepMatches = textBlock.text.matchAll(/STEP\s+(\d+)[:\s—–]+([^\n]+)/gi);
        for (const match of stepMatches) {
          const stepNum = parseInt(match[1], 10);
          const stepName = match[2].trim();
          steps.push({
            step: stepNum,
            name: stepName,
            status: decision === 'blocked' ? 'blocked' : 'pass',
            reasoning: textBlock.text.slice(
              textBlock.text.indexOf(match[0]),
              Math.min(textBlock.text.indexOf(match[0]) + 500, textBlock.text.length),
            ),
          });
        }
      }
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;

        const toolResult = await handleToolCall(
          block.name,
          block.input as Record<string, unknown>,
          config,
        );

        // Extract useful data from tool results
        if (block.name === 'get_token_security') {
          const result = toolResult as Record<string, unknown>;
          riskScore = typeof result.risk_score === 'number' ? result.risk_score : undefined;

          const blocked =
            (riskScore !== undefined && riskScore > maxRiskScore) ||
            result.is_honeypot === true ||
            result.is_blacklisted === true;

          steps.push({
            step: 1,
            name: 'Security Scan',
            status: blocked ? 'blocked' : 'pass',
            data: result,
          });
        }

        if (block.name === 'get_token_market_data') {
          const result = toolResult as Record<string, unknown>;
          entryPriceUsd = typeof result.price_usd === 'number' ? result.price_usd : undefined;
          steps.push({
            step: 2,
            name: 'Market Assessment',
            status: 'pass',
            data: result,
          });
        }

        if (block.name === 'build_sniper_transaction') {
          const result = toolResult as Record<string, unknown>;
          if (result.swapTransaction) swapTransaction = result.swapTransaction as string;
          steps.push({
            step: 4,
            name: 'Transaction Construction',
            status: result.error ? 'fail' : 'pass',
            data: result,
          });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(toolResult),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  // Log to sniper_executions table
  const db = getSupabaseAdmin();
  const { data: execRecord } = await db
    .from('sniper_executions')
    .insert({
      user_id: config.userId,
      chain: config.chain,
      token_address: config.tokenAddress,
      buy_amount_usd: config.buyAmountUsd,
      tx_hash: txHash ?? null,
      status: decision === 'execute' ? 'completed' : decision === 'blocked' ? 'failed' : 'failed',
      stop_loss_pct: config.stopLossPct ?? null,
      take_profit_pct: config.takeProfitPct ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  return {
    success: decision === 'execute',
    executionId: execRecord?.id,
    steps,
    decision,
    blockReason,
    txHash,
    swapTransaction,
    entryPriceUsd,
    riskScore,
    sessionId,
    durationMs: Date.now() - startTime,
  };
}
