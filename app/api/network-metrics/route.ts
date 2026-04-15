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

export async function GET() {
  try {
    const ethRpc = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
    const baseRpc = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
    const arbRpc = `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
    const polyRpc = `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    const [ethGas, ethBlock, solPerf, solSlot, baseGas, arbGas, polyGas] = await Promise.allSettled([
      rpc(ethRpc, 'eth_gasPrice', []),
      rpc(ethRpc, 'eth_blockNumber', []),
      rpc(SOLANA_RPC, 'getRecentPerformanceSamples', [1]),
      rpc(SOLANA_RPC, 'getSlot', []),
      rpc(baseRpc, 'eth_gasPrice', []),
      rpc(arbRpc, 'eth_gasPrice', []),
      rpc(polyRpc, 'eth_gasPrice', []),
    ]);

    const ethGasGwei = ethGas.status === 'fulfilled' && ethGas.value
      ? (parseInt(ethGas.value as string, 16) / 1e9).toFixed(1) : 'N/A';
    const ethBlockNum = ethBlock.status === 'fulfilled' && ethBlock.value
      ? parseInt(ethBlock.value as string, 16).toLocaleString() : 'N/A';

    const solSample = solPerf.status === 'fulfilled' ? (solPerf.value as Array<{ numTransactions: number; samplePeriodSecs: number }>)?.[0] : null;
    const solTps = solSample ? Math.round(solSample.numTransactions / solSample.samplePeriodSecs).toLocaleString() : 'N/A';
    const solSlotNum = solSlot.status === 'fulfilled' && solSlot.value
      ? (solSlot.value as number).toLocaleString() : 'N/A';

    const baseGasGwei = baseGas.status === 'fulfilled' && baseGas.value
      ? (parseInt(baseGas.value as string, 16) / 1e9).toFixed(3) : 'N/A';
    const arbGasGwei = arbGas.status === 'fulfilled' && arbGas.value
      ? (parseInt(arbGas.value as string, 16) / 1e9).toFixed(3) : 'N/A';
    const polyGasGwei = polyGas.status === 'fulfilled' && polyGas.value
      ? (parseInt(polyGas.value as string, 16) / 1e9).toFixed(1) : 'N/A';

    return NextResponse.json({
      Ethereum: { gas: `${ethGasGwei} Gwei`, tps: '15', blocks: ethBlockNum },
      Solana: { gas: '0.00025 SOL', tps: solTps, blocks: solSlotNum },
      Base: { gas: `${baseGasGwei} Gwei`, tps: '—', blocks: '—' },
      Arbitrum: { gas: `${arbGasGwei} Gwei`, tps: '—', blocks: '—' },
      Polygon: { gas: `${polyGasGwei} Gwei`, tps: '—', blocks: '—' },
      fetchedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch network metrics' }, { status: 500 });
  }
}
