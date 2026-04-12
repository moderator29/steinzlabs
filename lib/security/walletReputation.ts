import 'server-only';
import { getAddressIntel, getWalletConnections } from '../services/arkham';
import { WalletReputation } from './types';

export async function getWalletReputation(walletAddress: string): Promise<WalletReputation> {
  try {
    const intel = await getAddressIntel(walletAddress);

    const dangerLabels = ['scammer', 'rug_puller', 'phishing'];
    if (intel.labels?.some(l => dangerLabels.includes(l))) {
      return {
        score: 0, reputation: 'DANGEROUS', verified: false, entity: intel.arkhamEntity,
        warnings: [
          'Wallet flagged as known scammer',
          `Labels: ${intel.labels.join(', ')}`,
          intel.scamHistory ? `${intel.scamHistory.totalRugs} rug pulls, ${intel.scamHistory.totalStolen} stolen` : '',
        ].filter(Boolean),
        benefits: [], allowAccess: false,
      };
    }

    const mixerLabels = ['mixer', 'tornado_cash', 'mule'];
    if (intel.labels?.some(l => mixerLabels.includes(l))) {
      return {
        score: 15, reputation: 'SUSPICIOUS', verified: false, entity: intel.arkhamEntity,
        warnings: ['Wallet linked to mixing services', `Labels: ${intel.labels.join(', ')}`],
        benefits: [], allowAccess: false,
      };
    }

    if (intel.arkhamEntity?.verified) {
      return {
        score: 95, reputation: 'VERIFIED', verified: true, entity: intel.arkhamEntity,
        warnings: [],
        benefits: [`Verified: ${intel.arkhamEntity.name}`, `Type: ${intel.arkhamEntity.type}`, 'Full platform access'],
        allowAccess: true,
      };
    }

    const connections = await getWalletConnections(walletAddress, 20).catch(() => []);
    const suspiciousCount = connections.filter(c =>
      c.labels?.includes('mixer') || c.labels?.includes('mule') || c.labels?.includes('scammer')
    ).length;

    if (suspiciousCount > 5) {
      return {
        score: 25, reputation: 'SUSPICIOUS', verified: false, entity: intel.arkhamEntity,
        warnings: [`Connected to ${suspiciousCount} suspicious wallets`, 'Elevated risk detected'],
        benefits: [], allowAccess: true,
      };
    }

    const score = Math.min(50 + (intel.transactionCount || 0) * 0.1 + (intel.arkhamEntity ? 20 : 0), 85);
    return {
      score: Math.round(score), reputation: 'UNKNOWN', verified: false, entity: intel.arkhamEntity,
      warnings: (intel.transactionCount || 0) < 10 ? ['New wallet with limited history'] : [],
      benefits: (intel.transactionCount || 0) > 100 ? ['Established wallet with transaction history'] : [],
      allowAccess: true,
    };
  } catch {
    return { score: 50, reputation: 'UNKNOWN', verified: false, entity: null, warnings: ['Unable to verify wallet'], benefits: [], allowAccess: true };
  }
}
