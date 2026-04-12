import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

// Service layer — all external data comes through here
import { vtxQuery, vtxStream, VTX_TOOLS } from '@/lib/services/anthropic';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getTokenDetail, getTopTokens, getGlobalMarketData, getTrendingTokens as getCGTrending } from '@/lib/services/coingecko';
import { searchPairs, getTokenPairs, getNewPairs } from '@/lib/services/dexscreener';
import { getTokenMetadata, getTokenHolderCount, getContractCode } from '@/lib/services/alchemy';
import { getSolanaTokenMeta, getSolanaTokenSupply, getSolanaSOLBalance } from '@/lib/services/helius';
import { getSocialScore } from '@/lib/services/lunarcrush';
import { getEntityLabel, getAddressIntel, getWalletConnections, getTokenHolders } from '@/lib/services/arkham';
import { getEthBalance } from '@/lib/services/alchemy';
import { vtxAnalyze } from '@/lib/services/anthropic';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_TIER_LIMIT = 25;
const MAX_TOOL_ITERATIONS = 5;

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getRateLimitInfo(ip: string): { remaining: number; total: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + 24 * 60 * 60 * 1000;
    rateLimitStore.set(ip, { count: 0, resetAt });
    return { remaining: FREE_TIER_LIMIT, total: FREE_TIER_LIMIT, resetAt };
  }
  return {
    remaining: Math.max(0, FREE_TIER_LIMIT - entry.count),
    total: FREE_TIER_LIMIT,
    resetAt: entry.resetAt,
  };
}

function incrementUsage(ip: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

// ─── Address / Intent Detectors ──────────────────────────────────────────────

function detectWalletAddress(message: string): { address: string; chain: 'eth' | 'sol' } | null {
  const ethMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (ethMatch) return { address: ethMatch[0], chain: 'eth' };
  const solMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch && !solMatch[0].match(/^(https?|www\.|[a-z]+\.[a-z])/i)) {
    const candidate = solMatch[0];
    if (candidate.length >= 32 && candidate.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(candidate)) {
      return { address: candidate, chain: 'sol' };
    }
  }
  return null;
}

function detectTokenAddress(message: string): string | null {
  const ethMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (ethMatch) return ethMatch[0];
  const solMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch && !solMatch[0].match(/^(https?|www\.|[a-z]+\.[a-z])/i)) {
    const candidate = solMatch[0];
    if (candidate.length >= 32 && candidate.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function detectChartSignal(message: string): {
  chartType: 'price' | 'bubble' | 'portfolio' | 'holders' | null;
  chartToken: string | null;
} {
  const chartTagMatch = message.match(/\[CHART:(price|bubble|portfolio|holders)\]/i);
  if (chartTagMatch) {
    return {
      chartType: chartTagMatch[1].toLowerCase() as 'price' | 'bubble' | 'portfolio' | 'holders',
      chartToken: null,
    };
  }
  const lower = message.toLowerCase();
  if (/\bportfolio\b.*\b(breakdown|allocation|pie|chart|show|visual)\b|\b(show|visual|chart).*\bportfolio\b/.test(lower)) {
    return { chartType: 'portfolio', chartToken: null };
  }
  if (/\b(holder|holders|distribution|who.*hold|bubble\s*map)\b.*\b(chart|show|visual|map)\b|\b(show|visual|chart|map).*\b(holder|distribution|bubble)\b/.test(lower)) {
    return { chartType: /bubble/.test(lower) ? 'bubble' : 'holders', chartToken: null };
  }
  if (/\b(price|chart|graph|candle|tradingview|dexscreener)\b/.test(lower)) {
    const tokenMatch = lower.match(/(?:price|chart|graph)\s+(?:of\s+|for\s+)?([a-z]+)/);
    return { chartType: 'price', chartToken: tokenMatch ? tokenMatch[1] : null };
  }
  return { chartType: null, chartToken: null };
}

function detectArkhamIntent(message: string): {
  wantsHolders: boolean;
  wantsConnections: boolean;
  wantsEntitySearch: boolean;
  entityQuery: string;
} {
  const lower = message.toLowerCase();
  return {
    wantsHolders: /holder|top.*hold|who.*hold|distribution|supply|whale.*hold|bag.*hold|biggest.*hold/.test(lower),
    wantsConnections: /connect|link|relation|associated|tied.*to|network|graph|cluster|who.*interact/.test(lower),
    wantsEntitySearch: /who.*is|identify|lookup|find.*entity|search.*entity|which.*fund|which.*exchange/.test(lower),
    entityQuery: (
      lower.match(/who\s+is\s+(.+?)(?:\?|$)/)?.[1] ||
      lower.match(/identify\s+(.+?)(?:\?|$)/)?.[1] ||
      lower.match(/search\s+(?:for\s+)?(.+?)(?:\?|$)/)?.[1] || ''
    ).trim(),
  };
}
