import 'server-only';
import { getTokenHolders, getAddressIntel, getWalletConnections } from '../services/arkham';
import { vtxAnalyze } from '../services/anthropic';
import { getTokenSecurity } from '../services/goplus';
import { ScanResult, ScammerInfo } from './types';

class ShadowGuardian {
  async scanTrade(tokenAddress: string, amount: number, userWallet?: string): Promise<ScanResult> {
    try {
      // Run GoPlus security + Arkham holder scan in parallel
      const [goplusSec, holders] = await Promise.allSettled([
        getTokenSecurity(tokenAddress, 'ethereum'),
        getTokenHolders(tokenAddress, 20),
      ]);

      // Hard block: GoPlus honeypot or extreme tax
      if (goplusSec.status === 'fulfilled' && goplusSec.value) {
        const sec = goplusSec.value;
        if (sec.isHoneypot) {
          return { allowed: false, blocked: true, riskScore: 10, reason: 'HONEYPOT', recommendation: 'BLOCKED', message: 'TRADE BLOCKED: Token is a honeypot — you cannot sell.' };
        }
        if (sec.sellTax > 0.5) {
          return { allowed: false, blocked: true, riskScore: 9, reason: 'EXTREME_TAX', recommendation: 'BLOCKED', message: `TRADE BLOCKED: Sell tax is ${(sec.sellTax * 100).toFixed(0)}%` };
        }
      }

      const holderList = holders.status === 'fulfilled' ? holders.value : [];
      if (!holderList.length) {
        return { allowed: false, blocked: true, riskScore: 10, reason: 'UNABLE_TO_VERIFY', recommendation: 'BLOCKED', message: 'Cannot verify token holders.' };
      }

      const scammers: ScammerInfo[] = [];
      const verifiedHolders: string[] = [];
      for (const holder of holderList) {
        const isScammer = holder.labels?.includes('scammer') || holder.labels?.includes('rug_puller');
        if (isScammer) {
          const intel = await getAddressIntel(holder.address).catch(() => null);
          scammers.push({
            address: holder.address, name: intel?.arkhamEntity?.name || 'Unknown Scammer',
            rugPulls: intel?.scamHistory?.totalRugs || 0, totalStolen: intel?.scamHistory?.totalStolen || '$0',
            victims: intel?.scamHistory?.victims || 0, lastScam: intel?.scamHistory?.lastScam || 'Unknown',
          });
        }
        if (holder.entity?.verified) verifiedHolders.push(holder.entity.name);
      }

      if (scammers.length > 0) {
        return { allowed: false, blocked: true, riskScore: 10, reason: 'KNOWN_SCAMMER_DETECTED', scammers, verifiedHolders, recommendation: 'BLOCKED', message: `TRADE BLOCKED: ${scammers.length} known scammer(s) in top holders` };
      }

      const connections = await getWalletConnections(holderList[0].address, 50).catch(() => []);
      const suspiciousConnections = connections.filter(c => c.labels?.includes('mixer') || c.labels?.includes('tornado_cash') || c.labels?.includes('mule'));
      if (suspiciousConnections.length > 10) {
        return { allowed: false, blocked: true, riskScore: 9, reason: 'SUSPICIOUS_NETWORK', suspiciousConnections: suspiciousConnections.length, verifiedHolders, recommendation: 'BLOCKED', message: `TRADE BLOCKED: Top holder linked to ${suspiciousConnections.length} mixer wallets` };
      }

      const aiAnalysis = await vtxAnalyze(
        `Token trade risk analysis. Address: ${tokenAddress}. Top ${holderList.slice(0, 5).length} holders analyzed. Verified entities: ${verifiedHolders.length}. Suspicious connections: ${suspiciousConnections.length}. Scammers found: ${scammers.length}. Start reply with "RISK_SCORE: X" (0-10). Be concise.`,
        200
      ).catch(() => 'RISK_SCORE: 5\nInsufficient data.');
      const aiRisk = extractRiskScore(aiAnalysis);

      if (aiRisk >= 7) {
        return { allowed: false, blocked: true, riskScore: aiRisk, reason: 'AI_HIGH_RISK', aiAnalysis, verifiedHolders, suspiciousConnections: suspiciousConnections.length, recommendation: 'BLOCKED', message: `TRADE BLOCKED: AI risk score ${aiRisk}/10` };
      }
      return { allowed: true, blocked: false, riskScore: aiRisk, verifiedHolders, suspiciousConnections: suspiciousConnections.length, aiAnalysis, recommendation: aiRisk < 4 ? 'SAFE' : 'CAUTION', message: `SAFE TO TRADE: Risk ${aiRisk}/10` };
    } catch {
      return { allowed: false, blocked: true, riskScore: 10, reason: 'SCAN_ERROR', recommendation: 'BLOCKED', message: 'Scan failed. Trade blocked for safety.' };
    }
  }
}

function extractRiskScore(analysis: string): number {
  const match = analysis.match(/RISK_SCORE:\s*(\d+)/);
  return match ? Math.min(Math.max(parseInt(match[1], 10), 0), 10) : 5;
}

export const shadowGuardian = new ShadowGuardian();
