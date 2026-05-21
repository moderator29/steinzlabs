import 'server-only';

/**
 * LiFi REST client — single source of truth for every bridge / cross-chain
 * surface on the platform (per SESSION-T-KICKOFF §0.5 + §3 P1-C, LOCKED).
 *
 * LiFi aggregates Stargate, Across, Hop, deBridge, Wormhole, and chain-level
 * swap aggregators behind one quote + one execute. We do NOT call those
 * bridges directly anywhere else in the codebase.
 *
 * API base: https://li.quest/v1 (see https://docs.li.fi/api-reference)
 * Auth: x-lifi-api-key header from LIFI_API_KEY (set in Vercel).
 */

const BASE = 'https://li.quest/v1';
const DEFAULT_TIMEOUT_MS = 8_000;

function headers(): HeadersInit {
  const key = process.env.LIFI_API_KEY;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) h['x-lifi-api-key'] = key;
  return h;
}

async function timedFetch(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, headers: { ...headers(), ...(init?.headers ?? {}) } });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface LifiQuoteParams {
  fromChain: string | number;       // chain ID or LiFi key (eth, bsc, sol, etc.)
  toChain: string | number;
  fromToken: string;                // address or symbol
  toToken: string;
  fromAmount: string;               // base units (wei / lamports)
  fromAddress: string;              // EOA initiating the bridge
  toAddress?: string;               // defaults to fromAddress
  slippage?: number;                // 0.005 = 0.5%
}

export interface LifiStep {
  id: string;
  type: string;
  tool: string;
  toolDetails?: { name?: string; logoURI?: string };
  action: Record<string, unknown>;
  estimate: Record<string, unknown>;
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    chainId?: number;
    gasPrice?: string;
    gasLimit?: string;
  };
}

export interface LifiQuote extends LifiStep {
  estimate: {
    fromAmount?: string;
    toAmount?: string;
    toAmountMin?: string;
    approvalAddress?: string;
    feeCosts?: unknown[];
    gasCosts?: unknown[];
    executionDuration?: number;     // seconds, end-to-end
    [k: string]: unknown;
  };
}

export interface LifiStatus {
  status: 'NOT_FOUND' | 'INVALID' | 'PENDING' | 'DONE' | 'FAILED';
  substatus?: string;
  substatusMessage?: string;
  fromChain?: number;
  toChain?: number;
  sending?: { txHash?: string; amount?: string; token?: unknown };
  receiving?: { txHash?: string; amount?: string; token?: unknown };
  bridgeExplorerLink?: string;
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function getLifiQuote(p: LifiQuoteParams): Promise<LifiQuote | null> {
  const qs = new URLSearchParams({
    fromChain: String(p.fromChain),
    toChain: String(p.toChain),
    fromToken: p.fromToken,
    toToken: p.toToken,
    fromAmount: p.fromAmount,
    fromAddress: p.fromAddress,
  });
  if (p.toAddress) qs.set('toAddress', p.toAddress);
  if (typeof p.slippage === 'number') qs.set('slippage', String(p.slippage));

  const res = await timedFetch(`${BASE}/quote?${qs.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as LifiQuote;
}

export async function getLifiRoutes(p: LifiQuoteParams & { allowSwitchChain?: boolean }): Promise<LifiQuote[]> {
  const body = {
    fromChainId: p.fromChain,
    toChainId: p.toChain,
    fromTokenAddress: p.fromToken,
    toTokenAddress: p.toToken,
    fromAmount: p.fromAmount,
    fromAddress: p.fromAddress,
    toAddress: p.toAddress ?? p.fromAddress,
    options: {
      slippage: p.slippage ?? 0.005,
      allowSwitchChain: p.allowSwitchChain ?? true,
    },
  };
  const res = await timedFetch(`${BASE}/advanced/routes`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return [];
  const json = (await res.json()) as { routes?: Array<{ steps: LifiQuote[] }> };
  // Each route's first step carries the executable transactionRequest for
  // the originating chain — that's what the UI signs.
  return (json.routes ?? []).map((r) => r.steps[0]).filter(Boolean);
}

export async function getLifiStatus(txHash: string, bridge?: string, fromChain?: string | number, toChain?: string | number): Promise<LifiStatus | null> {
  const qs = new URLSearchParams({ txHash });
  if (bridge) qs.set('bridge', bridge);
  if (fromChain !== undefined) qs.set('fromChain', String(fromChain));
  if (toChain !== undefined) qs.set('toChain', String(toChain));

  const res = await timedFetch(`${BASE}/status?${qs.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as LifiStatus;
}

export function isLifiConfigured(): boolean {
  return Boolean(process.env.LIFI_API_KEY);
}
