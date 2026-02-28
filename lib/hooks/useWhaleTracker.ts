'use client';

import { useEffect, useState } from 'react';

interface WhaleData {
  address: string;
  balance: number;
  balanceUsd: number;
  chain: string;
  recentTxCount: number;
  totalVolume: number;
  accuracyScore: number;
  lastActive: string;
  recentTransactions: any[];
}

export function useWhaleTracker(chain: string = 'ethereum', limit: number = 20) {
  const [whales, setWhales] = useState<WhaleData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWhales = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/whale-tracker?chain=${chain}&limit=${limit}`);
      const data = await response.json();
      setWhales(data.whales || []);
    } catch (error) {
      console.error('Failed to fetch whales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhales();
  }, [chain, limit]);

  return { whales, loading, refresh: fetchWhales };
}
