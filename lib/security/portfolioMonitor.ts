import { arkhamAPI } from '../arkham/api';
import { PortfolioThreat } from './types';

export async function monitorPortfolioThreats(
  userWallet: string,
  userPortfolio: Array<{ address: string; symbol: string; balance: string }>
): Promise<PortfolioThreat[]> {

  const threats: PortfolioThreat[] = [];

  for (const token of userPortfolio) {
    try {
      // Get current token holders
      const holders = await arkhamAPI.getTokenHolders(token.address, 20);

      // Check for scammers in holders
      for (const holder of holders) {
        const isScammer = holder.labels?.includes('scammer') ||
                         holder.labels?.includes('rug_puller');

        if (isScammer) {
          const addressIntel = await arkhamAPI.getAddressIntel(holder.address);

          threats.push({
            severity: 'CRITICAL',
            token: token.symbol,
            tokenAddress: token.address,
            userHolding: token.balance,
            threat: {
              type: 'SCAMMER_IN_HOLDERS',
              details: {
                scammerAddress: holder.address,
                scammerName: addressIntel.arkhamEntity?.name || 'Unknown',
                position: holder.percentage,
                scamHistory: addressIntel.scamHistory,
              },
            },
            recommendation: 'SELL IMMEDIATELY',
            createdAt: new Date(),
          });
        }
      }

      // Check for smart money exits (entities selling)
      // This would require tracking entity positions over time
      // Implementation in Prompt #2

    } catch (error) {
      console.error(`Failed to monitor ${token.symbol}:`, error);
    }
  }

  return threats;
}
