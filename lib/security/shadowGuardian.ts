import { arkhamAPI } from '../arkham/api';
import { anthropicAPI } from '../anthropic/api';
import { ScanResult, ScammerInfo } from './types';

class ShadowGuardian {
  async scanTrade(
    tokenAddress: string,
    amount: number,
    userWallet?: string
  ): Promise<ScanResult> {
    console.log('Shadow Guardian: Starting scan...', { tokenAddress, amount });

    try {
      const holders = await arkhamAPI.getTokenHolders(tokenAddress, 20);

      if (!holders || holders.length === 0) {
        return {
          allowed: false,
          blocked: true,
          riskScore: 10,
          reason: 'UNABLE_TO_VERIFY',
          recommendation: 'BLOCKED',
          message: 'Cannot verify token holders. Trade blocked for safety.',
        };
      }

      const scammers: ScammerInfo[] = [];
      const verifiedHolders: string[] = [];

      for (const holder of holders) {
        const isScammer =
          holder.labels?.includes('scammer') ||
          holder.labels?.includes('rug_puller');

        if (isScammer) {
          const addressIntel = await arkhamAPI.getAddressIntel(holder.address);

          scammers.push({
            address: holder.address,
            name: addressIntel.arkhamEntity?.name || 'Unknown Scammer',
            rugPulls: addressIntel.scamHistory?.totalRugs || 0,
            totalStolen: addressIntel.scamHistory?.totalStolen || '$0',
            victims: addressIntel.scamHistory?.victims || 0,
            lastScam: addressIntel.scamHistory?.lastScam || 'Unknown',
          });
        }

        if (holder.entity?.verified) {
          verifiedHolders.push(holder.entity.name);
        }
      }

      if (scammers.length > 0) {
        return {
          allowed: false,
          blocked: true,
          riskScore: 10,
          reason: 'KNOWN_SCAMMER_DETECTED',
          scammers,
          verifiedHolders,
          recommendation: 'BLOCKED',
          message: `TRADE BLOCKED: ${scammers.length} known scammer(s) detected in top holders`,
        };
      }

      const topHolder = holders[0];
      const connections = await arkhamAPI.getWalletConnections(topHolder.address, 50);

      const suspiciousConnections = connections.filter(
        (conn) =>
          conn.labels?.includes('mixer') ||
          conn.labels?.includes('tornado_cash') ||
          conn.labels?.includes('mule')
      );

      if (suspiciousConnections.length > 10) {
        return {
          allowed: false,
          blocked: true,
          riskScore: 9,
          reason: 'SUSPICIOUS_NETWORK',
          suspiciousConnections: suspiciousConnections.length,
          verifiedHolders,
          recommendation: 'BLOCKED',
          message: `TRADE BLOCKED: Top holder connected to ${suspiciousConnections.length} mixer/mule wallets`,
        };
      }

      const aiAnalysis = await this.getAIRiskAssessment({
        tokenAddress,
        holders: holders.slice(0, 5),
        verifiedCount: verifiedHolders.length,
        suspiciousCount: suspiciousConnections.length,
      });

      const aiRisk = this.extractRiskScore(aiAnalysis);

      if (aiRisk >= 7) {
        return {
          allowed: false,
          blocked: true,
          riskScore: aiRisk,
          reason: 'AI_HIGH_RISK',
          aiAnalysis,
          verifiedHolders,
          suspiciousConnections: suspiciousConnections.length,
          recommendation: 'BLOCKED',
          message: `TRADE BLOCKED: AI detected high risk (${aiRisk}/10)`,
        };
      }

      return {
        allowed: true,
        blocked: false,
        riskScore: aiRisk,
        verifiedHolders,
        suspiciousConnections: suspiciousConnections.length,
        aiAnalysis,
        recommendation: aiRisk < 4 ? 'SAFE' : 'CAUTION',
        message: `SAFE TO TRADE: No threats detected (Risk: ${aiRisk}/10)`,
      };
    } catch (error) {
      console.error('Shadow Guardian scan failed:', error);

      return {
        allowed: false,
        blocked: true,
        riskScore: 10,
        reason: 'SCAN_ERROR',
        recommendation: 'BLOCKED',
        message: 'Scan failed. Trade blocked for safety.',
      };
    }
  }

  private async getAIRiskAssessment(data: any): Promise<string> {
    const prompt = `You are a blockchain security expert analyzing a token trade for scam risk.

Token: ${data.tokenAddress}
Top Holders Analyzed: ${data.holders.length}
Verified Entities Found: ${data.verifiedCount}
Suspicious Connections: ${data.suspiciousCount}

Top Holder Details:
${data.holders
  .map(
    (h: any) =>
      `- ${h.address.slice(0, 10)}... holds ${h.percentage}% | Entity: ${
        h.entity?.name || 'Unknown'
      } | Labels: ${h.labels?.join(', ') || 'none'}`
  )
  .join('\n')}

Based on this data, provide:
1. Risk score (0-10, where 10 is extreme danger)
2. Key risk factors
3. Recommendation (SAFE / CAUTION / BLOCKED)

Keep your analysis under 200 words. Start with "RISK_SCORE: X" on the first line.`;

    try {
      return await anthropicAPI.analyze(prompt);
    } catch {
      return 'RISK_SCORE: 5\nUnable to complete AI analysis. Defaulting to moderate risk.';
    }
  }

  private extractRiskScore(analysis: string): number {
    const match = analysis.match(/RISK_SCORE:\s*(\d+)/);
    if (match) {
      const score = parseInt(match[1], 10);
      return Math.min(Math.max(score, 0), 10);
    }
    return 5;
  }
}

export const shadowGuardian = new ShadowGuardian();
