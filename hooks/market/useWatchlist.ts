'use client';

import { useState, useEffect, useCallback } from 'react';

export function useWatchlist(userId: string | null) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    window.fetch(`/api/market/watchlist?userId=${userId}`)
      .then((r) => r.json())
      .then((data: { watchlist?: { token_id: string }[] }) => {
        setWatchlist((data.watchlist ?? []).map((w) => w.token_id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const addToWatchlist = useCallback(async (tokenId: string) => {
    if (!userId) return;
    setWatchlist((prev) => [...new Set([...prev, tokenId])]);
    await window.fetch('/api/market/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tokenId }),
    }).catch(() => {});
  }, [userId]);

  const removeFromWatchlist = useCallback(async (tokenId: string) => {
    if (!userId) return;
    setWatchlist((prev) => prev.filter((id) => id !== tokenId));
    await window.fetch(`/api/market/watchlist?userId=${userId}&tokenId=${tokenId}`, {
      method: 'DELETE',
    }).catch(() => {});
  }, [userId]);

  const isWatched = useCallback((tokenId: string) => watchlist.includes(tokenId), [watchlist]);

  const toggleWatchlist = useCallback(async (tokenId: string) => {
    if (isWatched(tokenId)) await removeFromWatchlist(tokenId);
    else await addToWatchlist(tokenId);
  }, [isWatched, addToWatchlist, removeFromWatchlist]);

  return { watchlist, loading, addToWatchlist, removeFromWatchlist, isWatched, toggleWatchlist };
}
