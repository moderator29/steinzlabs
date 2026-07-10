'use client';

/**
 * DappConnect (#43) — Naka acts as a wallet that external dApps connect to.
 * Paste a WalletConnect URI, approve the session with your built-in Naka
 * wallet, and sign each incoming request (password-gated, in-browser, never
 * server-side). EVM only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link2, Loader2, X, Check, AlertTriangle } from 'lucide-react';
import { decryptPrivateKey } from '@/lib/wallet/encryption';
import {
  getWalletKit,
  approveDappSession,
  rejectDappSession,
  signEvmRequest,
  respondDappRequest,
  disconnectDappSession,
  dappConnectConfigured,
} from '@/lib/wallet/dappConnect';

interface ActiveWallet { address: string; encryptedKey: string }

function activeNakaWallet(): ActiveWallet | null {
  if (typeof window === 'undefined') return null;
  try {
    const wallets = JSON.parse(localStorage.getItem('steinz_wallets') || '[]') as Array<{ address?: string; encryptedKey?: string }>;
    const active = localStorage.getItem('steinz_active_wallet_address') || wallets[0]?.address || '';
    const w = wallets.find((x) => x.address && x.address.toLowerCase() === active.toLowerCase()) || wallets[0];
    return w?.address && w.encryptedKey ? { address: w.address, encryptedKey: w.encryptedKey } : null;
  } catch {
    return null;
  }
}

interface SessionRow { topic: string; name: string; url: string }
// Minimal shapes for the WC events we consume.
interface ProposalEvt { id: number; params: { proposer?: { metadata?: { name?: string; url?: string } } } }
interface RequestEvt { topic: string; id: number; params: { request: { method: string; params: unknown[] }; chainId: string } }

export function DappConnect() {
  const [wallet] = useState(activeNakaWallet);
  const [open, setOpen] = useState(false);
  const [uri, setUri] = useState('');
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [proposal, setProposal] = useState<ProposalEvt | null>(null);
  const [request, setRequest] = useState<RequestEvt | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const wired = useRef(false);

  const refreshSessions = useCallback(async () => {
    const kit = await getWalletKit();
    if (!kit) return;
    const active = kit.getActiveSessions();
    setSessions(Object.values(active).map((s) => ({
      topic: s.topic,
      name: s.peer?.metadata?.name ?? 'dApp',
      url: s.peer?.metadata?.url ?? '',
    })));
  }, []);

  // Register WalletKit listeners once (only when a built-in wallet exists).
  useEffect(() => {
    if (!wallet || wired.current || !dappConnectConfigured()) return;
    wired.current = true;
    let cancelled = false;
    (async () => {
      const kit = await getWalletKit();
      if (!kit || cancelled) return;
      kit.on('session_proposal', (e) => setProposal(e as unknown as ProposalEvt));
      kit.on('session_request', (e) => setRequest(e as unknown as RequestEvt));
      kit.on('session_delete', () => void refreshSessions());
      void refreshSessions();
    })();
    return () => { cancelled = true; };
  }, [wallet, refreshSessions]);

  if (!wallet || !dappConnectConfigured()) return null;

  const pair = async () => {
    const clean = uri.trim();
    if (!clean.startsWith('wc:')) { setError('Paste a WalletConnect URI (starts with "wc:").'); return; }
    setPairing(true); setError(null);
    try {
      const kit = await getWalletKit();
      if (!kit) throw new Error('WalletConnect is not configured.');
      await kit.pair({ uri: clean });
      setUri('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pairing failed. The URI may be expired. Get a fresh one.');
    } finally {
      setPairing(false);
    }
  };

  const onApproveProposal = async () => {
    if (!proposal) return;
    setBusy(true); setError(null);
    try {
      await approveDappSession({ proposal: proposal.params as never, address: wallet.address });
      setProposal(null);
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve the connection.');
    } finally {
      setBusy(false);
    }
  };

  const onRejectProposal = async () => {
    if (!proposal) return;
    await rejectDappSession(proposal.id).catch(() => {});
    setProposal(null);
  };

  const onApproveRequest = async () => {
    if (!request) return;
    if (!password) { setError('Enter your wallet password to sign.'); return; }
    setBusy(true); setError(null);
    try {
      const pk = await decryptPrivateKey(wallet.encryptedKey, password);
      const chainId = parseInt(request.params.chainId.split(':')[1] ?? '0', 10);
      const result = await signEvmRequest({
        method: request.params.request.method,
        requestParams: request.params.request.params,
        chainId,
        privateKey: pk,
      });
      await respondDappRequest({ topic: request.topic, id: request.id, result });
      setRequest(null); setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed.');
    } finally {
      setBusy(false);
    }
  };

  const onRejectRequest = async () => {
    if (!request) return;
    await respondDappRequest({ topic: request.topic, id: request.id, error: true }).catch(() => {});
    setRequest(null); setPassword('');
  };

  return (
    <div className="nl-glass rounded-2xl p-4 mb-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#0066FF]/10 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-[#0066FF]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Connect to a dApp</p>
            <p className="text-[11px] text-slate-400">Use your Naka wallet to sign on other apps (WalletConnect).</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Open'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={uri}
              onChange={(e) => { setUri(e.target.value); if (error) setError(null); }}
              placeholder="Paste WalletConnect URI (wc:…)"
              className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <button onClick={() => void pair()} disabled={pairing || !uri.trim()} className="px-4 py-2 bg-[#0066FF] hover:bg-[#0818CC] rounded-lg text-xs font-bold text-white disabled:opacity-50 inline-flex items-center gap-1.5">
              {pairing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
            </button>
          </div>
          {error && !proposal && !request && (
            <p className="text-[11px] text-[#EF4444] bg-[#EF4444]/5 px-3 py-2 rounded-lg border border-[#EF4444]/15">{error}</p>
          )}
          {sessions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">Connected apps</p>
              {sessions.map((s) => (
                <div key={s.topic} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{s.url}</p>
                  </div>
                  <button onClick={() => { void disconnectDappSession(s.topic).then(refreshSessions); }} className="text-[10px] text-rose-400 hover:text-rose-300 shrink-0">Disconnect</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session-proposal approval */}
      {proposal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => void onRejectProposal()}>
          <div className="w-full max-w-[360px] bg-[#0a0f1a] border border-white/10 rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Connect to {proposal.params.proposer?.metadata?.name ?? 'this dApp'}?</h3>
            <p className="text-[11px] text-slate-400 break-all">{proposal.params.proposer?.metadata?.url ?? ''}</p>
            <p className="text-[11px] text-slate-400">It will see your address and ask you to approve each transaction or signature.</p>
            {error && <p className="text-[11px] text-[#EF4444]">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => void onRejectProposal()} disabled={busy} className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 disabled:opacity-50">Reject</button>
              <button onClick={() => void onApproveProposal()} disabled={busy} className="flex-1 py-2.5 bg-[#0066FF] rounded-xl text-xs font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signing-request approval */}
      {request && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => void onRejectRequest()}>
          <div className="w-full max-w-[380px] bg-[#0a0f1a] border border-white/10 rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Signature request</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              A connected dApp is requesting: <span className="font-mono text-slate-200">{request.params.request.method}</span> on chain {request.params.chainId}.
            </p>
            {/* Audit #47 M4: show the FULL request (don't truncate). A 600-char
                slice could hide a malicious calldata tail on eth_sendTransaction;
                the box scrolls so the user can review everything they sign. */}
            <div className="max-h-40 overflow-auto rounded-lg bg-[#111827] border border-white/5 p-2 text-[10px] font-mono text-slate-400 break-all whitespace-pre-wrap">
              {JSON.stringify(request.params.request.params, null, 2)}
            </div>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }} placeholder="Wallet password" autoComplete="current-password" className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm" />
            {error && <p className="text-[11px] text-[#EF4444]">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => void onRejectRequest()} disabled={busy} className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 disabled:opacity-50">Reject</button>
              <button onClick={() => void onApproveRequest()} disabled={busy || !password} className="flex-1 py-2.5 bg-[#0066FF] rounded-xl text-xs font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Sign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
