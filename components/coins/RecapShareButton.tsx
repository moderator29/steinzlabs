'use client';

/**
 * Share button for a user's weekly recap / Naka Wrapped card. Fetches the
 * branded OG PNG and triggers a download, mirroring the position-share flow in
 * ProfileCoins. Flat lucide icon, nl-glass styling, honest no-op on failure.
 * Mounted on the profile / analytics surfaces.
 */

import { useState } from 'react';
import { Share2 } from 'lucide-react';

interface RecapShareButtonProps {
  username: string;
  kind?: 'week' | 'wrapped';
  period?: 'month' | 'year';
}

export function RecapShareButton({ username, kind = 'week', period = 'month' }: RecapShareButtonProps) {
  const [sharing, setSharing] = useState(false);

  const label = kind === 'wrapped' ? 'Share Wrapped' : 'Share recap';

  const share = async () => {
    setSharing(true);
    try {
      const url =
        kind === 'wrapped'
          ? `/api/coins/wrapped?user=${encodeURIComponent(username)}&period=${encodeURIComponent(period)}`
          : `/api/coins/recap-card?user=${encodeURIComponent(username)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = kind === 'wrapped' ? `naka-wrapped-${period}.png` : 'naka-weekly-recap.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      /* ignore, honest no-op on failure */
    } finally {
      setSharing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={sharing}
      aria-label={label}
      title={label}
      className="nl-glass inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white/70 hover:text-[#7FB2FF] disabled:opacity-40"
    >
      <Share2 className="w-4 h-4" />
      {label}
    </button>
  );
}
