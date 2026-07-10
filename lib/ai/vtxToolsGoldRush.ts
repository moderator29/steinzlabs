import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import {
  goldrushEnabled,
  goldrushSupportsChain,
  getWalletBalances,
  getWalletTransactions,
} from '@/lib/services/goldrush';

/**
 * GoldRush (Covalent) VTX tools — real multichain wallet balances + tx history.
 *
 * These are OPTIONAL: when COVALENT_API_KEY / GOLDRUSH_API_KEY is unset, the
 * handlers return { unavailable: 'goldrush_unconfigured' } so the model uses
 * its OTHER tools (wallet_profile, evm/solana_token_data — Alchemy/RPC backed)
 * and states honestly that GoldRush wasn't provisioned. They never fabricate
 * balances or prices (CLAUDE.md no-mock-data rule).
 *
 * They ADD to the existing registry — nothing is removed. wallet_profile stays
 * the default wallet lookup; these give the agent a direct GoldRush path when a
 * caller specifically wants GoldRush's 100+ chain coverage / full tx history.
 */

export const GOLDRUSH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'goldrush_wallet_balances',
    description:
      'REAL token balances (native + ERC-20/SPL) for a wallet on a specific chain, via GoldRush (Covalent). Returns each holding with human amount, spot USD price and USD value when priceable. Prefer this for precise multichain balance snapshots (ethereum/base/bsc/arbitrum/optimism/polygon/avalanche/solana). Only available when the GoldRush key is configured; otherwise fall back to wallet_profile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address (EVM 0x… or Solana base58).' },
        chain: {
          type: 'string',
          description: 'Chain id: ethereum, base, bsc, arbitrum, optimism, polygon, avalanche, or solana.',
        },
      },
      required: ['address', 'chain'],
    },
  },
  {
    name: 'goldrush_wallet_transactions',
    description:
      'REAL recent transaction history for a wallet on a specific chain, via GoldRush (Covalent). Returns hash, timestamp, from/to, value and USD-quoted value/fee per tx. Use for "what has this wallet been doing lately" / activity questions. Only available when the GoldRush key is configured.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address (EVM 0x… or Solana base58).' },
        chain: {
          type: 'string',
          description: 'Chain id: ethereum, base, bsc, arbitrum, optimism, polygon, avalanche, or solana.',
        },
        page_size: { type: 'number', description: 'How many recent txs to return (1–100, default 25).' },
      },
      required: ['address', 'chain'],
    },
  },
];

const UNCONFIGURED = JSON.stringify({
  unavailable: 'goldrush_unconfigured',
  note: 'GoldRush (Covalent) is not provisioned. Use wallet_profile / evm_token_data / solana_token_data instead and say GoldRush was unavailable — do not fabricate balances.',
});

function unsupportedChain(chain: string): string {
  return JSON.stringify({
    unavailable: 'goldrush_chain_unsupported',
    chain,
    note: `GoldRush has no verified mapping for "${chain}". Use wallet_profile (raw RPC) for this chain instead.`,
  });
}

async function handleWalletBalances(input: { address: string; chain: string }): Promise<string> {
  if (!goldrushEnabled()) return UNCONFIGURED;
  const { address, chain } = input;
  if (!address || !chain) return JSON.stringify({ error: 'address and chain are required' });
  if (!goldrushSupportsChain(chain)) return unsupportedChain(chain);
  const balances = await getWalletBalances(chain, address);
  if (balances.length === 0) {
    return JSON.stringify({ address, chain, holdings: [], note: 'No balances returned by GoldRush (empty wallet or temporarily unavailable).' });
  }
  const priced = balances.filter((b) => (b.valueUSD ?? 0) > 0).sort((a, b) => (b.valueUSD ?? 0) - (a.valueUSD ?? 0));
  const shown = (priced.length ? priced : balances).slice(0, 25);
  const totalUSD = balances.reduce((s, b) => s + (b.valueUSD ?? 0), 0);
  return JSON.stringify({
    source: 'goldrush',
    address,
    chain,
    total_value_usd: Math.round(totalUSD * 100) / 100,
    holding_count: balances.length,
    holdings: shown.map((b) => ({
      symbol: b.symbol,
      name: b.name,
      contract_address: b.contractAddress,
      amount: b.amount,
      price_usd: b.priceUSD,
      value_usd: b.valueUSD,
      native: b.isNative,
    })),
  });
}

async function handleWalletTransactions(input: {
  address: string;
  chain: string;
  page_size?: number;
}): Promise<string> {
  if (!goldrushEnabled()) return UNCONFIGURED;
  const { address, chain } = input;
  if (!address || !chain) return JSON.stringify({ error: 'address and chain are required' });
  if (!goldrushSupportsChain(chain)) return unsupportedChain(chain);
  const txs = await getWalletTransactions(chain, address, { pageSize: input.page_size });
  return JSON.stringify({
    source: 'goldrush',
    address,
    chain,
    tx_count: txs.length,
    transactions: txs.map((t) => ({
      hash: t.hash,
      time: t.blockSignedAt,
      from: t.from,
      to: t.to,
      value: t.value,
      value_usd: t.valueQuoteUSD,
      fee_usd: t.feeQuoteUSD,
      successful: t.successful,
    })),
  });
}

/**
 * Shared dispatcher — returns null when the tool name isn't ours (so the main
 * VTX dispatcher keeps checking other registries), mirroring dispatchDuneTool.
 */
export async function dispatchGoldRushTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string | null> {
  switch (name) {
    case 'goldrush_wallet_balances':
      return handleWalletBalances(input as { address: string; chain: string });
    case 'goldrush_wallet_transactions':
      return handleWalletTransactions(input as { address: string; chain: string; page_size?: number });
    default:
      return null;
  }
}
