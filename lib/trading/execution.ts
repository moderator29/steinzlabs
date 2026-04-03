import { jupiterAPI } from './jupiter';
import { oneInchAPI } from './oneinch';
import { TradeQuote, TradeExecution } from './types';
import { shadowGuardian } from '../security/shadowGuardian';
import { savePosition, getUserByWallet } from '../database/supabase';

export async function getOptimalQuote(params: {
  fromToken: string;
  toToken: string;
  amount: number;
  chain: string;
  slippage?: number;
}): Promise<TradeQuote> {
  const { fromToken, toToken, amount, chain, slippage = 0.5 } = params;

  if (chain === 'solana') {
    return jupiterAPI.getQuote(fromToken, toToken, amount, slippage * 100);
  } else {
    const amountWei = Math.floor(amount * 1e18).toString();
    return oneInchAPI.getQuote(
      chain,
      fromToken,
      toToken,
      amountWei,
      slippage
    );
  }
}

export async function executeTrade(params: {
  quote: TradeQuote;
  userWallet: string;
  userAddress: string;
  chain: string;
  signTransaction: any;
  autoExit?: boolean;
  followingEntity?: string;
}): Promise<TradeExecution> {
  const { quote, userWallet, userAddress, chain, signTransaction, autoExit, followingEntity } = params;

  try {
    console.log('Running Shadow Guardian pre-trade scan...');
    const scan = await shadowGuardian.scanTrade(
      quote.toToken,
      parseFloat(quote.toAmount),
      userWallet
    );

    if (scan.blocked) {
      console.log('Trade blocked by Shadow Guardian');
      return {
        success: false,
        error: `BLOCKED: ${scan.message}`,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        timestamp: new Date().toISOString(),
      };
    }

    console.log('Shadow Guardian: Safe to proceed');

    let execution: TradeExecution;

    if (chain === 'solana') {
      execution = await jupiterAPI.executeSwap(quote, userAddress, signTransaction);
    } else {
      execution = await oneInchAPI.executeSwap(
        chain,
        quote,
        userAddress,
        signTransaction
      );
    }

    if (execution.success && userWallet) {
      const user = await getUserByWallet(userWallet);
      if (user) {
        await savePosition({
          userId: user.id,
          tokenAddress: quote.toToken,
          tokenSymbol: 'UNKNOWN',
          chain,
          entryPrice: parseFloat(quote.fromAmount) / parseFloat(quote.toAmount),
          amount: parseFloat(quote.toAmount),
          valueUsd: parseFloat(quote.toAmountUSD || '0'),
          autoExitEnabled: autoExit,
          followingEntity,
        });

        console.log('Position saved to database');
      }
    }

    return execution;
  } catch (error: any) {
    console.error('Trade execution failed:', error);
    return {
      success: false,
      error: error.message || 'Trade execution failed',
      fromToken: quote.fromToken,
      toToken: quote.toToken,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      timestamp: new Date().toISOString(),
    };
  }
}
