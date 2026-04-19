import 'server-only';
import { NextResponse } from 'next/server';
import { buildContractIntelligence, topHolderRisk, type ContractHolder } from '@/lib/services/contract-intelligence';
import { getContractPrice, getTokenDetail } from '@/lib/services/coingecko';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BubbleNode {
  id: string;
  label: string;
  value: number;
  percentage: number;
  type: ContractHolder['type'] | 'token';
  entity?: string;
  verified?: boolean;
  color: string;
  entityLabel: string | null;
  entityName: string | null;
  entityBadge: string | null;
  address?: string;
}

interface BubbleLink {
  source: string;
  target: string;
  value: number;
  direction: 'in' | 'out' | 'both';
}

interface BubbleMapData {
  nodes: BubbleNode[];
  links: BubbleLink[];
  mode: 'holders' | 'network' | 'clusters';
  clusters?: Array<{ id: string; label: string; color: string; nodeIds: string[] }>;
  tokenInfo: {
    name: string;
    symbol: string;
    chain: string;
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    liquidity: number;
    totalHolders: number;
    topHolderConcentration: number;
    logoURI: string | null;
    verified: boolean;
    contractType: string;
    dataSource: string;
  };
  security: {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    riskColor: string;
    topHoldersConcentration: number;
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    ownershipRenounced: boolean;
    checks: Array<{ label: string; status: 'pass' | 'fail' | 'warn' }>;
  };
}

// ─── Node Colors ──────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  token:    '#0A1EFF',
  exchange: '#10B981',
  whale:    '#F59E0B',
  contract: '#8B5CF6',
  dex:      '#06B6D4',
  team:     '#EC4899',
  scammer:  '#EF4444',
  unknown:  '#6B7280',
};

const TYPE_LABELS: Record<string, string> = {
  token: 'Token', exchange: 'Exchange', whale: 'Whale', contract: 'Contract',
  unknown: 'Unknown', scammer: 'Scammer', dex: 'DEX', team: 'Team',
};

// ─── Connection Builder ────────────────────────────────────────────────────────

function buildWalletConnections(nodes: BubbleNode[]): BubbleLink[] {
  const links: BubbleLink[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      // Same classified type (non-unknown, non-whale) → entity relationship
      if (a.type !== 'unknown' && a.type !== 'whale' && a.type === b.type) {
        links.push({ source: a.id, target: b.id, value: Math.min(a.percentage, b.percentage), direction: 'both' });
        continue;
      }
      // Similar holding size (< 0.3% diff, > 0.5%) → potential coordination
      const diff = Math.abs(a.percentage - b.percentage);
      if (diff < 0.3 && a.percentage > 0.5) {
        links.push({ source: a.id, target: b.id, value: diff < 0.1 ? 2 : 1, direction: 'both' });
      }
    }
  }
  return links.slice(0, 60);
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();
  const mode = (searchParams.get('mode') || 'holders') as 'holders' | 'network' | 'clusters';

  if (!token) {
    return NextResponse.json({ error: 'Token address is required' }, { status: 400 });
  }

  try {
    // ── Single call: full contract intelligence ────────────────────────────
    const intel = await buildContractIntelligence(token, chain);

    // ── Build nodes from verified holder data ──────────────────────────────
    const holderNodes: BubbleNode[] = intel.holders.map((h, i) => ({
      id: `holder-${i}`,
      label: h.label,
      value: h.percentage * 1000,
      percentage: h.percentage,
      type: h.isScammer ? 'scammer' : h.type,
      entity: h.entityName ?? h.label,
      verified: h.verified,
      color: NODE_COLORS[h.isScammer ? 'scammer' : h.type] ?? NODE_COLORS.unknown,
      entityLabel: h.entityLabel,
      entityName: h.entityName,
      entityBadge: h.entityBadge,
      address: h.address,
    }));

    const centerNode: BubbleNode = {
      id: 'center',
      label: intel.symbol || intel.name,
      value: 50000,
      percentage: 100,
      type: 'token',
      entity: intel.name,
      verified: intel.verified,
      color: NODE_COLORS.token,
      entityLabel: null,
      entityName: intel.name,
      entityBadge: intel.metadata.sourceVerified ? '✓' : null,
    };

    const nodes = [centerNode, ...holderNodes];

    // ── Build links based on mode ──────────────────────────────────────────
    let links: BubbleLink[];
    let clusters: BubbleMapData['clusters'];

    if (mode === 'network') {
      const centerLinks = holderNodes.slice(0, 20).map(h => ({
        source: 'center', target: h.id, value: h.percentage, direction: 'both' as const,
      }));
      const walletLinks = buildWalletConnections(holderNodes);
      links = [...centerLinks, ...walletLinks];
    } else if (mode === 'clusters') {
      links = holderNodes.map(h => ({
        source: 'center', target: h.id, value: h.percentage, direction: 'both' as const,
      }));
      const groupMap: Record<string, BubbleNode[]> = {};
      for (const h of holderNodes) {
        (groupMap[h.type] = groupMap[h.type] || []).push(h);
      }
      clusters = Object.entries(groupMap).map(([type, members]) => ({
        id: `cluster-${type}`,
        label: TYPE_LABELS[type] ?? type,
        color: NODE_COLORS[type] ?? '#6B7280',
        nodeIds: members.map(m => m.id),
      }));
    } else {
      links = holderNodes.map(h => ({
        source: 'center', target: h.id, value: h.percentage, direction: 'both' as const,
      }));
    }

    // ── Security risk from holder concentration ────────────────────────────
    const holderRisk = topHolderRisk(intel.metadata.topHolderConcentration);

    // ── 50/50 enrichment: prefer CoinGecko for price + market cap when it
    //    indexes this contract. Falls back to the Alchemy/DexScreener-derived
    //    values from buildContractIntelligence so the bubble map never
    //    flatlines if CoinGecko misses the token.
    let cgPrice = 0;
    let cgMarketCap = 0;
    let cgChange24h = 0;
    try {
      cgPrice = await getContractPrice(token, intel.chain);
      if (cgPrice > 0) {
        // Best effort to also pull market cap + 24h change from the full
        // detail endpoint. If the contract isn't in the detail index we
        // keep the simple price and leave market cap to Alchemy/Dex.
        try {
          const detail = await getTokenDetail(intel.symbol.toLowerCase());
          cgMarketCap = detail.market_data?.market_cap?.usd ?? 0;
          cgChange24h = detail.market_data?.price_change_percentage_24h ?? 0;
        } catch { /* detail miss — keep price-only */ }
      }
    } catch { /* CoinGecko down or contract not indexed */ }

    const bubbleData: BubbleMapData = {
      nodes,
      links,
      clusters,
      mode,
      tokenInfo: {
        name: intel.name,
        symbol: intel.symbol,
        chain: intel.chain,
        price: cgPrice > 0 ? cgPrice : (intel.market.priceUSD ?? 0),
        priceChange24h: cgChange24h !== 0 ? cgChange24h : intel.market.priceChange24h,
        volume24h: intel.market.volume24h,
        marketCap: cgMarketCap > 0 ? cgMarketCap : intel.market.marketCap,
        liquidity: intel.market.liquidity,
        totalHolders: intel.metadata.holderCount,
        topHolderConcentration: intel.metadata.topHolderConcentration,
        logoURI: intel.market.logoURI,
        verified: intel.verified,
        contractType: intel.type,
        dataSource: intel.metadata.dataSource,
      },
      security: {
        ...holderRisk,
        topHoldersConcentration: intel.metadata.topHolderConcentration,
        isHoneypot: intel.security.isHoneypot,
        buyTax: intel.security.buyTax,
        sellTax: intel.security.sellTax,
        ownershipRenounced: intel.security.ownershipRenounced,
        checks: intel.security.checks,
      },
    };

    return NextResponse.json(bubbleData);
  } catch (err) {
    console.error('[bubble-map] failed:', err);
    return NextResponse.json({ error: 'Failed to generate bubble map data' }, { status: 500 });
  }
}
