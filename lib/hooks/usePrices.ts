'use client';

import { useEffect, useState } from 'react';

interface PriceData {
  price: number;
  change24h: number;
}

interface Prices {
  btc: PriceData | null;
  eth: PriceData | null;
  sol: PriceData | null;
}

export function usePrices() {
  const [prices, setPrices] = useState<Prices>({ btc: null, eth: null, sol: null });
  const [loading, setLoading] = useState(true);

  const fetchPrices = async () => {
    try {
      const response = await fetch('/api/prices');
      const data = await response.json();
      setPrices(data);
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

  return { ...prices, loading };
}
