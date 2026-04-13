import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  detectCluster,
  type ClusterInput,
  type TokenTradeEvent,
  type TransferEdge,
} from '@/lib/services/cluster-detection';
import type { WalletChain, WalletCluster } from '@/lib/types/wallet';

/**
 * Cluster Analysis Agent — Managed Agent Session
 *
 * Uses a persistent Anthropic beta session to perform deep wallet cluster analysis.
 * Combines on-chain data from Helius/Alchemy with the cluster detection algorithm
 * to identify coordinated wallet groups.
 *
 * The agent runs an iterative investigation:
 *  1. Fetch transfer histories for all input wallets
 *  2. Fetch trade histories for each wallet
 *  3. Run the cluster detection algorithm
 *  4. Investigate any flagged wallets for deeper context
 *  5. Produce a structured cluster report with confidence rating
 */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: parseInt(process.env.API_TIMEOUT_MS || '600000', 10),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClusterAgentInput {
  addresses: string[];
  chain: WalletChain;
  windowHours?: number;      // how far back to look (default 168 = 7 days)
  minTransferUsd?: number;   // ignore transfers below this (default $100)
}

export interface ClusterAgentReport {
  input: ClusterAgentInput;
  detected: boolean;
  confidence: 'confirmed' | 'likely' | 'weak' | 'none';
  score: number;             // 0–100
  cluster?: WalletCluster;
  signals: Array<{
    type: string;
    score: number;
    wallets: string[];
    detail: string;
  }>;
  summary: string;           // AI-generated narrative
  recommendations: string[];
  sessionId?: string;
  durationMs: number;
}

// ─── Agent System Prompt ──────────────────────────────────────────────────────

const CLUSTER_SYSTEM_PROMPT = `You are the Steinz Labs Cluster Analysis Agent.

Your mission: Identify and analyse coordinated wallet clusters with precision.

A cluster exists when 3+ wallets demonstrate 2+ coordination signals:
- Same token buys within ±5 block window
- Sequential buys within 24h
- Direct fund flows between wallets
- Correlated entry/exit timing
- Common funding source

Your process:
1. Call fetch_wallet_transfers for all input wallets to get fund flows
2. Call fetch_wallet_trades for all wallets to get trading history
3. Call run_cluster_detection with the collected data
4. If clusters are found, call fetch_wallet_profile on the most active wallet for context
5. Generate a clear, actionable cluster report

Your report must include:
- Cluster confidence: CONFIRMED / LIKELY / WEAK / NONE
- Score: 0-100
- Key evidence for each signal detected
- Named members with their coordination scores
- Recommendations for the analyst

Be factual. Only report what the data shows.`;

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const CLUSTER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'fetch_wallet_transfers',
    description: 'Fetch transfer history for a wallet to identify fund flows between addresses.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'The wallet address' },
        chain: { type: 'string', description: 'The blockchain' },
        limit: { type: 'number', description: 'Max transfers to return (default 100)' },
      },
      required: ['address', 'chain'],
    },
  },
  {
    name: 'fetch_wallet_trades',
    description: 'Fetch token trade history for a wallet (buys and sells on DEXs).',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'The wallet address' },
        chain: { type: 'string', description: 'The blockchain' },
        limit: { type: 'number', description: 'Max trades to return (default 100)' },
      },
      required: ['address', 'chain'],
    },
  },
  {
    name: 'run_cluster_detection',
    description: 'Run the cluster detection algorithm on collected wallet data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        addresses: {
          type: 'array',
          items: { type: 'string' },
          description: 'Wallet addresses to analyse',
        },
        chain: { type: 'string' },
        transfers: {
          type: 'array',
          description: 'Transfer edges (from, to, valueUsd, timestamp, txHash)',
          items: { type: 'object' },
        },
        trades: {
          type: 'array',
          description: 'Trade events (address, tokenAddress, side, valueUsd, timestamp, blockNumber, txHash)',
          items: { type: 'object' },
        },
      },
      required: ['addresses', 'chain', 'transfers', 'trades'],
    },
  },
  {
    name: 'fetch_wallet_profile',
    description: 'Fetch detailed profile information for a specific wallet address.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'The wallet address' },
        chain: { type: 'string', description: 'The blockchain' },
      },
      required: ['address', 'chain'],
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  config: ClusterAgentInput,
  collectedTransfers: TransferEdge[],
  collectedTrades: TokenTradeEvent[],
): Promise<unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  switch (toolName) {
    case 'fetch_wallet_transfers': {
      try {
        const res = await fetch(
          `${baseUrl}/api/wallet-tracer?address=${toolInput.address}&chain=${toolInput.chain}&type=transfers&limit=${toolInput.limit ?? 100}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (res.ok) {
          const data = await res.json();
          const transfers: TransferEdge[] = (data.transfers || []).map((t: Record<string, unknown>) => ({
            from: t.from as string,
            to: t.to as string,
            valueUsd: (t.valueUsd ?? t.value_usd ?? 0) as number,
            timestamp: (t.timestamp ?? 0) as number,
            txHash: (t.hash ?? t.txHash ?? '') as string,
          }));
          collectedTransfers.push(...transfers);
          return { transfers, count: transfers.length };
        }
      } catch {/* non-blocking */}
      return { transfers: [], count: 0, error: 'fetch failed' };
    }

    case 'fetch_wallet_trades': {
      try {
        const res = await fetch(
          `${baseUrl}/api/wallet-tracer?address=${toolInput.address}&chain=${toolInput.chain}&type=trades&limit=${toolInput.limit ?? 100}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (res.ok) {
          const data = await res.json();
          const trades: TokenTradeEvent[] = (data.trades || []).map((t: Record<string, unknown>) => ({
            address: toolInput.address as string,
            tokenAddress: (t.tokenAddress ?? t.token_address ?? '') as string,
            side: (t.side ?? 'buy') as 'buy' | 'sell',
            valueUsd: (t.valueUsd ?? t.value_usd ?? 0) as number,
            timestamp: (t.timestamp ?? 0) as number,
            blockNumber: (t.blockNumber ?? t.block_number ?? 0) as number,
            txHash: (t.hash ?? t.txHash ?? '') as string,
          }));
          collectedTrades.push(...trades);
          return { trades, count: trades.length };
        }
      } catch {/* non-blocking */}
      return { trades: [], count: 0, error: 'fetch failed' };
    }

    case 'run_cluster_detection': {
      const clusterInput: ClusterInput = {
        addresses: toolInput.addresses as string[],
        chain: (toolInput.chain as WalletChain) ?? config.chain,
        transfers: (toolInput.transfers as TransferEdge[]) ?? collectedTransfers,
        trades: (toolInput.trades as TokenTradeEvent[]) ?? collectedTrades,
      };
      const result = detectCluster(clusterInput);
      return result;
    }

    case 'fetch_wallet_profile': {
      try {
        const res = await fetch(
          `${baseUrl}/api/wallet-tracer?address=${toolInput.address}&chain=${toolInput.chain}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (res.ok) return await res.json();
      } catch {/* non-blocking */}
      return { address: toolInput.address, error: 'profile fetch failed' };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Main Cluster Agent ───────────────────────────────────────────────────────

export async function runClusterAgent(input: ClusterAgentInput): Promise<ClusterAgentReport> {
  const startTime = Date.now();
  const collectedTransfers: TransferEdge[] = [];
  const collectedTrades: TokenTradeEvent[] = [];
  let finalReport: ClusterAgentReport = {
    input,
    detected: false,
    confidence: 'none',
    score: 0,
    signals: [],
    summary: '',
    recommendations: [],
    durationMs: 0,
  };

  // Create managed session for cluster analysis
  let sessionId: string | undefined;
  try {
    const session = await (client.beta as any).sessions?.create?.({
      system: CLUSTER_SYSTEM_PROMPT,
      model: 'claude-sonnet-4-6',
    });
    sessionId = session?.id;
  } catch {
    // Sessions API not available — continue without session
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Analyse these ${input.addresses.length} wallets for cluster coordination:

Addresses:
${input.addresses.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Chain: ${input.chain}
Look-back window: ${input.windowHours ?? 168} hours
Min transfer threshold: $${input.minTransferUsd ?? 100}

Run your full analysis. Fetch transfers and trades for ALL wallets, then run cluster detection, then provide your complete cluster report.`,
    },
  ];

  let iterations = 0;
  const maxIterations = 15;
  let detectionResult: ReturnType<typeof detectCluster> | null = null;

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: CLUSTER_SYSTEM_PROMPT,
      tools: CLUSTER_TOOLS,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      // Extract final report from AI text
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        const text = textBlock.text;

        // Parse confidence
        let confidence: ClusterAgentReport['confidence'] = detectionResult?.confidence ?? 'none';
        if (/CONFIRMED/i.test(text)) confidence = 'confirmed';
        else if (/LIKELY/i.test(text)) confidence = 'likely';
        else if (/WEAK/i.test(text)) confidence = 'weak';

        // Extract recommendations
        const recs: string[] = [];
        const recSection = text.match(/recommendation[s]?[:\s\n]+([\s\S]+?)(?:\n\n|\z)/i);
        if (recSection) {
          const recLines = recSection[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
          recs.push(...recLines.map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean));
        }

        // Summary paragraph
        const summaryMatch = text.match(/summary[:\s\n]+([\s\S]{50,500}?)(?:\n\n|$)/i);
        const summary = summaryMatch?.[1]?.trim() ?? text.slice(0, 400).trim();

        finalReport = {
          input,
          detected: detectionResult?.detected ?? false,
          confidence,
          score: detectionResult?.score ?? 0,
          cluster: detectionResult?.cluster,
          signals: (detectionResult?.signals ?? []).map(s => ({
            type: s.signal,
            score: s.score,
            wallets: s.wallets,
            detail: s.detail,
          })),
          summary,
          recommendations: recs.length > 0 ? recs : [
            'Monitor these wallets for continued coordinated activity',
            'Flag any new tokens they co-purchase',
          ],
          sessionId,
          durationMs: Date.now() - startTime,
        };
      }
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;

        const result = await handleToolCall(
          block.name,
          block.input as Record<string, unknown>,
          input,
          collectedTransfers,
          collectedTrades,
        );

        // Capture detection result
        if (block.name === 'run_cluster_detection') {
          detectionResult = result as ReturnType<typeof detectCluster>;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  finalReport.durationMs = Date.now() - startTime;
  return finalReport;
}
