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
  return {
    totalLiquidity: '$0',
    liquidityProviders: [],
    locked: false,
    depth: {
      buy2Percent: '$0',
      sell2Percent: '$0',
    },
  };
}

export async function findSimilarTokens(
  tokenAddress: string
): Promise<PatternMatchingResults> {
  return {
    similarTokens: [],
    historicalOutcomes: {
      avgGain: 0,
      avgHoldTime: 0,
      successRate: 0,
      totalMatches: 0,
    },
    aiPrediction: {
      expectedGain: 'Unknown',
      confidence: 0,
      timeframe: 'Unknown',
      reasoning: 'Insufficient historical data',
    },
  };
}
