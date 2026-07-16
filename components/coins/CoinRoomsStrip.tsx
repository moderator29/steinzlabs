'use client';

/**
 * CoinRoomsStrip - a horizontal "Live coin rooms" discovery strip. Fetches
 * /api/coins/rooms (coins with chat activity in the last 7 days) and renders
 * each as an edge-lit glass tile linking to that coin's page. Real data only;
 * renders nothing when there are no active rooms. Export-only and self-contained
 * so an integrator can drop it in without wiring.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessagesSquare } from 'lucide-react';
import { CoinLogo } from '@/components/coins/atoms';
import { shortAgo } from '@/lib/coins/format';

interface RoomTile {
  chain: string;
  token_address: string;
  token_key: string;
  symbol: string | null;
  logo_url: string | null;
  messageCount: number;
  lastAt: string;
}

export function CoinRoomsStrip() {
  const [rooms, setRooms] = useState<RoomTile[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/coins/rooms', { cache: 'no-store' });
        const j = await r.json();
        setRooms(Array.isArray(j.rooms) ? j.rooms : []);
      } catch {
        setRooms([]);
      }
    })();
  }, []);

  if (rooms !== null && rooms.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <MessagesSquare className="w-4 h-4 text-[#7FB2FF]" />
        <h2 className="text-[15px] font-bold text-white">Live coin rooms</h2>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {rooms === null
          ? [0, 1, 2, 3].map((i) => <div key={i} className="w-[168px] h-[86px] shrink-0 rounded-2xl bg-white/[0.03] animate-pulse" />)
          : rooms.map((room, i) => {
              const symbol = (room.symbol || '').trim();
              return (
                <motion.div
                  key={`${room.chain}:${room.token_key}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Link
                    href={`/dashboard/coins/${room.chain}/${encodeURIComponent(room.token_address)}`}
                    className="group relative block w-[168px] shrink-0 rounded-2xl p-3 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_-12px_rgba(0,102,255,.6)]"
                  >
                    <span className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#00C8FF]/15 blur-2xl group-hover:bg-[#00C8FF]/30 transition-colors" />
                    <div className="relative flex items-center gap-2 mb-2">
                      <CoinLogo logoUrl={room.logo_url} symbol={symbol || '?'} chain={room.chain} size={30} />
                      <span className="text-[14px] font-bold text-white truncate">{symbol ? `$${symbol}` : 'Coin'}</span>
                    </div>
                    <div className="relative flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#7FB2FF] tabular-nums">
                        {room.messageCount} {room.messageCount === 1 ? 'message' : 'messages'}
                      </span>
                      <span className="text-[11px] text-white/40 tabular-nums">
                        {shortAgo(new Date(room.lastAt).getTime())}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
      </div>
    </div>
  );
}
