import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Ask the Chain — SAFE natural-language query engine.
//
// Security model: Claude NEVER writes SQL. It picks one CAPABILITY from the
// closed set below and fills typed params; the server validates the params and
// runs a PARAMETERIZED query via the Supabase client over an ALLOWLIST of
// public-data tables only (whales, whale_activity, smart_money_convergence,
// token_risk_scores). No user/auth/wallet/PII table is reachable, no raw SQL
// from the model ever touches the DB, every result is row-capped. This makes
// the feature magical without opening an injection or data-exfiltration path.

export interface CapabilityResultRow {
  [k: string]: string | number | boolean | null;
}
export interface CapabilityResult {
  capability: string;
  columns: string[];
  rows: CapabilityResultRow[];
  summaryHint: string;
}

const MAX_ROWS = 25;

// Stablecoins + wrapped/native majors — demoted from flow/rotation answers as
// housekeeping noise (same policy as the on-brand boards).
const NOISE_SYMBOLS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDE', 'USDS', 'SUSDS', 'RLUSD', 'USDD', 'GUSD', 'LUSD', 'PYUSD', 'USDP', 'CRVUSD',
  'WETH', 'ETH', 'WBTC', 'BTC', 'WBNB', 'BNB', 'WSOL', 'SOL', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'PAXG',
]);

const CHAINS = ['ethereum', 'solana', 'base', 'arbitrum', 'bsc', 'polygon', 'avalanche', 'optimism'];
function safeChain(c?: string): string | null {
  const v = (c || '').toLowerCase().trim();
  return CHAINS.includes(v) ? v : null;
}
function clampLimit(n?: number): number {
  const v = Math.floor(Number(n) || 10);
  return Math.max(1, Math.min(MAX_ROWS, v));
}

// The closed capability set exposed to Claude as a tool schema.
export const CAPABILITY_SCHEMA = {
  type: 'object',
  properties: {
    capability: {
      type: 'string',
      enum: [
        'top_whales',
        'convergence_tokens',
        'whales_buying_token',
        'recent_whale_moves',
        'token_safety',
        'smart_money_flows',
        'smart_money_rotation',
        'wallet_activity',
      ],
      description: 'Which on-chain query best answers the user. Pick exactly one. Use smart_money_flows for "what is smart money accumulating/net-buying"; smart_money_rotation for "what is smart money rotating INTO/OUT OF" or momentum shifts; wallet_activity to drill into ONE specific wallet the user names by address ("what is 0x… doing", "what has this whale been buying/selling").',
    },
    metric: { type: 'string', enum: ['win_rate', 'pnl_30d_usd', 'whale_score'], description: 'For top_whales: ranking metric.' },
    archetype: { type: 'string', enum: ['accumulator', 'sniper', 'swing', 'distributor'], description: 'Optional whale style filter.' },
    chain: { type: 'string', description: 'Optional chain filter (ethereum, solana, base, arbitrum, bsc, polygon).' },
    token: { type: 'string', description: 'Token symbol or contract address, for whales_buying_token / token_safety.' },
    address: { type: 'string', description: 'A specific wallet address to drill into, for wallet_activity.' },
    action: { type: 'string', enum: ['buy', 'sell', 'swap'], description: 'For recent_whale_moves.' },
    min_usd: { type: 'number', description: 'For recent_whale_moves: minimum trade size in USD.' },
    hours: { type: 'number', description: 'Lookback window in hours (default 24).' },
    limit: { type: 'number', description: 'How many rows (max 25).' },
  },
  required: ['capability'],
} as const;

export interface CapabilityInput {
  capability: string;
  metric?: string;
  archetype?: string;
  chain?: string;
  token?: string;
  address?: string;
  action?: string;
  min_usd?: number;
  hours?: number;
  limit?: number;
}

export async function runCapability(input: CapabilityInput): Promise<CapabilityResult> {
  const sb = getSupabaseAdmin();
  const chain = safeChain(input.chain);
  const limit = clampLimit(input.limit);

  switch (input.capability) {
    case 'top_whales': {
      const metric = ['win_rate', 'pnl_30d_usd', 'whale_score'].includes(input.metric || '')
        ? input.metric! : 'whale_score';
      let q = sb.from('whales')
        .select('label, address, archetype, win_rate, pnl_30d_usd, whale_score, chain')
        .not(metric, 'is', null)
        .order(metric, { ascending: false })
        .limit(limit);
      if (chain) q = q.eq('chain', chain);
      if (input.archetype) q = q.eq('archetype', input.archetype);
      const { data } = await q;
      return {
        capability: 'top_whales',
        columns: ['label', 'archetype', 'win_rate', 'pnl_30d_usd', 'whale_score'],
        rows: (data ?? []).map((r) => ({
          label: r.label ?? `${(r.address || '').slice(0, 6)}…`,
          address: r.address,
          archetype: r.archetype,
          win_rate: r.win_rate,
          pnl_30d_usd: r.pnl_30d_usd,
          whale_score: r.whale_score,
        })),
        summaryHint: `Top ${limit} whales by ${metric}${chain ? ` on ${chain}` : ''}${input.archetype ? `, ${input.archetype} archetype` : ''}.`,
      };
    }
    case 'convergence_tokens': {
      let q = sb.from('smart_money_convergence')
        .select('token_symbol, token_address, chain, wallet_count, total_value_usd, detected_at')
        .eq('is_active', true)
        .order('wallet_count', { ascending: false })
        .limit(limit);
      if (chain) q = q.eq('chain', chain);
      const { data } = await q;
      return {
        capability: 'convergence_tokens',
        columns: ['token_symbol', 'chain', 'wallet_count', 'total_value_usd'],
        rows: (data ?? []).map((r) => ({
          token_symbol: r.token_symbol,
          token_address: r.token_address,
          chain: r.chain,
          wallet_count: r.wallet_count,
          total_value_usd: Number(r.total_value_usd ?? 0),
        })),
        summaryHint: `Tokens where multiple smart-money wallets are converging${chain ? ` on ${chain}` : ''}, by wallet count.`,
      };
    }
    case 'whales_buying_token': {
      const token = (input.token || '').trim();
      if (!token) return empty('whales_buying_token', 'No token was specified.');
      const isAddr = /^0x[a-fA-F0-9]{40}$/.test(token) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token);
      let q = sb.from('whale_activity')
        .select('whale_address, token_symbol, token_address, action, value_usd, chain, timestamp')
        .in('action', ['buy', 'swap'])
        .order('timestamp', { ascending: false })
        .limit(limit);
      q = isAddr ? q.ilike('token_address', token) : q.ilike('token_symbol', token.toUpperCase());
      if (chain) q = q.eq('chain', chain);
      const { data } = await q;
      return {
        capability: 'whales_buying_token',
        columns: ['whale_address', 'action', 'value_usd', 'chain', 'timestamp'],
        rows: (data ?? []).map((r) => ({
          whale_address: `${(r.whale_address || '').slice(0, 6)}…${(r.whale_address || '').slice(-4)}`,
          token_symbol: r.token_symbol,
          action: r.action,
          value_usd: Number(r.value_usd ?? 0),
          chain: r.chain,
          timestamp: r.timestamp,
        })),
        summaryHint: `Recent whale buys of ${token}${chain ? ` on ${chain}` : ''}.`,
      };
    }
    case 'recent_whale_moves': {
      const hours = Math.max(1, Math.min(168, Math.floor(Number(input.hours) || 24)));
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const action = ['buy', 'sell', 'swap'].includes(input.action || '') ? input.action! : null;
      const minUsd = Math.max(0, Number(input.min_usd) || 0);
      let q = sb.from('whale_activity')
        .select('whale_address, token_symbol, action, value_usd, chain, timestamp')
        .gte('timestamp', since)
        .order('value_usd', { ascending: false })
        .limit(limit);
      if (chain) q = q.eq('chain', chain);
      if (action) q = q.eq('action', action);
      if (minUsd > 0) q = q.gte('value_usd', minUsd);
      const { data } = await q;
      return {
        capability: 'recent_whale_moves',
        columns: ['whale_address', 'token_symbol', 'action', 'value_usd', 'chain'],
        rows: (data ?? []).map((r) => ({
          whale_address: `${(r.whale_address || '').slice(0, 6)}…${(r.whale_address || '').slice(-4)}`,
          token_symbol: r.token_symbol,
          action: r.action,
          value_usd: Number(r.value_usd ?? 0),
          chain: r.chain,
          timestamp: r.timestamp,
        })),
        summaryHint: `Biggest whale ${action ?? 'moves'} in the last ${hours}h${chain ? ` on ${chain}` : ''}${minUsd ? `, over $${minUsd.toLocaleString()}` : ''}.`,
      };
    }
    case 'token_safety': {
      const token = (input.token || '').trim();
      if (!token) return empty('token_safety', 'No token was specified.');
      let q = sb.from('token_risk_scores')
        .select('token_address, chain, risk_score, risk_level, risk_reasons, scanned_at')
        .ilike('token_address', token)
        .order('scanned_at', { ascending: false })
        .limit(limit);
      if (chain) q = q.eq('chain', chain);
      const { data } = await q;
      return {
        capability: 'token_safety',
        columns: ['token_address', 'chain', 'risk_score', 'risk_level'],
        rows: (data ?? []).map((r) => ({
          token_address: r.token_address,
          chain: r.chain,
          risk_score: r.risk_score,
          risk_level: r.risk_level,
          risk_reasons: Array.isArray(r.risk_reasons) ? r.risk_reasons.join(', ') : null,
        })),
        summaryHint: `Latest security scan for ${token}.`,
      };
    }
    case 'smart_money_flows': {
      // Net accumulation/distribution per token over a window (default 7d).
      const hours = Math.max(1, Math.min(720, Math.floor(Number(input.hours) || 168)));
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data } = await sb.rpc('smart_money_flows', { p_since: since, p_chain: chain, p_limit: MAX_ROWS });
      type FlowRow = { token_symbol: string; chain: string; inflow: number | null; outflow: number | null; net: number | null; whales: number };
      const rows = ((data ?? []) as FlowRow[])
        .filter((r) => !NOISE_SYMBOLS.has((r.token_symbol || '').toUpperCase()))
        .slice(0, limit)
        .map((r) => ({
          token_symbol: r.token_symbol,
          chain: r.chain,
          net_usd: Number(r.net ?? 0),
          inflow_usd: Number(r.inflow ?? 0),
          outflow_usd: Number(r.outflow ?? 0),
          whales: r.whales,
        }));
      return {
        capability: 'smart_money_flows',
        columns: ['token_symbol', 'chain', 'net_usd', 'whales'],
        rows,
        summaryHint: `Tokens smart money is net accumulating (positive net) or distributing (negative) over the last ${Math.round(hours / 24) || 1}d${chain ? ` on ${chain}` : ''}, stablecoins excluded.`,
      };
    }
    case 'smart_money_rotation': {
      // What's rotating in/out — net-flow delta vs the equal prior window.
      const hours = Math.max(1, Math.min(720, Math.floor(Number(input.hours) || 72)));
      const now = Date.now();
      const { data } = await sb.rpc('smart_money_rotation', {
        p_cur_since: new Date(now - hours * 3600_000).toISOString(),
        p_prev_since: new Date(now - 2 * hours * 3600_000).toISOString(),
        p_prev_until: new Date(now - hours * 3600_000).toISOString(),
        p_chain: chain, p_limit: MAX_ROWS,
      });
      type RotRow = { token_symbol: string; chain: string; cur_net: number | null; prev_net: number | null; delta: number | null; whales: number };
      const rows = ((data ?? []) as RotRow[])
        .filter((r) => !NOISE_SYMBOLS.has((r.token_symbol || '').toUpperCase()))
        .slice(0, limit)
        .map((r) => ({
          token_symbol: r.token_symbol,
          chain: r.chain,
          delta_usd: Number(r.delta ?? 0),
          current_net_usd: Number(r.cur_net ?? 0),
          prior_net_usd: Number(r.prev_net ?? 0),
          whales: r.whales,
        }));
      return {
        capability: 'smart_money_rotation',
        columns: ['token_symbol', 'chain', 'delta_usd', 'current_net_usd', 'prior_net_usd'],
        rows,
        summaryHint: `Tokens smart money is rotating INTO (positive delta) or OUT of (negative), measured as the change in net flow vs the prior ${Math.round(hours / 24) || 1}d window${chain ? ` on ${chain}` : ''}. A sign flip in current vs prior net is the strongest signal.`,
      };
    }
    case 'wallet_activity': {
      // Drill into ONE cohort member the user named by address: their recent
      // moves + a real net-flow summary (buys − sells) over the window. All
      // from whale_activity — no fabricated positions.
      const addr = (input.address || input.token || '').trim();
      const isAddr = /^0x[a-fA-F0-9]{40}$/.test(addr) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
      if (!isAddr) return empty('wallet_activity', 'Give me a wallet address (0x… or a Solana address) to look into.');
      const hours = Math.max(1, Math.min(720, Math.floor(Number(input.hours) || 168)));
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      let q = sb.from('whale_activity')
        .select('token_symbol, token_address, action, value_usd, chain, timestamp')
        .ilike('whale_address', addr)
        .gte('timestamp', since)
        .order('value_usd', { ascending: false })
        .limit(MAX_ROWS);
      if (chain) q = q.eq('chain', chain);
      const { data } = await q;
      const acts = (data ?? []) as Array<{ token_symbol: string | null; token_address: string | null; action: string; value_usd: number | null; chain: string; timestamp: string }>;
      // Net flow per token: buys add, sells subtract (real trade-time USD).
      const net = new Map<string, { symbol: string; net: number }>();
      for (const a of acts) {
        const key = (a.token_symbol || a.token_address || '').toUpperCase();
        if (!key) continue;
        const sign = a.action === 'sell' ? -1 : a.action === 'buy' ? 1 : 0;
        const cur = net.get(key) ?? { symbol: a.token_symbol || key, net: 0 };
        cur.net += sign * Number(a.value_usd ?? 0);
        net.set(key, cur);
      }
      const topNet = Array.from(net.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, limit);
      return {
        capability: 'wallet_activity',
        columns: ['token_symbol', 'net_usd', 'moves'],
        rows: topNet.map((t) => ({
          token_symbol: t.symbol,
          net_usd: Math.round(t.net),
          moves: acts.filter((a) => (a.token_symbol || a.token_address || '').toUpperCase() === t.symbol.toUpperCase()).length,
        })),
        summaryHint: acts.length === 0
          ? `No recorded activity for ${addr.slice(0, 6)}…${addr.slice(-4)} in the last ${Math.round(hours / 24) || 1}d. This wallet may not be in the tracked cohort.`
          : `${addr.slice(0, 6)}…${addr.slice(-4)}: net USD flow per token over the last ${Math.round(hours / 24) || 1}d (positive = net buying, negative = net selling), from ${acts.length} recorded moves.`,
      };
    }
    default:
      return empty('unknown', 'That question is outside what Ask the Chain can query right now.');
  }
}

function empty(cap: string, hint: string): CapabilityResult {
  return { capability: cap, columns: [], rows: [], summaryHint: hint };
}
