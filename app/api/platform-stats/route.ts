import 'server-only';
import { NextResponse } from 'next/server';

interface PlatformStats {
  chains: number;
  signalAccuracy: string;
  volumeTracked: string;
  activeUsers: string;
  totalTokensScanned: string;
  predictionsResolved: number;
  lastUpdated: string;
}

let cachedStats: PlatformStats | null = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000;

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000_000) return `$${(vol / 1_000_000_000_000).toFixed(1)}T`;
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(0)}M`;
  return `$${vol.toFixed(0)}`;
}

async function fetchGlobalMarketVolume(): Promise<string> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/global',
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return 'N/A';
    const data = await res.json();
    const totalVolume = data?.data?.total_volume?.usd || 0;
    return formatVolume(totalVolume);
  } catch {
    return 'N/A';
  }
}

export async function GET() {
  const now = Date.now();

  if (cachedStats && now - lastFetch < CACHE_TTL) {
    return NextResponse.json(cachedStats);
  }

  try {
    const globalVolume = await fetchGlobalMarketVolume();

    cachedStats = {
      chains: 12,
      signalAccuracy: 'Beta',
      volumeTracked: globalVolume,
      activeUsers: 'Beta',
      totalTokensScanned: 'N/A',
      predictionsResolved: 0,
      lastUpdated: new Date().toISOString(),
    };

    lastFetch = now;

    return NextResponse.json(cachedStats);
  } catch {
    const fallback: PlatformStats = {
      chains: 12,
      signalAccuracy: 'Beta',
      volumeTracked: 'N/A',
      activeUsers: 'Beta',
      totalTokensScanned: 'N/A',
      predictionsResolved: 0,
      lastUpdated: new Date().toISOString(),
    };
    return NextResponse.json(fallback);
  }
}
