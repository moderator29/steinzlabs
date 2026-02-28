'use client';

import { useEffect, useState } from 'react';

interface PriceData {
  price: number;
  change24h: number;
  name?: string;
  image?: string;
  marketCap?: number;
  volume?: number;
}

export function usePrices() {
  const [allPrices, setAllPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);

  const fetchPrices = async () => {
    try {
      const response = await fetch('/api/prices');
      const data = await response.json();
      setAllPrices(data);
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const btc = allPrices['BTC'] || allPrices['btc'] || null;
  const eth = allPrices['ETH'] || allPrices['eth'] || null;
  const sol = allPrices['SOL'] || allPrices['sol'] || null;

  return { prices: allPrices, btc, eth, sol, loading };
}
