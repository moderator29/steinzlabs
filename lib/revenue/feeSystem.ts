import { getSupabaseAdmin } from '../supabaseAdmin';

export interface FeeConfiguration {
  swapFeeBps: number;
  copyTradeFeeBps: number;
  limitOrderFeeBps: number;
  dcaFeeBps: number;
  treasuryWalletEvm: string;
  treasuryWalletSolana: string;
}

export interface FeeCalculation {
  tradeAmount: string;
  feeAmount: string;
  netAmount: string;
  feeBps: number;
  treasuryWallet: string;
}

const FEE_CONFIG: FeeConfiguration = {
  swapFeeBps: 50,
  copyTradeFeeBps: 100,
  limitOrderFeeBps: 50,
  dcaFeeBps: 50,
  treasuryWalletEvm: process.env.TREASURY_WALLET_EVM || '0xfe4a53af5336eba5d675d95e9795aCd6C05Ad9A4',
  treasuryWalletSolana: process.env.TREASURY_WALLET_SOLANA || 'Ar6uFNvdFATXEA3nNtSmUyYv7WG3QAsaURjESs313TUy',
};

export function calculateFee(
  tradeAmount: number,
  tradeType: 'SWAP' | 'COPY_TRADE' | 'LIMIT_ORDER' | 'DCA',
  chain: string = 'ethereum'
): FeeCalculation {
  let feeBps: number;

  switch (tradeType) {
    case 'SWAP': feeBps = FEE_CONFIG.swapFeeBps; break;
    case 'COPY_TRADE': feeBps = FEE_CONFIG.copyTradeFeeBps; break;
    case 'LIMIT_ORDER': feeBps = FEE_CONFIG.limitOrderFeeBps; break;
    case 'DCA': feeBps = FEE_CONFIG.dcaFeeBps; break;
    default: feeBps = FEE_CONFIG.swapFeeBps;
  }

  const feePercentage = feeBps / 10000;
  const feeAmount = tradeAmount * feePercentage;
  const netAmount = tradeAmount - feeAmount;

  const treasuryWallet = chain === 'solana'
    ? FEE_CONFIG.treasuryWalletSolana
    : FEE_CONFIG.treasuryWalletEvm;

  return {
    tradeAmount: tradeAmount.toString(),
    feeAmount: feeAmount.toFixed(6),
    netAmount: netAmount.toFixed(6),
    feeBps,
    treasuryWallet,
  };
}

export async function recordRevenue(params: {
  userId: string;
  tradeType: 'SWAP' | 'COPY_TRADE' | 'LIMIT_ORDER' | 'DCA';
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  tradeAmount: string;
  feeAmount: string;
  feeBps: number;
  txHash: string;
}): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const treasuryWallet = params.chain === 'solana'
      ? FEE_CONFIG.treasuryWalletSolana
      : FEE_CONFIG.treasuryWalletEvm;

    await supabaseAdmin.from('revenue_records').insert({
      user_id: params.userId,
      trade_type: params.tradeType,
      token_address: params.tokenAddress,
      token_symbol: params.tokenSymbol,
      chain: params.chain,
      trade_amount: params.tradeAmount,
      fee_amount: params.feeAmount,
      fee_bps: params.feeBps,
      treasury_wallet: treasuryWallet,
      tx_hash: params.txHash,
      status: 'COLLECTED',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to record revenue:', error);
  }
}

export async function getTotalRevenue(timeframe?: {
  startDate: string;
  endDate: string;
}): Promise<{
  totalRevenue: number;
  revenueByType: Record<string, number>;
  totalTrades: number;
}> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('revenue_records')
      .select('*')
      .eq('status', 'COLLECTED');

    if (timeframe) {
      query = query.gte('timestamp', timeframe.startDate).lte('timestamp', timeframe.endDate);
    }

    const { data: records } = await query;

    if (!records || records.length === 0) {
      return { totalRevenue: 0, revenueByType: {}, totalTrades: 0 };
    }

    const totalRevenue = records.reduce((sum, r) => sum + parseFloat(r.fee_amount), 0);

    const revenueByType: Record<string, number> = {};
    for (const record of records) {
      const type = record.trade_type;
      revenueByType[type] = (revenueByType[type] || 0) + parseFloat(record.fee_amount);
    }

    return { totalRevenue, revenueByType, totalTrades: records.length };
  } catch (error) {
    console.error('Failed to get total revenue:', error);
    return { totalRevenue: 0, revenueByType: {}, totalTrades: 0 };
  }
}

export async function getUserFeesPaid(userId: string): Promise<{
  totalFees: number;
  feesByType: Record<string, number>;
}> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: records } = await supabaseAdmin
      .from('revenue_records')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'COLLECTED');

    if (!records || records.length === 0) {
      return { totalFees: 0, feesByType: {} };
    }

    const totalFees = records.reduce((sum, r) => sum + parseFloat(r.fee_amount), 0);

    const feesByType: Record<string, number> = {};
    for (const record of records) {
      feesByType[record.trade_type] = (feesByType[record.trade_type] || 0) + parseFloat(record.fee_amount);
    }

    return { totalFees, feesByType };
  } catch {
    return { totalFees: 0, feesByType: {} };
  }
}
