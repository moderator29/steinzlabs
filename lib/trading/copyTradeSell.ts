import 'server-only';
import { Alchemy, Network } from 'alchemy-sdk';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Sell-direction sizing for copy-trades. When a followed whale sells a token,
 * the user exits their position in that token. v1 policy: full exit.
 *
 * Returns null when the user doesn't hold the token, the chain isn't
 * supported for balance lookup, or the user has no wallet registered for
 * that chain. A null return tells the monitor to skip (not fail) the copy.
 */

export interface SellSizing {
  userWallet: string;
  /** Raw token units to sell (balance in base units of the token). */
  amountInRaw: string;
}

const EVM_NETWORKS: Record<string, Network> = {
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

const evmClients = new Map<string, Alchemy>();
function getEvmClient(chain: string): Alchemy | null {
  const net = EVM_NETWORKS[chain.toLowerCase()];
  if (!net) return null;
  let c = evmClients.get(net);
  if (!c) {
    c = new Alchemy({ apiKey: process.env.ALCHEMY_API_KEY ?? '', network: net });
    evmClients.set(net, c);
  }
  return c;
}

interface WalletAccountRow {
  address: string;
  chain: string;
}

async function userWalletForChain(userId: string, chain: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const lowerChain = chain.toLowerCase();
  const isSolana = lowerChain === 'solana' || lowerChain === 'sol';

  const { data } = await admin
    .from('wallet_accounts')
    .select('address,chain')
    .eq('user_id', userId)
    .returns<WalletAccountRow[]>();
  if (!data || data.length === 0) return null;

  if (isSolana) {
    const sol = data.find((w) => w.chain.toLowerCase() === 'solana' || w.chain.toLowerCase() === 'sol');
    return sol?.address ?? null;
  }
  // EVM wallets are shared across EVM chains; pick the first EVM-addressed one.
  const evm = data.find((w) => w.address.startsWith('0x'));
  return evm?.address ?? null;
}

async function evmTokenBalanceRaw(
  chain: string,
  walletAddress: string,
  tokenAddress: string,
): Promise<string | null> {
  const client = getEvmClient(chain);
  if (!client) return null;
  const res = await client.core.getTokenBalances(walletAddress, [tokenAddress]);
  const bal = res.tokenBalances?.[0]?.tokenBalance ?? null;
  if (!bal || bal === '0x' || bal === '0x0') return null;
  try {
    return BigInt(bal).toString();
  } catch {
    return null;
  }
}

async function solanaTokenBalanceRaw(
  walletAddress: string,
  mint: string,
): Promise<string | null> {
  const rpc =
    process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC ||
    `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { mint },
        { encoding: 'jsonParsed' },
      ],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    result?: {
      value?: Array<{
        account?: {
          data?: {
            parsed?: { info?: { tokenAmount?: { amount?: string } } };
          };
        };
      }>;
    };
  };
  const accounts = body.result?.value ?? [];
  let total = BigInt(0);
  for (const a of accounts) {
    const raw = a.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (!raw) continue;
    try {
      total += BigInt(raw);
    } catch {
      /* ignore */
    }
  }
  return total > BigInt(0) ? total.toString() : null;
}

export async function sizeCopySell(params: {
  userId: string;
  chain: string;
  tokenAddress: string;
}): Promise<SellSizing | null> {
  const wallet = await userWalletForChain(params.userId, params.chain);
  if (!wallet) return null;

  const lowerChain = params.chain.toLowerCase();
  const raw =
    lowerChain === 'solana' || lowerChain === 'sol'
      ? await solanaTokenBalanceRaw(wallet, params.tokenAddress)
      : await evmTokenBalanceRaw(params.chain, wallet, params.tokenAddress);

  if (!raw || raw === '0') return null;
  return { userWallet: wallet, amountInRaw: raw };
}
