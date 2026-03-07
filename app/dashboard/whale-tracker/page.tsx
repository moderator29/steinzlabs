'use client';

import { Fish, ArrowLeft, ArrowUpRight, ArrowDownRight, ExternalLink, RotateCcw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface WhaleEvent {
  type: string;
  whale: string;
  whaleShort: string;
  token: string;
  amount: string;
  amountRaw: number;
  time: string;
  chain: string;
  label: string;
  txHash?: string;
  blockNum?: string;
}

export default function WhaleTrackerPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [events, setEvents] = useState<WhaleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWhaleData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/whale-tracker');
      if (!res.ok) throw new Error('Failed to fetch whale data');
      const data = await res.json();
      setEvents(data.events || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWhaleData();
    const interval = setInterval(() => fetchWhaleData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchWhaleData]);

  const filteredEvents = events.filter(e => {
    if (filter === 'All') return true;
    if (filter === 'Buys') return e.type === 'buy';
    if (filter === 'Sells') return e.type === 'sell';
    if (filter === 'Transfers') return e.type === 'transfer';
    return true;
  });

  const getEtherscanLink = (event: WhaleEvent) => {
    if (event.txHash) return `https://etherscan.io/tx/${event.txHash}`;
    if (event.whale && event.whale !== 'market') return `https://etherscan.io/address/${event.whale}`;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Fish className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Whale Tracker</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
              <span className="text-[10px] text-[#10B981]">Live</span>
            </div>
            <button onClick={() => fetchWhaleData()} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors" title="Refresh">
              <RotateCcw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {lastUpdated && (
          <div className="text-[10px] text-gray-500 text-right">
            Updated {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 30s
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Buys', 'Sells', 'Transfers'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {f}
            </button>
          ))}
          <div className="ml-auto text-[10px] text-gray-500 self-center whitespace-nowrap">
            {filteredEvents.length} events
          </div>
        </div>

        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin" />
            <p className="text-sm text-gray-400">Scanning blockchain for whale activity...</p>
          </div>
        ) : error && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Fish className="w-10 h-10 text-gray-600" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => fetchWhaleData()} className="text-xs text-[#00E5FF] hover:underline">
              Try again
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Fish className="w-10 h-10 text-gray-600" />
            <p className="text-sm text-gray-400">No whale events found for this filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map((event, i) => {
              const link = getEtherscanLink(event);
              return (
                <div key={i} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${event.type === 'buy' ? 'bg-[#10B981]/20' : event.type === 'sell' ? 'bg-[#EF4444]/20' : 'bg-[#F59E0B]/20'}`}>
                        {event.type === 'buy' ? <ArrowUpRight className="w-4 h-4 text-[#10B981]" /> : event.type === 'sell' ? <ArrowDownRight className="w-4 h-4 text-[#EF4444]" /> : <ArrowUpRight className="w-4 h-4 text-[#F59E0B]" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{event.label} <span className="text-gray-500 font-normal capitalize">{event.type}</span></div>
                        <div className="text-[10px] text-gray-500 font-mono">{event.whaleShort}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500">{event.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="font-semibold text-white text-xs">{event.amount} {event.token}</span>
                      <span>{event.chain}</span>
                    </div>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-[#00E5FF] hover:underline text-[10px] flex items-center gap-0.5">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-600 text-[10px] flex items-center gap-0.5">
                        Market <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
