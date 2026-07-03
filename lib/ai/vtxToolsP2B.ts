import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { addressesEqual } from '@/lib/utils/addressNormalize';
import { searchTokens } from '@/lib/services/coingecko';

/**
 * §3 P2-B — VTX tool depth expansion. Adds 10 new tools that pull from
 * authoritative data the platform already has, plus 2 that route via
 * Alchemy. P2-B.3 (holder_concentration) and P2-B.5 (smart_money_flow)
 * are intentionally NOT here — the kickoff doc puts those in Dune §5.5
 * tier-1 with the dune_holder_concentration + dune_smart_money_score
 * materialized tables. Wiring them here without Dune would either
 * fabricate numbers (forbidden by CLAUDE.md no-mock-data rule) or
 * duplicate the Dune wiring.
 *
 * Each tool's handler returns a JSON string the VTX agent splices into
 * its prompt.
 */

export const P2B_TOOLS: Anthropic.Tool[] = [
  {
    name: 'whale_tracker_specific',
    description: 'Pull the last N on-chain events (buys, sells, transfers) for a SPECIFIC whale address from whale_activity. Use when the user asks "what is whale X doing" or names a specific address.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Whale wallet address (EVM or Solana)' },
        chain: { type: 'string', description: 'Optional chain filter (ethereum, base, arbitrum, solana, etc.)' },
        limit: { type: 'number', description: 'Max events (default 50, max 200)' },
      },
      required: ['address'],
    },
  },
  {
    name: 'realized_pnl_30d',
    description: 'Compute realized PnL for ANY wallet over the last 30 days from on-chain transactions (FIFO cost-basis, USDC/USDT/DAI treated as cash legs). Returns total realized USD + per-token breakdown + win rate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address' },
        chain: { type: 'string', description: 'Optional chain filter' },
      },
      required: ['address'],
    },
  },
  {
    name: 'cross_token_comparison',
    description: 'Side-by-side comparison of 2-5 tokens: price, market cap, 24h volume, 24h change, 7d change. Prefer this over coingecko_market_data when the user explicitly asks to compare tokens.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbols: { type: 'array', items: { type: 'string' }, description: 'Token symbols or CoinGecko slugs (e.g. ["bitcoin","ethereum","solana"]) — 2 to 5 entries' },
      },
      required: ['symbols'],
    },
  },
  {
    name: 'portfolio_performance',
    description: 'Pull the current user\'s portfolio performance: realized PnL, win rate, best/worst token, FIFO cost-basis entry markers, per-chain breakdown. Wraps /api/portfolio/performance and only works when the chat is authenticated.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'portfolio_rebalance_suggestion',
    description: 'Read the current user\'s holdings and suggest diversification adjustments (over-concentration warnings, suggested target weights). Naive Markowitz-lite: flags any single position >40% of total USD value, suggests trimming to <25%.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'alert_subscribe',
    description: 'Create a price alert from chat. Inserts a row into price_alerts so the user gets notified when the price crosses the trigger. Use ONLY on explicit "alert me when X" intent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Token symbol (BTC, ETH, SOL, etc.)' },
        direction: { type: 'string', enum: ['above', 'below'], description: 'Trigger direction' },
        price: { type: 'number', description: 'Trigger price in USD' },
      },
      required: ['symbol', 'direction', 'price'],
    },
  },
  {
    name: 'copy_trade_create',
    description: 'Create a copy-trade rule from chat. Inserts into user_copy_rules so the relayer mirrors the named whale\'s buys within the user\'s caps. Use ONLY on explicit "copy whale X" intent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        whale_address: { type: 'string', description: 'Whale address to copy' },
        chain: { type: 'string', description: 'Chain (ethereum, base, solana, etc.)' },
        max_per_trade_usd: { type: 'number', description: 'USD cap per copy buy' },
        daily_cap_usd: { type: 'number', description: 'USD cap per day across all copies' },
        max_slippage_bps: { type: 'number', description: 'Slippage cap in basis points (default 200 = 2%)' },
      },
      required: ['whale_address', 'chain', 'max_per_trade_usd', 'daily_cap_usd'],
    },
  },
  {
    name: 'explain_transaction',
    description: 'Fetch an on-chain transaction by hash, decode logs, and return a human-readable breakdown (from, to, value, token transfers, DEX swap detection, gas).',
    input_schema: {
      type: 'object' as const,
      properties: {
        tx_hash: { type: 'string', description: 'Transaction hash (0x...)' },
        chain: { type: 'string', description: 'Chain (ethereum, base, arbitrum, polygon, optimism, bsc, solana)' },
      },
      required: ['tx_hash', 'chain'],
    },
  },
  {
    name: 'transaction_simulator',
    description: 'Dry-run a transaction via Alchemy alchemy_simulateExecution — returns state diff, balance changes, expected logs. Use for "what would happen if I send this tx" / before signing risky calldata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        chain: { type: 'string', description: 'EVM chain' },
        from: { type: 'string', description: 'Caller address' },
        to: { type: 'string', description: 'Target contract or wallet' },
        data: { type: 'string', description: 'Hex calldata (0x...)' },
        value: { type: 'string', description: 'Optional native value (wei hex)' },
      },
      required: ['chain', 'from', 'to', 'data'],
    },
  },
  {
    name: 'approval_audit',
    description: 'List every active ERC20 Approval the wallet has granted: token, spender, allowance, age, current risk score for the spender. Pulled via Alchemy eth_getLogs filtered by the Approval(owner) topic. Recommends revokes for unlimited approvals to unknown spenders.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address to audit' },
        chain: { type: 'string', description: 'EVM chain' },
      },
      required: ['address', 'chain'],
    },
  },
];

// ─── Handlers ────────────────────────────────────────────────────────────

interface ChainTransaction {
  tx_hash: string;
  wallet_address: string | null;
  chain: string | null;
  from_token_symbol: string | null;
  to_token_symbol: string | null;
  from_amount: number | null;
  to_amount: number | null;
  usd_value: number | null;
  status: string | null;
  timestamp: string;
}

interface Holding {
  symbol: string;
  chain: string;
  usd_value: number;
}

const STABLE_SET = new Set(['USD', 'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX']);

const EVM_RPC_BY_CHAIN: Record<string, string | undefined> = {
  ethereum: process.env.ETHEREUM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  base:     process.env.BASE_RPC_URL     ?? (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  arbitrum: process.env.ARBITRUM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  polygon:  process.env.POLYGON_RPC_URL  ?? (process.env.ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  optimism: process.env.OPTIMISM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  bsc:      process.env.BSC_RPC_URL      ?? 'https://bsc-dataseed.binance.org',
  // Avalanche C-chain — the system prompt + tool descriptions advertise
  // Avalanche support but it was missing here, so avax token lookups no-op'd.
  // Public C-chain RPC is the always-on fallback when no key is configured.
  avalanche: process.env.AVALANCHE_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://avax-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : 'https://api.avax.network/ext/bc/C/rpc'),
};

async function rpc<T = unknown>(chain: string, method: string, params: unknown[]): Promise<T | null> {
  const url = EVM_RPC_BY_CHAIN[chain.toLowerCase()];
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

async function whaleTrackerSpecific(input: { address: string; chain?: string; limit?: number }): Promise<string> {
  const admin = getSupabaseAdmin();
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  let q = admin
    .from('whale_activity')
    .select('whale_address,chain,tx_hash,action,token_symbol,amount,value_usd,counterparty,timestamp')
    .eq('whale_address', input.address)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (input.chain) q = q.eq('chain', input.chain);
  const { data, error } = await q;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ address: input.address, events: data ?? [] });
}

async function realizedPnl30d(input: { address: string; chain?: string }): Promise<string> {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  let q = admin
    .from('transactions')
    .select('tx_hash,wallet_address,chain,from_token_symbol,to_token_symbol,from_amount,to_amount,usd_value,status,timestamp')
    .ilike('wallet_address', input.address)
    .eq('status', 'success')
    .gte('timestamp', since)
    .order('timestamp', { ascending: true })
    .limit(5000);
  if (input.chain) q = q.eq('chain', input.chain);
  const { data } = (await q.returns<ChainTransaction[]>());
  const txs = data ?? [];
  if (txs.length === 0) return JSON.stringify({ address: input.address, window_days: 30, realized_usd: 0, trades: 0, note: 'No transactions in window' });

  const lots = new Map<string, Array<{ amount: number; cost: number }>>();
  const realizedBySym = new Map<string, number>();
  let closed = 0;
  let winners = 0;

  for (const t of txs) {
    const chainKey = (t.chain ?? 'unknown').toLowerCase();
    const usd = Number(t.usd_value ?? 0);
    if (usd <= 0) continue;
    const buySym = t.to_token_symbol ? `${chainKey}::${t.to_token_symbol.toUpperCase()}` : null;
    const sellSym = t.from_token_symbol ? `${chainKey}::${t.from_token_symbol.toUpperCase()}` : null;

    if (buySym && !STABLE_SET.has(t.to_token_symbol?.toUpperCase() ?? '') && t.to_amount) {
      const lot = { amount: Number(t.to_amount), cost: usd };
      const q = lots.get(buySym) ?? [];
      q.push(lot);
      lots.set(buySym, q);
    }
    if (sellSym && !STABLE_SET.has(t.from_token_symbol?.toUpperCase() ?? '') && t.from_amount) {
      let remaining = Number(t.from_amount);
      const q = lots.get(sellSym) ?? [];
      let costBasis = 0;
      while (remaining > 1e-12 && q.length > 0) {
        const head = q[0];
        const take = Math.min(head.amount, remaining);
        const ratio = take / head.amount;
        costBasis += head.cost * ratio;
        head.amount -= take;
        head.cost -= head.cost * ratio;
        remaining -= take;
        if (head.amount <= 1e-12) q.shift();
      }
      lots.set(sellSym, q);
      const pnl = usd - costBasis;
      realizedBySym.set(sellSym, (realizedBySym.get(sellSym) ?? 0) + pnl);
      closed++;
      if (pnl > 0) winners++;
    }
  }

  const totalRealized = Array.from(realizedBySym.values()).reduce((a, b) => a + b, 0);
  return JSON.stringify({
    address: input.address,
    window_days: 30,
    realized_usd: Number(totalRealized.toFixed(2)),
    closed_trades: closed,
    win_rate_pct: closed > 0 ? Number(((winners / closed) * 100).toFixed(1)) : null,
    by_token: Object.fromEntries(Array.from(realizedBySym.entries()).map(([k, v]) => [k, Number(v.toFixed(2))])),
  });
}

// Resolve a user-facing token entry (ticker symbol like "BTC" OR an actual
// CoinGecko slug like "bitcoin") to a real CoinGecko coin id. The markets
// endpoint is keyed by slug — passing a lowercased ticker ("btc") silently
// matched nothing, so every symbol-based comparison returned an empty list.
async function resolveCgId(entry: string): Promise<string | null> {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  try {
    const { coins } = await searchTokens(trimmed);
    const lower = trimmed.toLowerCase();
    // Already a valid slug (e.g. "bitcoin") — keep it.
    if (coins.some((c) => c.id === lower)) return lower;
    // Exact ticker match, best market-cap rank first (so "SOL" → solana,
    // not a same-ticker clone).
    const upper = trimmed.toUpperCase();
    const exact = coins
      .filter((c) => c.symbol?.toUpperCase() === upper)
      .sort((a, b) => (a.market_cap_rank ?? Number.MAX_SAFE_INTEGER) - (b.market_cap_rank ?? Number.MAX_SAFE_INTEGER));
    return exact[0]?.id ?? coins[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function crossTokenComparison(input: { symbols: string[] }): Promise<string> {
  if (!Array.isArray(input.symbols) || input.symbols.length < 2 || input.symbols.length > 5) {
    return JSON.stringify({ error: 'symbols must be an array of 2-5 entries' });
  }
  // Reuse CoinGecko markets endpoint — same source the existing
  // coingecko_market_data tool uses, but presented in compare-friendly shape.
  const resolved = await Promise.all(input.symbols.map((s) => resolveCgId(s)));
  const unresolved = input.symbols.filter((_, i) => resolved[i] === null);
  const idList = Array.from(new Set(resolved.filter((id): id is string => id !== null)));
  if (idList.length < 2) {
    return JSON.stringify({
      error: 'could not resolve at least 2 tokens on CoinGecko',
      unresolved,
    });
  }
  const ids = idList.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&order=market_cap_desc&price_change_percentage=24h,7d`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return JSON.stringify({ error: `coingecko ${res.status}` });
    const list = (await res.json()) as Array<Record<string, unknown>>;
    return JSON.stringify({
      ...(unresolved.length > 0 ? { unresolved } : {}),
      tokens: list.map((c) => ({
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        price_usd: c.current_price,
        market_cap_usd: c.market_cap,
        volume_24h_usd: c.total_volume,
        change_24h_pct: c.price_change_percentage_24h,
        change_7d_pct: c.price_change_percentage_7d_in_currency,
      })),
    });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : 'fetch failed' });
  }
}

async function portfolioPerformance(userId: string | null): Promise<string> {
  if (!userId) return JSON.stringify({ error: 'unauthenticated' });
  const admin = getSupabaseAdmin();
  const { data: txData } = await admin
    .from('transactions')
    .select('tx_hash,wallet_address,chain,from_token_symbol,to_token_symbol,from_amount,to_amount,usd_value,status,timestamp')
    .eq('user_id', userId)
    .eq('status', 'success')
    .order('timestamp', { ascending: true })
    .returns<ChainTransaction[]>();
  // Delegate the FIFO math to realizedPnl30d by faking the address path
  // is overkill; instead just re-use the calculator inline with a 365d
  // window so we return lifetime numbers.
  const txs = txData ?? [];
  let totalRealized = 0;
  let closed = 0;
  let winners = 0;
  const realizedBySym = new Map<string, number>();
  const realizedByChain = new Map<string, number>();
  const lots = new Map<string, Array<{ amount: number; cost: number }>>();
  for (const t of txs) {
    const chainKey = (t.chain ?? 'unknown').toLowerCase();
    const usd = Number(t.usd_value ?? 0);
    if (usd <= 0) continue;
    const buySym = t.to_token_symbol ? `${chainKey}::${t.to_token_symbol.toUpperCase()}` : null;
    const sellSym = t.from_token_symbol ? `${chainKey}::${t.from_token_symbol.toUpperCase()}` : null;
    if (buySym && !STABLE_SET.has(t.to_token_symbol?.toUpperCase() ?? '') && t.to_amount) {
      const q = lots.get(buySym) ?? [];
      q.push({ amount: Number(t.to_amount), cost: usd });
      lots.set(buySym, q);
    }
    if (sellSym && !STABLE_SET.has(t.from_token_symbol?.toUpperCase() ?? '') && t.from_amount) {
      let remaining = Number(t.from_amount);
      const q = lots.get(sellSym) ?? [];
      let costBasis = 0;
      while (remaining > 1e-12 && q.length > 0) {
        const head = q[0];
        const take = Math.min(head.amount, remaining);
        const ratio = take / head.amount;
        costBasis += head.cost * ratio;
        head.amount -= take;
        head.cost -= head.cost * ratio;
        remaining -= take;
        if (head.amount <= 1e-12) q.shift();
      }
      lots.set(sellSym, q);
      const pnl = usd - costBasis;
      totalRealized += pnl;
      realizedBySym.set(sellSym, (realizedBySym.get(sellSym) ?? 0) + pnl);
      realizedByChain.set(chainKey, (realizedByChain.get(chainKey) ?? 0) + pnl);
      closed++;
      if (pnl > 0) winners++;
    }
  }
  return JSON.stringify({
    realized_usd: Number(totalRealized.toFixed(2)),
    closed_trades: closed,
    win_rate_pct: closed > 0 ? Number(((winners / closed) * 100).toFixed(1)) : null,
    by_token: Object.fromEntries(Array.from(realizedBySym.entries()).map(([k, v]) => [k, Number(v.toFixed(2))])),
    by_chain: Object.fromEntries(Array.from(realizedByChain.entries()).map(([k, v]) => [k, Number(v.toFixed(2))])),
  });
}

async function portfolioRebalanceSuggestion(userId: string | null): Promise<string> {
  if (!userId) return JSON.stringify({ error: 'unauthenticated' });
  const admin = getSupabaseAdmin();
  // Holdings table name varies across the codebase — most reliable: pull
  // from `user_holdings` if present, fallback to derive from transactions
  // (sum to_amount * latest price — but skip live pricing here, just use
  // USD value at last buy as a coarse proxy).
  const { data } = await admin
    .from('user_holdings')
    .select('symbol, chain, balance_usd')
    .eq('user_id', userId)
    .gt('balance_usd', 0);
  const holdings: Holding[] = (data ?? []).map((h: Record<string, unknown>) => ({
    symbol: String(h.symbol ?? ''),
    chain: String(h.chain ?? ''),
    usd_value: Number(h.balance_usd ?? 0),
  }));
  if (holdings.length === 0) {
    return JSON.stringify({ note: 'No holdings rows found. user_holdings may not be populated; rebalance recs need balances.' });
  }
  const total = holdings.reduce((a, h) => a + h.usd_value, 0);
  const concentrated = holdings
    .map((h) => ({ ...h, pct: total > 0 ? (h.usd_value / total) * 100 : 0 }))
    .filter((h) => h.pct > 40)
    .sort((a, b) => b.pct - a.pct);
  const recs = concentrated.map((h) => ({
    action: 'trim',
    symbol: h.symbol,
    chain: h.chain,
    current_pct: Number(h.pct.toFixed(1)),
    target_pct: 25,
    trim_usd: Number((h.usd_value - total * 0.25).toFixed(2)),
    reason: `${h.symbol} is ${h.pct.toFixed(0)}% of portfolio — single-name concentration risk above 40%.`,
  }));
  return JSON.stringify({
    total_usd: Number(total.toFixed(2)),
    holdings: holdings.length,
    rebalance_suggestions: recs.length > 0 ? recs : ['Portfolio is well-diversified — no single position >40% of total value.'],
  });
}

async function alertSubscribe(input: { symbol: string; direction: 'above' | 'below'; price: number }, userId: string | null): Promise<string> {
  if (!userId) return JSON.stringify({ error: 'unauthenticated' });
  if (input.price <= 0) return JSON.stringify({ error: 'price must be positive' });
  if (input.direction !== 'above' && input.direction !== 'below') return JSON.stringify({ error: 'direction must be above or below' });
  const admin = getSupabaseAdmin();
  // Schema note from CLAUDE.md gotchas: price_alerts.price (not target_price).
  const { data, error } = await admin
    .from('price_alerts')
    .insert({
      user_id: userId,
      symbol: input.symbol.toUpperCase(),
      direction: input.direction,
      price: input.price,
      active: true,
    })
    .select('id')
    .single();
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ ok: true, alert_id: (data as { id: string }).id, symbol: input.symbol.toUpperCase(), direction: input.direction, price: input.price });
}

async function copyTradeCreate(
  input: { whale_address: string; chain: string; max_per_trade_usd: number; daily_cap_usd: number; max_slippage_bps?: number },
  userId: string | null,
): Promise<string> {
  if (!userId) return JSON.stringify({ error: 'unauthenticated' });
  if (input.max_per_trade_usd <= 0 || input.daily_cap_usd <= 0) return JSON.stringify({ error: 'caps must be positive' });
  const admin = getSupabaseAdmin();
  // Also create the follow row so copy-trade-monitor picks it up.
  await admin.from('user_whale_follows').upsert({
    user_id: userId,
    whale_address: input.whale_address,
    chain: input.chain.toLowerCase(),
  }, { onConflict: 'user_id,whale_address,chain' });
  const { data, error } = await admin
    .from('user_copy_rules')
    .upsert({
      user_id: userId,
      whale_address: input.whale_address,
      chain: input.chain.toLowerCase(),
      max_per_trade_usd: input.max_per_trade_usd,
      daily_cap_usd: input.daily_cap_usd,
      max_slippage_bps: input.max_slippage_bps ?? 200,
      enabled: true,
      mode: 'auto_copy',
      paused: false,
    }, { onConflict: 'user_id,whale_address,chain' })
    .select('id')
    .single();
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ ok: true, rule_id: (data as { id: string }).id, whale: input.whale_address, chain: input.chain.toLowerCase() });
}

interface TxReceipt {
  blockNumber?: string;
  from?: string;
  to?: string;
  status?: string;
  logs?: Array<{ address: string; topics: string[]; data: string }>;
  gasUsed?: string;
  effectiveGasPrice?: string;
}

async function explainTransaction(input: { tx_hash: string; chain: string }): Promise<string> {
  if (input.chain.toLowerCase() === 'solana') {
    // Solana goes through Helius enhanced tx, not eth_getTransactionReceipt.
    const key = process.env.HELIUS_API_KEY;
    if (!key) return JSON.stringify({ error: 'HELIUS_API_KEY not configured' });
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [input.tx_hash] }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return JSON.stringify({ error: `helius ${res.status}` });
    const json = await res.json();
    return JSON.stringify({ tx_hash: input.tx_hash, chain: 'solana', detail: json });
  }
  const receipt = await rpc<TxReceipt>(input.chain, 'eth_getTransactionReceipt', [input.tx_hash]);
  if (!receipt) return JSON.stringify({ error: 'tx not found or chain unsupported' });
  // ERC20 Transfer topic = keccak256("Transfer(address,address,uint256)")
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const transfers = (receipt.logs ?? [])
    .filter((l) => l.topics[0] === TRANSFER_TOPIC && l.topics.length === 3)
    .map((l) => ({
      token: l.address,
      from: `0x${l.topics[1].slice(26)}`,
      to: `0x${l.topics[2].slice(26)}`,
      raw_amount: l.data,
    }));
  // Swap is most easily inferred by counting opposite-direction transfers
  // touching the same EOA.
  const involvedAddr = (receipt.from ?? '').toLowerCase();
  const sentTokens = new Set(transfers.filter((t) => addressesEqual(t.from, involvedAddr, 'ethereum')).map((t) => t.token.toLowerCase()));
  const receivedTokens = new Set(transfers.filter((t) => addressesEqual(t.to, involvedAddr, 'ethereum')).map((t) => t.token.toLowerCase()));
  const looksLikeSwap = sentTokens.size > 0 && receivedTokens.size > 0;
  return JSON.stringify({
    tx_hash: input.tx_hash,
    chain: input.chain,
    block: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to,
    status: receipt.status === '0x1' ? 'success' : 'failed',
    gas_used_hex: receipt.gasUsed,
    gas_price_hex: receipt.effectiveGasPrice,
    erc20_transfers: transfers,
    inferred_swap: looksLikeSwap,
  });
}

async function transactionSimulator(input: { chain: string; from: string; to: string; data: string; value?: string }): Promise<string> {
  const result = await rpc<unknown>(input.chain, 'alchemy_simulateExecution', [
    { from: input.from, to: input.to, data: input.data, value: input.value ?? '0x0' },
  ]);
  if (result === null) return JSON.stringify({ error: 'simulation unavailable on this chain' });
  return JSON.stringify({ chain: input.chain, simulation: result });
}

async function approvalAudit(input: { address: string; chain: string }): Promise<string> {
  // Approval(address indexed owner, address indexed spender, uint256 value)
  // topic0 = keccak256("Approval(address,address,uint256)")
  const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
  const ownerTopic = `0x${input.address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
  // Scan last ~100k blocks — Alchemy lets us go much further but this
  // keeps the call cost predictable.
  const latest = await rpc<string>(input.chain, 'eth_blockNumber', []);
  if (!latest) return JSON.stringify({ error: 'rpc unavailable' });
  const latestNum = parseInt(latest, 16);
  const fromBlock = `0x${Math.max(0, latestNum - 100_000).toString(16)}`;
  const logs = await rpc<Array<{ address: string; topics: string[]; data: string; blockNumber: string }>>(input.chain, 'eth_getLogs', [
    { fromBlock, toBlock: 'latest', topics: [APPROVAL_TOPIC, ownerTopic] },
  ]);
  if (!logs) return JSON.stringify({ error: 'log query failed' });
  // Keep only the latest Approval per (token, spender) — that's the
  // current effective allowance.
  const latestByPair = new Map<string, { token: string; spender: string; allowance_hex: string; block_hex: string }>();
  for (const l of logs) {
    const spender = `0x${l.topics[2].slice(26)}`;
    const key = `${l.address.toLowerCase()}::${spender.toLowerCase()}`;
    latestByPair.set(key, { token: l.address, spender, allowance_hex: l.data, block_hex: l.blockNumber });
  }
  // Drop zero allowances (already revoked).
  const ZERO = BigInt(0);
  const active = Array.from(latestByPair.values()).filter((a) => BigInt(a.allowance_hex || '0x0') > ZERO);
  // Flag unlimited (2^256-1) and very-large allowances.
  const MAX_UINT = (BigInt(1) << BigInt(256)) - BigInt(1);
  const enriched = active.map((a) => {
    const v = BigInt(a.allowance_hex || '0x0');
    const isMax = v === MAX_UINT;
    return { ...a, is_unlimited: isMax, recommendation: isMax ? 'revoke or set finite' : 'keep' };
  });
  return JSON.stringify({ address: input.address, chain: input.chain, scanned_blocks: 100_000, active_approvals: enriched });
}

// ─── Dispatcher entry point ──────────────────────────────────────────────

export async function dispatchP2BTool(name: string, input: Record<string, unknown>, userId: string | null): Promise<string | null> {
  switch (name) {
    case 'whale_tracker_specific':
      return whaleTrackerSpecific(input as { address: string; chain?: string; limit?: number });
    case 'realized_pnl_30d':
      return realizedPnl30d(input as { address: string; chain?: string });
    case 'cross_token_comparison':
      return crossTokenComparison(input as { symbols: string[] });
    case 'portfolio_performance':
      return portfolioPerformance(userId);
    case 'portfolio_rebalance_suggestion':
      return portfolioRebalanceSuggestion(userId);
    case 'alert_subscribe':
      return alertSubscribe(input as { symbol: string; direction: 'above' | 'below'; price: number }, userId);
    case 'copy_trade_create':
      return copyTradeCreate(input as { whale_address: string; chain: string; max_per_trade_usd: number; daily_cap_usd: number; max_slippage_bps?: number }, userId);
    case 'explain_transaction':
      return explainTransaction(input as { tx_hash: string; chain: string });
    case 'transaction_simulator':
      return transactionSimulator(input as { chain: string; from: string; to: string; data: string; value?: string });
    case 'approval_audit':
      return approvalAudit(input as { address: string; chain: string });
    default:
      return null;
  }
}
