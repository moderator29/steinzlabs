'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ShareData {
  title: string;
  summary: string;
  chain: string;
  tokenSymbol: string;
  platform: string;
}

export default function ShortSharePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const shortId = params.id as string;
    if (!shortId) return;

    fetch(`/api/share?id=${shortId}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#0A1EFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Share Not Found</h1>
          <p className="text-gray-400 mb-6">This shared event may have expired or the link is invalid.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-lg font-semibold text-white"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <img src="/steinz-logo-64.png" alt="Steinz Labs" className="w-8 h-8" />
            <div>
              <h2 className="text-sm font-bold text-white">Steinz Labs</h2>
              <p className="text-xs text-gray-400">On-Chain Intelligence</p>
            </div>
          </div>

          <h1 className="text-lg font-bold text-white mb-3">{data.title}</h1>
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">{data.summary}</p>

          <div className="flex items-center gap-3 text-xs text-gray-400 mb-6">
            {data.chain && (
              <span className="px-2 py-1 bg-white/5 rounded font-semibold uppercase">{data.chain}</span>
            )}
            {data.platform && (
              <span className="px-2 py-1 bg-white/5 rounded">{data.platform}</span>
            )}
            {data.tokenSymbol && (
              <span className="font-mono">${data.tokenSymbol}</span>
            )}
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl font-semibold text-white text-sm"
          >
            Open in Steinz Labs
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            Powered by Steinz Labs — Real-time on-chain intelligence
          </p>
        </div>
      </div>
    </div>
  );
}
