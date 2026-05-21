import 'server-only';

/**
 * §3 P2-D.4 — ERC-4337 Account Abstraction via Pimlico.
 *
 * Pimlico provides a bundler + paymaster + simple-account factory across
 * the EVM majors. We use the JSON-RPC bundler endpoints directly so we
 * don't drag in their SDK (which pulls viem and is heavy).
 *
 * Env: PIMLICO_API_KEY (LOCKED name). Pimlico endpoint:
 *   https://api.pimlico.io/v2/<chain>/rpc?apikey=<key>
 *
 * Chains supported (Pimlico slugs): ethereum, sepolia, base, base-sepolia,
 * arbitrum, polygon, optimism, bsc, avalanche.
 */

const PIMLICO_CHAIN_SLUG: Record<string, string> = {
  ethereum: 'ethereum',
  base:     'base',
  arbitrum: 'arbitrum',
  polygon:  'polygon',
  optimism: 'optimism',
  bsc:      'bsc',
};

function pimlicoUrl(chain: string): string | null {
  const slug = PIMLICO_CHAIN_SLUG[chain.toLowerCase()];
  const key = process.env.PIMLICO_API_KEY;
  if (!slug || !key) return null;
  return `https://api.pimlico.io/v2/${slug}/rpc?apikey=${key}`;
}

interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

async function pimlicoRpc<T = unknown>(chain: string, method: string, params: unknown[]): Promise<T | null> {
  const url = pimlicoUrl(chain);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    if (json.error) return null;
    return json.result ?? null;
  } catch {
    return null;
  }
}

export async function estimateUserOp(chain: string, userOp: Partial<UserOperation>, entryPoint: string): Promise<unknown> {
  return pimlicoRpc(chain, 'eth_estimateUserOperationGas', [userOp, entryPoint]);
}

export async function sendUserOp(chain: string, userOp: UserOperation, entryPoint: string): Promise<string | null> {
  return pimlicoRpc<string>(chain, 'eth_sendUserOperation', [userOp, entryPoint]);
}

export async function getUserOpReceipt(chain: string, userOpHash: string): Promise<unknown> {
  return pimlicoRpc(chain, 'eth_getUserOperationReceipt', [userOpHash]);
}

export async function getPaymasterSponsorship(chain: string, userOp: Partial<UserOperation>, entryPoint: string): Promise<unknown> {
  // Pimlico paymaster sponsorship — returns paymasterAndData + adjusted gas fields.
  return pimlicoRpc(chain, 'pm_sponsorUserOperation', [userOp, entryPoint]);
}

export function isPimlicoConfigured(): boolean {
  return Boolean(process.env.PIMLICO_API_KEY);
}

// Standard EntryPoint v0.7 address (single across all EVM chains)
export const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
