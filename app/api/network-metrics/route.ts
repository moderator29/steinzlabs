import 'server-only';
import { NextResponse } from 'next/server';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || '';
const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
  || `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

async function rpc(url: string, method: string, params: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json() as { result?: unknown };
  return data.result ?? null;
}

// Nominal block times (secs). Live TPS is derived from a block's REAL tx count
// divided by this — far more honest than the old hardcoded '15'. These are
// stable enough for a health board; the tx count is always live.
const BLOCK_TIME_SECS: Record<string, number> = {
  Ethereum: 12, Base: 2, Arbitrum: 0.26, Polygon: 2.1,
};

interface EvmBlock { number: number; txCount: number }

async function fetchEvmBlock(url: string): Promise<EvmBlock | null> {
  // 'false' → transactions as hashes; length is the real tx count.
  const b = await rpc(url, 'eth_getBlockByNumber', ['latest', false]).catch(() => null) as
    { number?: string; transactions?: string[] } | null;
  if (!b?.number) return null;
  return { number: parseInt(b.number, 16), txCount: Array.isArray(b.transactions) ? b.transactions.length : 0 };
}

function evmChain(chain: string, gas: PromiseSettledResult<unknown>, block: EvmBlock | null, gweiDigits = 3) {
  const gwei = gas.status === 'fulfilled' && gas.value
    ? (parseInt(gas.value as string, 16) / 1e9).toFixed(gweiDigits) : 'N/A';
  // "~" prefix — this is an estimate (real tx count ÷ nominal block time), not a
  // measured instantaneous TPS, so it never reads as exact.
  const tps = block ? `~${Math.max(0, Math.round(block.txCount / BLOCK_TIME_SECS[chain])).toLocaleString()}` : 'N/A';
  const blocks = block ? block.number.toLocaleString() : 'N/A';
  return { gas: `${gwei} Gwei`, tps, blocks };
}

export async function GET() {
  try {
    const ethRpc = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
    const baseRpc = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
    const arbRpc = `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
    const polyRpc = `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    const [
      ethGas, ethBlk, baseGas, baseBlk, arbGas, arbBlk, polyGas, polyBlk,
      solPerf, solSlot, solFees,
    ] = await Promise.allSettled([
      rpc(ethRpc, 'eth_gasPrice', []),   fetchEvmBlock(ethRpc),
      rpc(baseRpc, 'eth_gasPrice', []),  fetchEvmBlock(baseRpc),
      rpc(arbRpc, 'eth_gasPrice', []),   fetchEvmBlock(arbRpc),
      rpc(polyRpc, 'eth_gasPrice', []),  fetchEvmBlock(polyRpc),
      rpc(SOLANA_RPC, 'getRecentPerformanceSamples', [1]),
      rpc(SOLANA_RPC, 'getSlot', []),
      rpc(SOLANA_RPC, 'getRecentPrioritizationFees', [[]]),
    ]);

    const blk = (r: PromiseSettledResult<EvmBlock | null>) => (r.status === 'fulfilled' ? r.value : null);

    const solSample = solPerf.status === 'fulfilled' ? (solPerf.value as Array<{ numTransactions: number; samplePeriodSecs: number }>)?.[0] : null;
    const solTps = solSample ? Math.round(solSample.numTransactions / solSample.samplePeriodSecs).toLocaleString() : 'N/A';
    const solSlotNum = solSlot.status === 'fulfilled' && solSlot.value
      ? (solSlot.value as number).toLocaleString() : 'N/A';

    // Real Solana fee: 5000-lamport base per signature + the median recent
    // prioritization fee (microLamports/CU) for a ~200k-CU tx. Replaces the
    // fabricated flat '0.00025 SOL'.
    const priFees = solFees.status === 'fulfilled' ? (solFees.value as Array<{ prioritizationFee: number }> | null) : null;
    let solGas = '0.000005 SOL';
    if (priFees && priFees.length) {
      const sorted = priFees.map((f) => f.prioritizationFee).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      const lamports = 5000 + (median * 200_000) / 1e6; // base + priority (µLamports/CU × CU)
      solGas = `${(lamports / 1e9).toFixed(6)} SOL`;
    }

    return NextResponse.json({
      Ethereum: evmChain('Ethereum', ethGas, blk(ethBlk), 1),
      Solana: { gas: solGas, tps: solTps, blocks: solSlotNum },
      Base: evmChain('Base', baseGas, blk(baseBlk), 3),
      Arbitrum: evmChain('Arbitrum', arbGas, blk(arbBlk), 3),
      Polygon: evmChain('Polygon', polyGas, blk(polyBlk), 1),
      fetchedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch network metrics' }, { status: 500 });
  }
}
