'use client';

import { useState, useEffect, useCallback } from 'react';
import { CandlestickChart, RefreshCw, CheckCircle2, XCircle, CircleDot } from 'lucide-react';

interface RwaHealth {
  provider: string;
  configured: boolean;
  finnhubConfigured: boolean;
  live: boolean;
  rowCount: number;
  asOf: string | null;
  reason: string | null;
}

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}` };
}

export default function RwaMarketsPage() {
  const [data, setData] = useState<RwaHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rwa-markets', { headers: authHeader() });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('[admin/rwa-markets] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">RWA / Markets Board</h1>
          <p className="text-xs text-gray-500 mt-0.5">Health of the real-world-asset board (indices, stocks, gold and oil)</p>
        </div>
        <button onClick={load} disabled={loading} className="nl-button nl-button--ghost">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Checking board status...</span>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="nl-glass rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#0066FF]/10 rounded-xl flex items-center justify-center">
                <CandlestickChart className="w-5 h-5 text-[#0066FF]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{data.provider}</div>
                <div className="text-[11px] text-gray-500">Market data provider</div>
              </div>
              <div className="ms-auto">
                {data.live ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400"><CircleDot className="w-3.5 h-3.5" />Live</span>
                ) : data.configured ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400"><CircleDot className="w-3.5 h-3.5" />Configured</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500"><CircleDot className="w-3.5 h-3.5" />Not configured</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatusRow label="TWELVE_DATA_API_KEY" ok={data.configured} okText="Configured" badText="Not set" />
              <StatusRow label="Board serving live quotes" ok={data.live} okText={`Live (${data.rowCount} rows)`} badText={data.reason ?? 'Not live'} />
              <StatusRow label="FINNHUB_API_KEY (fallback)" ok={data.finnhubConfigured} okText="Configured" badText="Not set" neutralWhenBad />
              <div className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2.5">
                <span className="text-gray-400">As of</span>
                <span className="text-gray-300">{data.asOf ? new Date(data.asOf).toLocaleString() : '-'}</span>
              </div>
            </div>
          </div>

          {!data.configured && (
            <div className="nl-glass rounded-2xl p-4">
              <p className="text-xs text-gray-400">
                Set <span className="font-mono text-gray-300">TWELVE_DATA_API_KEY</span> to bring the board live. Until then the public
                board honestly returns unavailable and shows no fabricated prices.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-500">Unable to load board status.</div>
      )}
    </div>
  );
}

function StatusRow({ label, ok, okText, badText, neutralWhenBad }: {
  label: string; ok: boolean; okText: string; badText: string; neutralWhenBad?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2.5">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold inline-flex items-center gap-1.5 ${ok ? 'text-emerald-400' : neutralWhenBad ? 'text-gray-500' : 'text-amber-400'}`}>
        {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {ok ? okText : badText}
      </span>
    </div>
  );
}
