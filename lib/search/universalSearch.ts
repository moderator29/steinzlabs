import { searchDEXScreener } from './dexscreener';
import { searchCoinGecko } from './coingecko';
import { searchPumpFun } from './pumpfun';
import { arkhamAPI } from '../arkham/api';
import { SearchResult } from './types';

export async function universalSearch(query: string): Promise<SearchResult[]> {


  try {
    const [dexResults, geckoResults, pumpResults] = await Promise.all([
      searchDEXScreener(query),
      searchCoinGecko(query),
      searchPumpFun(query),
    ]);

    const allResults = [
      ...dexResults,
      ...geckoResults,
      ...pumpResults,
    ];

    const uniqueMap = new Map<string, SearchResult>();

    for (const result of allResults) {
      const key = `${result.chain}:${result.address.toLowerCase()}`;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, result);
      } else {
        const existing = uniqueMap.get(key)!;
        if (result.volume24h > existing.volume24h) {
          uniqueMap.set(key, result);
        }
      }
    }

    const uniqueResults = Array.from(uniqueMap.values());

    const topResults = uniqueResults.slice(0, 20);

    const enriched = await Promise.all(
      topResults.map(async (result) => {
        try {
          const holders = await arkhamAPI.getTokenHolders(result.address, 5);

          if (holders.length === 0) {
            return result;
          }

          const topHolder = holders[0];
          const topHolderEntity = topHolder.entity?.name || undefined;
          const arkhamVerified = topHolder.entity?.verified || false;

          const scammerPresent = holders.some(h =>
            h.labels?.includes('scammer') || h.labels?.includes('rug_puller')
          );

          let safetyScore = 5;
          if (arkhamVerified) safetyScore += 2;
          if (scammerPresent) safetyScore -= 3;
          safetyScore = Math.min(Math.max(safetyScore, 0), 10);

          return {
            ...result,
            arkhamVerified,
            topHolderEntity,
            safetyScore,
            scammerPresent,
          };
        } catch (error) {

          return result;
        }
      })
    );

    enriched.sort((a, b) => {
      if (a.arkhamVerified && !b.arkhamVerified) return -1;
      if (!a.arkhamVerified && b.arkhamVerified) return 1;

      if (!a.scammerPresent && b.scammerPresent) return -1;
      if (a.scammerPresent && !b.scammerPresent) return 1;

      if (a.safetyScore > b.safetyScore) return -1;
      if (a.safetyScore < b.safetyScore) return 1;

      return b.volumeUSD - a.volumeUSD;
    });


    return enriched;

  } catch (error) {

    return [];
  }
}
