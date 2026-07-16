import 'server-only';
import { getEvmRpcUrl } from '@/lib/chains/evmRpc';

/**
 * On-chain token-decimals resolver — the last-resort fallback for the swap
 * quote/price routes.
 *
 * Why: the swap routes need a token's decimals to convert a human amount to
 * base units (and back). For the platform's known set that comes from a static
 * table; for a memecoin the coin-detail page usually passes the decimals it
 * already resolved. But a brand-new coin the static table has never seen, with
 * no decimals hint, used to make the route reject the trade with
 * "Unsupported token" — even though the address is perfectly valid and
 * tradable. This reads the REAL decimals straight from the chain so any real
 * mint/contract resolves. Decimals are immutable, so results are cached
 * forever in-process.
 *
 * Real data only: a failed lookup returns null (caller surfaces an honest
 * error) — never a guessed decimals value.
 */

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC ||
  (process.env.ALCHEMY_API_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : '') ||
  'https://api.mainnet-beta.solana.com';

// Decimals never change for a deployed token, so cache across requests.
const cache = new Map<string, number>();

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function sane(n: number): number | null {
  return Number.isInteger(n) && n >= 0 && n <= 18 ? n : null;
}

async function evmDecimals(chain: string, address: string): Promise<number | null> {
  const rpc = getEvmRpcUrl(chain);
  if (!rpc) return null;
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // decimals() selector 0x313ce567
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: address, data: '0x313ce567' }, 'latest'] }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: string };
    if (!j.result || j.result === '0x') return null;
    return sane(parseInt(j.result, 16));
  } catch {
    return null;
  }
}

async function solanaDecimals(mint: string): Promise<number | null> {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [mint, { encoding: 'jsonParsed' }] }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      result?: { value?: { data?: { parsed?: { info?: { decimals?: number } } } } };
    };
    const d = j.result?.value?.data?.parsed?.info?.decimals;
    return typeof d === 'number' ? sane(d) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a token's decimals on-chain. Accepts a Solana mint or an EVM
 * contract address (symbols are not on-chain-resolvable — pass those through
 * the static table first). Returns null when it can't be read confidently.
 */
export async function getOnchainDecimals(chain: string, address: string): Promise<number | null> {
  if (!address) return null;
  const key = `${chain.toLowerCase()}:${address}`;
  const hit = cache.get(key);
  if (hit != null) return hit;

  let d: number | null = null;
  if (chain.toLowerCase() === 'solana') {
    if (SOLANA_ADDRESS_RE.test(address)) d = await solanaDecimals(address);
  } else if (EVM_ADDRESS_RE.test(address)) {
    d = await evmDecimals(chain, address);
  }

  if (d != null) cache.set(key, d);
  return d;
}
