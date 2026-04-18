import { getTokenHolders, getAddressIntel, getWalletConnections, getEntityPerformance } from '../services/arkham';
import type { ArkhamHolder } from '../arkham/types';
import { analyzeLiquidity, findSimilarTokens, LiquidityAnalysis, PatternMatchingResults } from './historicalTracking';

export interface HolderIntelligence {
  tokenAddress: string;
  chain: string;
  totalHolders: number;
  topHolders: EnrichedHolder[];
  composition: HolderComposition;
  network: NetworkAnalysis;
  safetyAnalysis: SafetyAnalysis;
  smartMoneyPresence: SmartMoneyAnalysis;
  scammerAnalysis: ScammerAnalysis;
  bubbleMapData: BubbleMapData;
  liquidityAnalysis: LiquidityAnalysis;
  patternMatching: PatternMatchingResults;
  lastUpdated: Date;
}

export interface EnrichedHolder {
  address: string;
  balance: string;
  balanceUSD: string;
  percentage: number;
  rank: number;
  entity: {
    id: string | null;
    name: string;
    type: string | null;
    verified: boolean;
    logo?: string;
    website?: string;
    twitter?: string;
  };
  labels: string[];
  isScammer: boolean;
  isVerified: boolean;
  isExchange: boolean;
  performance?: {
    winRate: number;
    avgHoldTime: number;
    totalTrades: number;
    avgGain: number;
  };
  behavior: 'ACCUMULATING' | 'HOLDING' | 'DISTRIBUTING' | 'UNKNOWN';
  entryPrice?: string;
  currentPnL?: string;
  pnlPercentage?: number;
  connections: {
    mixers: number;
    scammers: number;
    entities: number;
  };
}

export interface HolderComposition {
  institutions: {
    percentage: number;
    count: number;
    totalValue: string;
    entities: string[];
  };
  exchanges: {
    percentage: number;
    count: number;
    totalValue: string;
    names: string[];
  };
  retail: {
    percentage: number;
    count: number;
    totalValue: string;
  };
  scammers: {
    percentage: number;
    count: number;
    totalValue: string;
    addresses: string[];
  };
}

export interface NetworkAnalysis {
  topHolderConnections: {
    address: string;
    entity: string | null;
    mixerConnections: number;
    scammerConnections: number;
    entityConnections: number;
    suspiciousScore: number;
  }[];
  overallNetworkHealth: number;
  redFlags: string[];
}

export interface SafetyAnalysis {
  overallScore: number;
  factors: {
    noScammers: boolean;
    strongInstitutional: boolean;
    noMixerConnections: boolean;
    decentralized: boolean;
    verifiedEntities: boolean;
  };
  warnings: string[];
  greenFlags: string[];
}

export interface SmartMoneyAnalysis {
  present: boolean;
  totalSmartMoney: number;
  totalSmartMoneyValue: string;
  totalSmartMoneyPercentage: number;
  entities: {
    id: string;
    name: string;
    type: string;
    position: string;
    percentage: number;
    behavior: string;
    winRate: number;
    avgHoldTime: number;
    currentPnL: string;
    pnlPercentage: number;
  }[];
  patterns: {
    vcBacked: boolean;
    multipleMarketMakers: boolean;
    coordinatedAccumulation: boolean;
    recentInstitutionalEntry: boolean;
  };
}

export interface ScammerAnalysis {
  present: boolean;
  count: number;
  totalPercentage: number;
  scammers: {
    address: string;
    name: string;
    percentage: number;
    rugPulls: number;
    totalStolen: string;
    victims: number;
    lastScam: string;
  }[];
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface BubbleMapData {
  nodes: BubbleNode[];
  links: BubbleLink[];
  metadata: {
    totalNodes: number;
    verifiedNodes: number;
    scammerNodes: number;
    largestHolder: string;
    concentration: number;
  };
}

export interface BubbleNode {
  id: string;
  label: string;
  value: number;
  percentage: number;
  valueUSD: string;
  entityId: string | null;
  entityName: string | null;
  entityType: string | null;
  verified: boolean;
  color: string;
  size: number;
  behavior: 'ACCUMULATING' | 'HOLDING' | 'DISTRIBUTING' | 'UNKNOWN';
  isScammer: boolean;
  riskScore: number;
  winRate?: number;
  avgHoldTime?: number;
  currentPnL?: string;
}

export interface BubbleLink {
  source: string;
  target: string;
  value: number;
  type: 'transfer' | 'swap' | 'suspicious';
}

export async function loadHolderIntelligence(
  tokenAddress: string,
  chain?: string,
  holderLimit: number = 20
): Promise<HolderIntelligence> {



  try {
    const holders = await getTokenHolders(tokenAddress, holderLimit);

    if (!holders || holders.length === 0) {
      throw new Error('No holder data available');
    }

    const enrichedHolders: EnrichedHolder[] = await Promise.all(
      holders.map(async (holder, index) => {
        return await enrichHolder(holder, index + 1);
      })
    );

    const composition = analyzeComposition(enrichedHolders);

    const network = analyzeNetwork(enrichedHolders);

    const safetyAnalysis = analyzeSafety(enrichedHolders, composition, network);

    const smartMoneyPresence = analyzeSmartMoney(enrichedHolders);

    const scammerAnalysis = analyzeScammers(enrichedHolders);

    const bubbleMapData = generateBubbleMapData(enrichedHolders);

    const [liquidityAnalysis, patternMatching] = await Promise.all([
      analyzeLiquidity(tokenAddress, chain),
      findSimilarTokens(tokenAddress),
    ]);

    return {
      tokenAddress,
      chain: chain || 'unknown',
      totalHolders: holders.length,
      topHolders: enrichedHolders,
      composition,
      network,
      safetyAnalysis,
      smartMoneyPresence,
      scammerAnalysis,
      bubbleMapData,
      liquidityAnalysis,
      patternMatching,
      lastUpdated: new Date(),
    };

  } catch (error) {

    throw error;
  }
}

async function enrichHolder(
  holder: ArkhamHolder,
  rank: number,
): Promise<EnrichedHolder> {

  try {
    const addressIntel = await getAddressIntel(holder.address);
    if (!addressIntel) throw new Error('No intel');

    const isScammer =
      addressIntel.labels?.includes('scammer') ||
      addressIntel.labels?.includes('rug_puller') ||
      !!addressIntel.scamHistory;

    const isExchange =
      addressIntel.labels?.includes('exchange') ||
      addressIntel.arkhamEntity?.type === 'Exchange';

    let performance = undefined;
    if (addressIntel.arkhamEntity?.id) {
      try {
        const entityPerf = await getEntityPerformance(addressIntel.arkhamEntity.id);
        if (entityPerf) {
          performance = {
            winRate: entityPerf.winRate,
            avgHoldTime: entityPerf.avgHoldTime,
            totalTrades: entityPerf.totalTrades,
            avgGain: entityPerf.avgGainOnWinners,
          };
        }
      } catch {
        // Performance not available
      }
    }

    const connections = await getWalletConnections(holder.address, 50);
    const mixerCount = connections.filter(c =>
      c.labels?.includes('mixer') || c.labels?.includes('tornado_cash')
    ).length;
    const scammerCount = connections.filter(c =>
      c.labels?.includes('scammer')
    ).length;
    const entityCount = connections.filter(c => c.entity?.verified).length;

    return {
      address: holder.address,
      balance: holder.balance,
      balanceUSD: holder.balanceUSD,
      percentage: holder.percentage,
      rank,
      entity: {
        id: addressIntel.arkhamEntity?.id || null,
        name: addressIntel.arkhamEntity?.name || formatAddress(holder.address),
        type: addressIntel.arkhamEntity?.type || null,
        verified: addressIntel.arkhamEntity?.verified || false,
        logo: addressIntel.arkhamEntity?.logo,
        website: addressIntel.arkhamEntity?.website,
        twitter: addressIntel.arkhamEntity?.twitter,
      },
      labels: addressIntel.labels || [],
      isScammer,
      isVerified: addressIntel.arkhamEntity?.verified || false,
      isExchange,
      performance,
      behavior: 'UNKNOWN',
      connections: {
        mixers: mixerCount,
        scammers: scammerCount,
        entities: entityCount,
      },
    };

  } catch (error) {


    return {
      address: holder.address,
      balance: holder.balance,
      balanceUSD: holder.balanceUSD,
      percentage: holder.percentage,
      rank,
      entity: {
        id: null,
        name: formatAddress(holder.address),
        type: null,
        verified: false,
      },
      labels: [],
      isScammer: false,
      isVerified: false,
      isExchange: false,
      behavior: 'UNKNOWN',
      connections: {
        mixers: 0,
        scammers: 0,
        entities: 0,
      },
    };
  }
}

function analyzeComposition(holders: EnrichedHolder[]): HolderComposition {
  const institutions = holders.filter(h =>
    h.isVerified &&
    h.entity.type !== 'Exchange' &&
    !h.isScammer
  );

  const exchanges = holders.filter(h => h.isExchange);

  const scammers = holders.filter(h => h.isScammer);

  const retail = holders.filter(h =>
    !h.isVerified &&
    !h.isExchange &&
    !h.isScammer
  );

  const totalPercentage = holders.reduce((sum, h) => sum + h.percentage, 0) || 1;

  const calcPercentage = (group: EnrichedHolder[]) => {
    const groupPercentage = group.reduce((sum, h) => sum + h.percentage, 0);
    return (groupPercentage / totalPercentage) * 100;
  };

  const calcValue = (group: EnrichedHolder[]) => {
    return group.reduce((sum, h) => sum + parseFloat(h.balanceUSD), 0).toFixed(2);
  };

  return {
    institutions: {
      percentage: calcPercentage(institutions),
      count: institutions.length,
      totalValue: calcValue(institutions),
      entities: institutions.map(h => h.entity.name),
    },
    exchanges: {
      percentage: calcPercentage(exchanges),
      count: exchanges.length,
      totalValue: calcValue(exchanges),
      names: exchanges.map(h => h.entity.name),
    },
    retail: {
      percentage: calcPercentage(retail),
      count: retail.length,
      totalValue: calcValue(retail),
    },
    scammers: {
      percentage: calcPercentage(scammers),
      count: scammers.length,
      totalValue: calcValue(scammers),
      addresses: scammers.map(h => h.address),
    },
  };
}

function analyzeNetwork(holders: EnrichedHolder[]): NetworkAnalysis {
  const topHolderConnections = holders.slice(0, 5).map(holder => ({
    address: holder.address,
    entity: holder.entity.name,
    mixerConnections: holder.connections.mixers,
    scammerConnections: holder.connections.scammers,
    entityConnections: holder.connections.entities,
    suspiciousScore: calculateSuspiciousScore(holder.connections),
  }));

  const avgSuspiciousScore = topHolderConnections.length > 0
    ? topHolderConnections.reduce((sum, h) => sum + h.suspiciousScore, 0) / topHolderConnections.length
    : 0;

  const overallNetworkHealth = 10 - avgSuspiciousScore;

  const redFlags: string[] = [];
  if (avgSuspiciousScore > 5) redFlags.push('High mixer connections detected');
  if (topHolderConnections.some(h => h.scammerConnections > 3)) {
    redFlags.push('Top holders connected to known scammers');
  }

  return {
    topHolderConnections,
    overallNetworkHealth,
    redFlags,
  };
}

function analyzeSafety(
  holders: EnrichedHolder[],
  composition: HolderComposition,
  network: NetworkAnalysis
): SafetyAnalysis {

  const noScammers = composition.scammers.count === 0;
  const strongInstitutional = composition.institutions.percentage > 30;
  const noMixerConnections = network.topHolderConnections.every(h => h.mixerConnections < 5);
  const top10Percentage = holders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
  const decentralized = top10Percentage < 70;
  const verifiedEntities = composition.institutions.count > 0;

  const factors = {
    noScammers,
    strongInstitutional,
    noMixerConnections,
    decentralized,
    verifiedEntities,
  };

  const warnings: string[] = [];
  const greenFlags: string[] = [];

  if (!noScammers) warnings.push(`${composition.scammers.count} scammer(s) detected`);
  else greenFlags.push('No scammers in top holders');

  if (!strongInstitutional) warnings.push('Low institutional backing');
  else greenFlags.push(`${composition.institutions.percentage.toFixed(1)}% institutional backing`);

  if (!noMixerConnections) warnings.push('Mixer wallet connections detected');
  else greenFlags.push('Clean network - no mixer connections');

  if (!decentralized) warnings.push(`High concentration (${top10Percentage.toFixed(1)}% in top 10)`);
  else greenFlags.push('Well distributed holdings');

  if (verifiedEntities) greenFlags.push(`${composition.institutions.count} verified entities`);

  const trueFactors = Object.values(factors).filter(v => v).length;
  const overallScore = (trueFactors / Object.keys(factors).length) * 10;

  return {
    overallScore,
    factors,
    warnings,
    greenFlags,
  };
}

function analyzeSmartMoney(holders: EnrichedHolder[]): SmartMoneyAnalysis {
  const smartMoneyHolders = holders.filter(h =>
    h.isVerified &&
    h.entity.type !== 'Exchange' &&
    !h.isScammer
  );

  const present = smartMoneyHolders.length > 0;

  const totalSmartMoneyPercentage = smartMoneyHolders.reduce(
    (sum, h) => sum + h.percentage, 0
  );

  const entities = smartMoneyHolders.map(h => ({
    id: h.entity.id!,
    name: h.entity.name,
    type: h.entity.type || 'Unknown',
    position: h.balanceUSD,
    percentage: h.percentage,
    behavior: h.behavior,
    winRate: h.performance?.winRate || 0,
    avgHoldTime: h.performance?.avgHoldTime || 0,
    currentPnL: h.currentPnL || '$0',
    pnlPercentage: h.pnlPercentage || 0,
  }));

  const vcBacked = smartMoneyHolders.some(h =>
    h.entity.type === 'VC' || h.entity.type === 'Venture Capital'
  );

  const multipleMarketMakers = smartMoneyHolders.filter(h =>
    h.entity.type === 'Market Maker'
  ).length >= 2;

  const coordinatedAccumulation =
    smartMoneyHolders.filter(h => h.behavior === 'ACCUMULATING').length >= 2;

  return {
    present,
    totalSmartMoney: smartMoneyHolders.length,
    totalSmartMoneyValue: smartMoneyHolders.reduce(
      (sum, h) => sum + parseFloat(h.balanceUSD), 0
    ).toFixed(2),
    totalSmartMoneyPercentage,
    entities,
    patterns: {
      vcBacked,
      multipleMarketMakers,
      coordinatedAccumulation,
      recentInstitutionalEntry: false,
    },
  };
}

function analyzeScammers(holders: EnrichedHolder[]): ScammerAnalysis {
  const scammers = holders.filter(h => h.isScammer);

  const present = scammers.length > 0;
  const totalPercentage = scammers.reduce((sum, h) => sum + h.percentage, 0);

  let riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NONE';
  if (present) {
    if (totalPercentage > 10) riskLevel = 'CRITICAL';
    else if (totalPercentage > 5) riskLevel = 'HIGH';
    else if (totalPercentage > 2) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';
  }

  const scammerDetails = scammers.map(h => ({
    address: h.address,
    name: h.entity.name,
    percentage: h.percentage,
    rugPulls: 0,
    totalStolen: '$0',
    victims: 0,
    lastScam: 'Unknown',
  }));

  return {
    present,
    count: scammers.length,
    totalPercentage,
    scammers: scammerDetails,
    riskLevel,
  };
}

function generateBubbleMapData(holders: EnrichedHolder[]): BubbleMapData {
  const nodes: BubbleNode[] = holders.map(holder => {
    let color = '#FFFFFF';
    if (holder.isScammer) color = '#FF4444';
    else if (holder.isVerified) color = '#00FF88';
    else if (holder.isExchange) color = '#4488FF';

    const size = Math.log(holder.percentage + 1) * 20 + 10;

    return {
      id: holder.address,
      label: holder.entity.name,
      value: parseFloat(holder.balance),
      percentage: holder.percentage,
      valueUSD: holder.balanceUSD,
      entityId: holder.entity.id,
      entityName: holder.entity.name,
      entityType: holder.entity.type,
      verified: holder.isVerified,
      color,
      size,
      behavior: holder.behavior,
      isScammer: holder.isScammer,
      riskScore: holder.isScammer ? 10 : holder.connections.mixers > 5 ? 7 : 2,
      winRate: holder.performance?.winRate,
      avgHoldTime: holder.performance?.avgHoldTime,
      currentPnL: holder.currentPnL,
    };
  });

  const links: BubbleLink[] = [];

  return {
    nodes,
    links,
    metadata: {
      totalNodes: nodes.length,
      verifiedNodes: nodes.filter(n => n.verified).length,
      scammerNodes: nodes.filter(n => n.isScammer).length,
      largestHolder: nodes[0]?.label || 'Unknown',
      concentration: nodes.slice(0, 10).reduce((sum, n) => sum + n.percentage, 0),
    },
  };
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function calculateSuspiciousScore(connections: {
  mixers: number;
  scammers: number;
  entities: number;
}): number {
  let score = 0;
  score += connections.mixers * 0.5;
  score += connections.scammers * 2;
  score -= connections.entities * 0.3;
  return Math.min(Math.max(score, 0), 10);
}
