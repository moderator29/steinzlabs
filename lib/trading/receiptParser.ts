import 'server-only';
import { Alchemy, Network } from 'alchemy-sdk';

/**
 * On-chain receipt parser for the receipt-reconciliation cron. Given a
 * broadcast tx_hash, returns the authoritative amount of `to_token` that
 * landed in the taker's wallet plus gas paid. This replaces the former
 * client-reported values which were untrusted.
 */

export interface ReceiptResult {
  reverted: boolean;
  revertReason: string | null;
  actualAmountOut: string | null; // raw units (wei / lamports for the to_token's decimals)
  actualGasUsd: number | null;
  taker: string | null;
}

const EVM_NETWORK: Record<string, Network> = {
  ethereum: Network.ETH_MAINNET,
  eth: Network.ETH_MAINNET,
  polygon: Network.MATIC_MAINNET,
  matic: Network.MATIC_MAINNET,
  base: Network.BASE_MAINNET,
  arbitrum: Network.ARB_MAINNET,
  arb: Network.ARB_MAINNET,
  optimism: Network.OPT_MAINNET,
  op: Network.OPT_MAINNET,
  ...(Network.BNB_MAINNET ? { bsc: Network.BNB_MAINNET, bnb: Network.BNB_MAINNET } : {}),
};

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const evmClients = new Map<string, Alchemy>();
function getEvm(chain: string): Alchemy | null {
  const net = EVM_NETWORK[chain.toLowerCase()];
  if (!net) return null;
  let c = evmClients.get(net);
  if (!c) {
    c = new Alchemy({ apiKey: process.env.ALCHEMY_API_KEY ?? '', network: net });
    evmClients.set(net, c);
  }
  return c;
}

function addrFromTopic(topic: string): string {
  // topics are 32-byte padded; address is last 20 bytes (lower-cased).
  return ('0x' + topic.slice(-40)).toLowerCase();
}

export async function parseEvmReceipt(params: {
  chain: string;
  txHash: string;
  toTokenAddress: string;
}): Promise<ReceiptResult> {
  const client = getEvm(params.chain);
  if (!client) {
    return {
      reverted: false,
      revertReason: 'chain_not_supported',
      actualAmountOut: null,
      actualGasUsd: null,
      taker: null,
    };
  }
  const receipt = await client.core.getTransactionReceipt(params.txHash);
  if (!receipt) {
    return {
      reverted: false,
      revertReason: null,
      actualAmountOut: null,
      actualGasUsd: null,
      taker: null,
    };
  }
  const taker = receipt.from?.toLowerCase() ?? null;
  if (receipt.status === 0) {
    return {
      reverted: true,
      revertReason: 'tx_reverted',
      actualAmountOut: null,
      actualGasUsd: null,
      taker,
    };
  }

  // Sum Transfer(to=taker, token=toToken) across logs.
  let amountOut = BigInt(0);
  const toToken = params.toTokenAddress.toLowerCase();
  const isNative = toToken === '0x0000000000000000000000000000000000000000' || toToken === 'native';

  if (!isNative) {
    for (const log of receipt.logs ?? []) {
      if ((log.address ?? '').toLowerCase() !== toToken) continue;
      if ((log.topics?.[0] ?? '') !== TRANSFER_TOPIC) continue;
      const to = log.topics?.[2] ? addrFromTopic(log.topics[2]) : '';
      if (taker && to !== taker) continue;
      try {
        amountOut += BigInt(log.data || '0x0');
      } catch {
        /* ignore malformed */
      }
    }
  }

  // Gas cost. effectiveGasPrice × gasUsed gives native cost; USD requires
  // native-token price which the cron provides via dexscreener.
  const gasUsed = receipt.gasUsed ? BigInt(receipt.gasUsed.toString()) : BigInt(0);
  const effGasPrice = receipt.effectiveGasPrice
    ? BigInt(receipt.effectiveGasPrice.toString())
    : BigInt(0);
  const gasWei = gasUsed * effGasPrice;

  return {
    reverted: false,
    revertReason: null,
    actualAmountOut: isNative ? null : amountOut.toString(),
    actualGasUsd: null, // cron fills USD value using native price
    taker,
    // gas in wei is exported via a side-car; cron reads it off the result
    ...(gasWei > BigInt(0) ? { _gasWei: gasWei.toString() } : {}),
  } as ReceiptResult & { _gasWei?: string };
}

interface SolanaTxDetail {
  meta?: {
    err?: unknown;
    preTokenBalances?: Array<{
      owner?: string;
      mint?: string;
      uiTokenAmount?: { amount?: string };
    }>;
    postTokenBalances?: Array<{
      owner?: string;
      mint?: string;
      uiTokenAmount?: { amount?: string };
    }>;
    fee?: number;
  };
  transaction?: {
    message?: {
      accountKeys?: Array<{ pubkey?: string; signer?: boolean }>;
    };
  };
}

export async function parseSolanaReceipt(params: {
  txHash: string;
  toTokenMint: string;
}): Promise<ReceiptResult> {
  const rpc =
    process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC ||
    `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [params.txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    return {
      reverted: false,
      revertReason: null,
      actualAmountOut: null,
      actualGasUsd: null,
      taker: null,
    };
  }
  const body = (await res.json()) as { result?: SolanaTxDetail | null };
  const tx = body.result;
  if (!tx) {
    return {
      reverted: false,
      revertReason: null,
      actualAmountOut: null,
      actualGasUsd: null,
      taker: null,
    };
  }
  const signer =
    tx.transaction?.message?.accountKeys?.find((k) => k.signer)?.pubkey ?? null;

  if (tx.meta?.err) {
    return {
      reverted: true,
      revertReason: JSON.stringify(tx.meta.err).slice(0, 200),
      actualAmountOut: null,
      actualGasUsd: null,
      taker: signer,
    };
  }

  const mint = params.toTokenMint;
  const takerKey = signer;
  let pre = BigInt(0);
  let post = BigInt(0);
  for (const b of tx.meta?.preTokenBalances ?? []) {
    if (b.mint === mint && b.owner === takerKey) {
      try {
        pre += BigInt(b.uiTokenAmount?.amount ?? '0');
      } catch {
        /* ignore */
      }
    }
  }
  for (const b of tx.meta?.postTokenBalances ?? []) {
    if (b.mint === mint && b.owner === takerKey) {
      try {
        post += BigInt(b.uiTokenAmount?.amount ?? '0');
      } catch {
        /* ignore */
      }
    }
  }
  const delta = post - pre;
  const feeLamports = tx.meta?.fee ?? 0;
  const gasUsd = feeLamports > 0 ? null : null; // cron converts lamports → SOL → USD
  return {
    reverted: false,
    revertReason: null,
    actualAmountOut: delta > BigInt(0) ? delta.toString() : '0',
    actualGasUsd: gasUsd,
    taker: signer,
    ...(feeLamports > 0 ? { _feeLamports: feeLamports } : {}),
  } as ReceiptResult & { _feeLamports?: number };
}

export function computeSlippageBps(
  expectedOut: string | number | null,
  actualOut: string | null,
): number | null {
  if (!expectedOut || !actualOut) return null;
  try {
    const expected = BigInt(
      typeof expectedOut === 'number' ? Math.floor(expectedOut).toString() : expectedOut,
    );
    const actual = BigInt(actualOut);
    if (expected === BigInt(0)) return null;
    // Positive bps = less than expected (bad slippage). Negative = better.
    const diff = expected - actual;
    return Number((diff * BigInt(10000)) / expected);
  } catch {
    return null;
  }
}
