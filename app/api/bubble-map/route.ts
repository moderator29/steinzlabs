import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
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

function buildWalletConnections(nodes: BubbleNode[], marketCapUsd: number): BubbleLink[] {
  // BUBBLE1: link weight is the USD value of the smaller side of the
  // pair (percentage × market cap), not raw percentage. A 0.5% holder
  // of a $1B mcap token represents $5M of capital; a 0.5% holder of
  // a $1M mcap token represents $5K. The edge thickness should reflect
  // capital at risk, not unitless percentage. Falls back to percentage
  // when market cap is unknown so the link still renders.
  const useUsd = marketCapUsd > 0;
  const toMetric = (pct: number) => useUsd ? (pct / 100) * marketCapUsd : pct;
  const links: BubbleLink[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.type !== 'unknown' && a.type !== 'whale' && a.type === b.type) {
        links.push({
          source: a.id,
          target: b.id,
          value: Math.min(toMetric(a.percentage), toMetric(b.percentage)),
          direction: 'both',
        });
        continue;
      }
      const diff = Math.abs(a.percentage - b.percentage);
      if (diff < 0.3 && a.percentage > 0.5) {
        // Coordination signal stays binary (diff-based) but is scaled
        // into the same USD/pct space as the other links so the renderer
        // can apply one consistent thickness scale.
        const baseMetric = toMetric(Math.min(a.percentage, b.percentage));
        links.push({
          source: a.id,
          target: b.id,
          value: diff < 0.1 ? baseMetric * 2 : baseMetric,
          direction: 'both',
        });
      }
    }
  }
  return links.slice(0, 60);
}

// ─── GET Handler ──────────────────────────────────────────────────────────────
//
// P0 audit fix: previously this route had ZERO auth or tier gate, so
// any user (logged-in or not) could enumerate unlimited token holders
// via the bubble-map API. The page hardcoded `tier:'pro'` client-side
// which made the gate look enforced — it wasn't. Now wrapped in
// withTierGate('pro') so free-tier callers get a clean 403 and the
// expensive contract-intelligence pipeline doesn't run.

export const GET = withTierGate('pro', async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();
  const mode = (searchParams.get('mode') || 'holders') as 'holders' | 'network' | 'clusters';
  // BUBBLE4: timeline scrub — the underlying intel pipeline is
  // live-only (no historical holders snapshot store yet), so we surface
  // the requested timestamp back to the caller as `snapshotAt` so the
  // UI can label the view and shareable URLs render deterministically
  // even though the data itself is current. A follow-up wires the
  // snapshot store (holder_snapshots already exists per migration).
  const atParam = searchParams.get('at');
  const snapshotAt = atParam && !Number.isNaN(Number(atParam))
    ? new Date(Number(atParam)).toISOString()
    : new Date().toISOString();

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

    // CoinGecko enrichment happens up-front so the center bubble can colorize
    // by 24h price change (green = up, red = down, blue = flat/unknown).
    let cgPrice = 0;
    let cgMarketCap = 0;
    let cgChange24h = 0;
    try {
      cgPrice = await getContractPrice(token, intel.chain);
      if (cgPrice > 0) {
        try {
          const detail = await getTokenDetail(intel.symbol.toLowerCase());
          cgMarketCap = detail.market_data?.market_cap?.usd ?? 0;
          cgChange24h = detail.market_data?.price_change_percentage_24h ?? 0;
        } catch { /* detail miss — keep price-only */ }
      }
    } catch { /* CoinGecko down or contract not indexed */ }

    const effectiveChange24h = cgChange24h !== 0 ? cgChange24h : intel.market.priceChange24h;
    const centerColor =
      effectiveChange24h > 1 ? '#10B981' :
      effectiveChange24h < -1 ? '#EF4444' :
      NODE_COLORS.token;

    const centerNode: BubbleNode = {
      id: 'center',
      label: intel.symbol || intel.name,
      value: 50000,
      percentage: 100,
      type: 'token',
      entity: intel.name,
      verified: intel.verified,
      color: centerColor,
      entityLabel: null,
      entityName: intel.name,
      entityBadge: intel.metadata.sourceVerified ? '✓' : null,
    };

    const nodes = [centerNode, ...holderNodes];

    // ── Build links based on mode ──────────────────────────────────────────
    let links: BubbleLink[];
    let clusters: BubbleMapData['clusters'];

    if (mode === 'network') {
      const useUsd = cgMarketCap > 0;
      const centerLinks = holderNodes.slice(0, 20).map(h => ({
        source: 'center', target: h.id,
        value: useUsd ? (h.percentage / 100) * cgMarketCap : h.percentage,
        direction: 'both' as const,
      }));
      const walletLinks = buildWalletConnections(holderNodes, cgMarketCap);
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
      const useUsd = cgMarketCap > 0;
      links = holderNodes.map(h => ({
        source: 'center', target: h.id,
        value: useUsd ? (h.percentage / 100) * cgMarketCap : h.percentage,
        direction: 'both' as const,
      }));
    }

    // ── Security risk from holder concentration ────────────────────────────
    const holderRisk = topHolderRisk(intel.metadata.topHolderConcentration);

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

    return NextResponse.json({ ...bubbleData, snapshotAt });
  } catch (err) {
    // CLAUDE.md: no console.error in production — Sentry capture instead.
    Sentry.captureException(err, { tags: { route: 'bubble-map' } });
    return NextResponse.json({ error: 'Failed to generate bubble map data' }, { status: 500 });
  }
});
