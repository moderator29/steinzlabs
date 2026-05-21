import 'server-only';

/**
 * §3 P2-D.3 — Cancel / replace / speedup helpers for stuck EVM txs.
 *
 * Cancel = send a 0-value self-send with the SAME nonce and a higher
 *          gas price; the network mines whichever lands first.
 * Speedup = same tx data, same nonce, higher gas (replace-by-fee).
 * Replace = swap the data entirely with the same nonce.
 *
 * The server CANNOT broadcast for the user — non-custodial rule. These
 * helpers build the unsigned tx; the client signs + broadcasts via
 * window.ethereum.
 */

const RPC_BY_CHAIN: Record<string, string | undefined> = {
  ethereum: process.env.ETHEREUM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  base:     process.env.BASE_RPC_URL     ?? (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  arbitrum: process.env.ARBITRUM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  polygon:  process.env.POLYGON_RPC_URL  ?? (process.env.ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  optimism: process.env.OPTIMISM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  bsc:      process.env.BSC_RPC_URL      ?? 'https://bsc-dataseed.binance.org',
};

async function rpc<T = unknown>(chain: string, method: string, params: unknown[]): Promise<T | null> {
  const url = RPC_BY_CHAIN[chain.toLowerCase()];
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

export interface CancelReplaceTxRequest {
  to: string;
  data: string;
  value: string;       // hex wei
  gasPrice: string;    // hex
  gasLimit: string;    // hex
  nonce: number;
  chainId: number;
}

/**
 * Build a cancel tx. Takes the original tx + a gas multiplier (default
 * 1.5x). Returns the unsigned tx body the client should request the
 * wallet to sign + broadcast.
 */
export async function buildCancelTx(originalTxHash: string, chain: string, gasMultiplier = 1.5): Promise<CancelReplaceTxRequest | null> {
  const tx = await rpc<{ from: string; nonce: string; gasPrice?: string; maxFeePerGas?: string; chainId?: string }>(chain, 'eth_getTransactionByHash', [originalTxHash]);
  if (!tx) return null;
  // Current network gas price for safety floor
  const cur = (await rpc<string>(chain, 'eth_gasPrice', [])) ?? '0x0';
  const oldPriceHex = tx.gasPrice ?? tx.maxFeePerGas ?? cur;
  const oldPrice = BigInt(oldPriceHex);
  const curPrice = BigInt(cur);
  // Replacement must be >= 10% higher per EIP-1559; we go 50% for safety.
  const target = (oldPrice > curPrice ? oldPrice : curPrice) * BigInt(Math.floor(gasMultiplier * 100)) / BigInt(100);
  return {
    to: tx.from,                                      // self-send
    data: '0x',
    value: '0x0',
    gasPrice: `0x${target.toString(16)}`,
    gasLimit: '0x5208',                                // 21000 = standard transfer
    nonce: parseInt(tx.nonce, 16),
    chainId: parseInt(tx.chainId ?? '0x1', 16),
  };
}

/**
 * Build a speedup tx: same to/data/value as the original, same nonce,
 * higher gas. Just the original tx with a fresh gas price.
 */
export async function buildSpeedupTx(originalTxHash: string, chain: string, gasMultiplier = 1.5): Promise<CancelReplaceTxRequest | null> {
  const tx = await rpc<{ to: string; from: string; input: string; value: string; nonce: string; gasPrice?: string; maxFeePerGas?: string; gas: string; chainId?: string }>(chain, 'eth_getTransactionByHash', [originalTxHash]);
  if (!tx) return null;
  const cur = (await rpc<string>(chain, 'eth_gasPrice', [])) ?? '0x0';
  const oldPriceHex = tx.gasPrice ?? tx.maxFeePerGas ?? cur;
  const oldPrice = BigInt(oldPriceHex);
  const curPrice = BigInt(cur);
  const target = (oldPrice > curPrice ? oldPrice : curPrice) * BigInt(Math.floor(gasMultiplier * 100)) / BigInt(100);
  return {
    to: tx.to,
    data: tx.input,
    value: tx.value,
    gasPrice: `0x${target.toString(16)}`,
    gasLimit: tx.gas,
    nonce: parseInt(tx.nonce, 16),
    chainId: parseInt(tx.chainId ?? '0x1', 16),
  };
}
