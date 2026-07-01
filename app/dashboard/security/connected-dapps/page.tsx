'use client';

import { useEffect, useState } from 'react';
import { Loader2, Unplug, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useDisconnect, useAccount } from 'wagmi';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

/**
 * NW4: Connected dApps. Lists every WalletConnect / AppKit session the
 * current wallet has open and lets the user revoke any of them.
 *
 * AppKit (built on wagmi + WalletConnect v2) does not expose an
 * "active sessions" object the way the underlying signClient does —
 * we read sessions directly from WalletConnect's storage via the
 * signClient instance attached to wagmi's connector. For session
 * revocation we call connector.disconnect() which triggers WC v2's
 * session_delete event, propagating to all paired dApps.
 */

interface SessionView {
  topic: string;
  peerName: string;
  peerUrl: string | null;
  peerIcon: string | null;
  expiry: number | null;
  chains: string[];
}

export default function ConnectedDappsPage() {
  const { isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!connector) { setSessions([]); return; }
        // WalletConnect v2 connectors expose getProvider()→signClient.
        // The shape varies by AppKit / wagmi version — read defensively.
        const provider = await (connector as unknown as { getProvider?: () => Promise<unknown> }).getProvider?.();
        const signClient = (provider as unknown as { signClient?: { session?: { values?: unknown[] } } } | null)?.signClient;
        const values = signClient?.session?.values ?? [];
        if (cancelled) return;

        const mapped: SessionView[] = (values as Array<{ topic: string; peer?: { metadata?: { name?: string; url?: string; icons?: string[] } }; expiry?: number; namespaces?: Record<string, { chains?: string[] }> }>).map((s) => ({
          topic: s.topic,
          peerName: s.peer?.metadata?.name ?? 'Unknown dApp',
          peerUrl: s.peer?.metadata?.url ?? null,
          peerIcon: s.peer?.metadata?.icons?.[0] ?? null,
          expiry: s.expiry ?? null,
          chains: Object.values(s.namespaces ?? {}).flatMap((n) => n.chains ?? []),
        }));
        setSessions(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read WalletConnect sessions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [connector]);

  const revokeAll = async () => {
    setRevoking('all');
    try {
      await disconnect();
      setSessions([]);
    } finally {
      setRevoking(null);
    }
  };

  const revokeOne = async (topic: string) => {
    setRevoking(topic);
    try {
      if (!connector) return;
      const provider = await (connector as unknown as { getProvider?: () => Promise<unknown> }).getProvider?.();
      const signClient = (provider as unknown as { signClient?: { disconnect?: (args: { topic: string; reason: { code: number; message: string } }) => Promise<void> } } | null)?.signClient;
      if (!signClient?.disconnect) {
        // Fallback: full disconnect; user is dropped from every dApp.
        await disconnect();
        setSessions([]);
        return;
      }
      await signClient.disconnect({ topic, reason: { code: 6000, message: 'User revoked' } });
      setSessions((prev) => prev.filter((s) => s.topic !== topic));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <AuroraBackground fullHeight className="text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1 nl-fade-up">
          <ShieldCheck className="w-5 h-5 text-emerald-300" /> Connected dApps
        </h2>
        <p className="text-sm text-slate-400 mb-6">Every WalletConnect session your wallet currently has open. Revoke any you don&apos;t recognise.</p>

        {!isConnected && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/[0.05] p-4 text-sm text-yellow-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Connect a wallet to inspect open dApp sessions.
          </div>
        )}

        {isConnected && (
          <>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions…
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] p-4 text-sm text-red-200">{error}</div>
            )}
            {!loading && !error && sessions.length === 0 && (
              <div className="nl-glass rounded-xl p-6 text-sm text-slate-400 text-center" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                No open WalletConnect sessions. You&apos;re only connected to Naka Labs.
              </div>
            )}
            {sessions.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400">{sessions.length} active</span>
                  <button
                    type="button"
                    onClick={() => void revokeAll()}
                    disabled={revoking !== null}
                    className="text-[11px] text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded-full px-3 py-1 disabled:opacity-50"
                  >
                    {revoking === 'all' ? 'Disconnecting…' : 'Revoke all'}
                  </button>
                </div>
                <ul className="space-y-2">
                  {sessions.map((s) => (
                    <li key={s.topic} className="flex items-center gap-3 nl-glass rounded-xl p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                      {s.peerIcon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.peerIcon} alt="" className="w-9 h-9 rounded-lg object-cover bg-white/5" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 text-xs">?</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{s.peerName}</div>
                        {s.peerUrl && <div className="text-[11px] text-slate-500 truncate">{s.peerUrl}</div>}
                        {s.chains.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{s.chains.join(', ')}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void revokeOne(s.topic)}
                        disabled={revoking !== null}
                        className="inline-flex items-center gap-1 text-[11px] text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded-full px-3 py-1 disabled:opacity-50"
                        aria-label={`Disconnect ${s.peerName}`}
                      >
                        <Unplug className="w-3 h-3" />
                        {revoking === s.topic ? 'Revoking…' : 'Revoke'}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </AuroraBackground>
  );
}
