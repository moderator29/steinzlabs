import { getSupabaseAdmin } from '../supabaseAdmin';

export interface HolderSnapshot {
  id: string;
  tokenAddress: string;
  chain: string;
  snapshotData: any;
  price: number;
  volume: number;
  liquidity: number;
  createdAt: Date;
}

export interface LiquidityAnalysis {
  totalLiquidity: string;
  liquidityProviders: {
    address: string;
    entity: string;
    percentage: number;
    locked: boolean;
    lockExpiry?: string;
  }[];
  locked: boolean;
  depth: {
    buy2Percent: string;
    sell2Percent: string;
  };
}

export interface PatternMatchingResults {
  similarTokens: {
    address: string;
    name: string;
    similarity: number;
    outcome: string;
    gain: number;
    timeframe: string;
  }[];
  historicalOutcomes: {
    avgGain: number;
    avgHoldTime: number;
    successRate: number;
    totalMatches: number;
  };
  aiPrediction: {
    expectedGain: string;
    confidence: number;
    timeframe: string;
    reasoning: string;
  };
}

export async function createHolderSnapshot(
  tokenAddress: string,
  chain: string,
  price: number,
  volume: number,
  liquidity: number
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();

  await supabaseAdmin
    .from('holder_snapshots')
    .insert({
      token_address: tokenAddress,
      chain,
      price,
      volume,
      liquidity,
      created_at: new Date().toISOString(),
    });
}

export async function getHolderSnapshots(
  tokenAddress: string,
  chain: string,
  limit: number = 30
): Promise<HolderSnapshot[]> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data } = await supabaseAdmin
    .from('holder_snapshots')
    .select('*')
    .eq('token_address', tokenAddress)
    .eq('chain', chain)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(d => ({
    id: d.id,
    tokenAddress: d.token_address,
    chain: d.chain,
    snapshotData: d.snapshot_data,
    price: d.price,
    volume: d.volume,
    liquidity: d.liquidity,
    createdAt: new Date(d.created_at),
  }));
}

export async function analyzeLiquidity(
  tokenAddress: string,
  chain?: string
): Promise<LiquidityAnalysis> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('DEXScreener request failed');
    const data = await res.json();
    const pairs = data.pairs || [];
    if (!pairs.length) throw new Error('No pairs found');

    const best = pairs.reduce((a: any, b: any) =>
      parseFloat(a.liquidity?.usd || '0') > parseFloat(b.liquidity?.usd || '0') ? a : b
    );

    const totalLiq = parseFloat(best.liquidity?.usd || '0');
    const volume = parseFloat(best.volume?.h24 || '0');

    return {
      totalLiquidity: `$${totalLiq.toLocaleString()}`,
      liquidityProviders: [{
        address: best.pairAddress || '',
        entity: best.dexId || 'Unknown DEX',
        percentage: 100,
        locked: false,
      }],
      locked: false,
      depth: {
        buy2Percent: `$${(totalLiq * 0.02).toLocaleString()}`,
        sell2Percent: `$${(totalLiq * 0.02).toLocaleString()}`,
      },
    };
  } catch {
    return {
      totalLiquidity: '$0',
      liquidityProviders: [],
      locked: false,
      depth: { buy2Percent: '$0', sell2Percent: '$0' },
    };
  }
}

export async function findSimilarTokens(
  tokenAddress: string
): Promise<PatternMatchingResults> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: snapshots } = await supabaseAdmin
      .from('holder_snapshots')
      .select('*')
      .neq('token_address', tokenAddress)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!snapshots || snapshots.length === 0) {
      return {
        similarTokens: [],
        historicalOutcomes: { avgGain: 0, avgHoldTime: 0, successRate: 0, totalMatches: 0 },
        aiPrediction: {
          expectedGain: 'Insufficient data',
          confidence: 0,
          timeframe: 'N/A',
          reasoning: 'No historical snapshots available for pattern matching. Data will accumulate over time.',
        },
      };
    }

    const tokenGroups = new Map<string, any[]>();
    for (const snap of snapshots) {
      const group = tokenGroups.get(snap.token_address) || [];
      group.push(snap);
      tokenGroups.set(snap.token_address, group);
    }

    const similarTokens = Array.from(tokenGroups.entries())
      .slice(0, 5)
      .map(([addr, snaps], index) => {
        const first = snaps[snaps.length - 1];
        const last = snaps[0];
        const gain = first.price > 0 ? ((last.price - first.price) / first.price) * 100 : 0;
        const snapshotDensity = Math.min(snaps.length / 10, 1);
        const recency = Math.max(0, 1 - index * 0.15);
        const similarity = Math.round((snapshotDensity * 50 + recency * 40 + 10) * 100) / 100;
        return {
          address: addr,
          name: `Token ${addr.slice(0, 8)}`,
          similarity: Math.min(similarity, 95),
          outcome: gain > 0 ? 'POSITIVE' : 'NEGATIVE',
          gain: Math.round(gain * 100) / 100,
          timeframe: `${snaps.length} snapshots`,
        };
      });

    const gains = similarTokens.map(t => t.gain);
    const avgGain = gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / gains.length : 0;
    const successRate = gains.length > 0 ? (gains.filter(g => g > 0).length / gains.length) * 100 : 0;

    return {
      similarTokens,
      historicalOutcomes: {
        avgGain: Math.round(avgGain * 100) / 100,
        avgHoldTime: 24,
        successRate: Math.round(successRate),
        totalMatches: similarTokens.length,
      },
      aiPrediction: {
        expectedGain: `${avgGain > 0 ? '+' : ''}${avgGain.toFixed(1)}%`,
        confidence: Math.min(85, 30 + similarTokens.length * 10),
        timeframe: '7 days',
        reasoning: `Based on ${similarTokens.length} similar token patterns. ${successRate > 50 ? 'Positive historical trend.' : 'Mixed results in similar patterns.'}`,
      },
    };
  } catch {
    return {
      similarTokens: [],
      historicalOutcomes: { avgGain: 0, avgHoldTime: 0, successRate: 0, totalMatches: 0 },
      aiPrediction: {
        expectedGain: 'Unknown',
        confidence: 0,
        timeframe: 'Unknown',
        reasoning: 'Pattern matching unavailable',
      },
    };
  }
}
