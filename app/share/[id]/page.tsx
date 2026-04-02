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

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function decodePayload(encoded: string): ShareData | null {
  try {
    const json = base64UrlDecode(encoded);
    const data = JSON.parse(json);
    return {
      title: data.t || '',
      summary: data.s || '',
      chain: data.c || '',
      tokenSymbol: data.tk || '',
      platform: data.p || '',
    };
  } catch {
    return null;
  }
}

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ShareData | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    setData(decodePayload(id));
  }, [params.id]);

  if (!data) {
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
