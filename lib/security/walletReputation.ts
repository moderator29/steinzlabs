import { arkhamAPI } from '../arkham/api';
import { WalletReputation } from './types';

export async function getWalletReputation(
  walletAddress: string
): Promise<WalletReputation> {
  try {
    const intel = await arkhamAPI.getAddressIntel(walletAddress);

    if (
      intel.labels?.includes('scammer') ||
      intel.labels?.includes('rug_puller') ||
      intel.labels?.includes('phishing')
    ) {
      return {
        score: 0,
        reputation: 'DANGEROUS',
        verified: false,
        entity: intel.arkhamEntity,
        warnings: [
          'This wallet is flagged as a known scammer',
          `Labels: ${intel.labels.join(', ')}`,
          intel.scamHistory
            ? `${intel.scamHistory.totalRugs} rug pulls, ${intel.scamHistory.totalStolen} stolen`
            : '',
        ].filter(Boolean),
        benefits: [],
        allowAccess: false,
      };
    }

    if (
      intel.labels?.includes('mixer') ||
      intel.labels?.includes('tornado_cash') ||
      intel.labels?.includes('mule')
    ) {
      return {
        score: 15,
        reputation: 'SUSPICIOUS',
        verified: false,
        entity: intel.arkhamEntity,
        warnings: [
          'Wallet connected to mixing services',
          `Suspicious labels: ${intel.labels.join(', ')}`,
        ],
        benefits: [],
        allowAccess: false,
      };
    }

    if (intel.arkhamEntity?.verified) {
      return {
        score: 95,
        reputation: 'VERIFIED',
        verified: true,
        entity: intel.arkhamEntity,
        warnings: [],
        benefits: [
          `Verified entity: ${intel.arkhamEntity.name}`,
          `Type: ${intel.arkhamEntity.type}`,
          'Full platform access granted',
        ],
        allowAccess: true,
      };
    }

    const connections = await arkhamAPI.getWalletConnections(walletAddress, 20);
    const suspiciousCount = connections.filter(
      (c) =>
        c.labels?.includes('mixer') ||
        c.labels?.includes('mule') ||
        c.labels?.includes('scammer')
    ).length;

    if (suspiciousCount > 5) {
      return {
        score: 25,
        reputation: 'SUSPICIOUS',
        verified: false,
        entity: intel.arkhamEntity,
        warnings: [
          `Connected to ${suspiciousCount} suspicious wallets`,
          'Elevated risk profile detected',
        ],
        benefits: [],
        allowAccess: true,
      };
    }

    const score = Math.min(
      50 + intel.transactionCount * 0.1 + (intel.arkhamEntity ? 20 : 0),
      85
    );

    return {
      score: Math.round(score),
      reputation: 'UNKNOWN',
      verified: false,
      entity: intel.arkhamEntity,
      warnings:
        intel.transactionCount < 10
          ? ['New wallet with limited history']
          : [],
      benefits:
        intel.transactionCount > 100
          ? ['Established wallet with significant history']
          : [],
      allowAccess: true,
    };
  } catch (error) {


    return {
      score: 50,
      reputation: 'UNKNOWN',
      verified: false,
      entity: null,
      warnings: ['Unable to verify wallet - limited data available'],
      benefits: [],
      allowAccess: true,
    };
  }
}
