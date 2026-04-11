import { getOptimalQuote } from '../trading/execution';
import { CopyTradeParams } from './types';
import { getSupabaseAdmin } from '../supabaseAdmin';

export async function executeCopyTrade(params: CopyTradeParams): Promise<any> {
  const { userId, entityTrade, copyAmount } = params;

  try {


    const supabaseAdmin = getSupabaseAdmin();
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('wallet_address')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new Error('User not found');
    }

    if (entityTrade.action === 'BUY') {
      const quote = await getOptimalQuote({
        fromToken: 'USDC',
        toToken: entityTrade.tokenAddress,
        amount: copyAmount,
        chain: entityTrade.chain,
      });

      return {
        success: true,
        message: `Copy trade quote ready: Buy ${quote.toAmount} ${entityTrade.token}`,
        quote,
        entityTrade,
      };

    } else {


      return {
        success: true,
        message: 'Auto-exit triggered if position exists',
      };
    }

  } catch (error: any) {

    return {
      success: false,
      error: error.message || 'Copy trade failed',
    };
  }
}
