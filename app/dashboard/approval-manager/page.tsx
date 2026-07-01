'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Key, Search, AlertTriangle, CheckCircle,
  XCircle, Loader2, Info, ExternalLink, Shield, ShieldAlert,
  Zap, DollarSign, Ban, Image as ImageIcon, Clock,
} from 'lucide-react';
import type { ApprovalResult } from '@/app/api/security/approvals/route';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { approvalManagerHowItWorks } from '@/lib/howItWorks/content/approval-manager';
import { useWallet } from '@/lib/hooks/useWallet';
import { addressesEqual } from '@/lib/utils/addressNormalize';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalResponse {
  approvals: ApprovalResult[];
  totalRisk: 'safe' | 'warning' | 'danger';
  unlimitedCount: number;
  dangerCount: number;
  totalUsdAtRisk: number;
  erc20Count: number;
  permit2Count: number;
  nftCount: number;
  scannedAt: string;
}

type RevokeState = 'idle' | 'pending' | 'done' | 'failed';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', chainId: 1, hex: '0x1' },
  { id: 'bsc', label: 'BSC', chainId: 56, hex: '0x38' },
  { id: 'polygon', label: 'Polygon', chainId: 137, hex: '0x89' },
  { id: 'base', label: 'Base', chainId: 8453, hex: '0x2105' },
  { id: 'arbitrum', label: 'Arbitrum', chainId: 42161, hex: '0xa4b1' },
  { id: 'optimism', label: 'Optimism', chainId: 10, hex: '0xa' },
];

const EXPLORERS: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  bsc: 'https://bscscan.com',
  polygon: 'https://polygonscan.com',
  base: 'https://basescan.org',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
};

function approvalKey(a: ApprovalResult): string {
  // Kind is part of the key: a token+spender pair can exist as BOTH an ERC-20
  // and a Permit2 grant, and they revoke through different contracts.
  return `${a.kind}:${a.tokenAddress}:${a.spender}`;
}

function fmtUsd(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return 'no price';
  if (v === 0) return '$0';
  if (v < 0.01) return '<$0.01';
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** Relative "expires in" label for a Permit2 grant (or "expired"). */
function fmtExpiry(unixSec: number | undefined): string | null {
  if (!unixSec) return null;
  const deltaMs = unixSec * 1000 - Date.now();
  if (deltaMs <= 0) return 'expired';
  const days = Math.floor(deltaMs / 86_400_000);
  if (days >= 1) return `expires in ${days}d`;
  const hours = Math.floor(deltaMs / 3_600_000);
  if (hours >= 1) return `expires in ${hours}h`;
  const mins = Math.max(1, Math.floor(deltaMs / 60_000));
  return `expires in ${mins}m`;
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: 'safe' | 'warning' | 'danger' }) {
  if (level === 'danger') {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
        DANGER
      </span>
    );
  }
  if (level === 'warning') {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Unlimited
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      Safe
    </span>
  );
}

// ─── Kind Badge ─────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: ApprovalResult['kind'] }) {
  if (kind === 'permit2') {
    return (
      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#8B7CFF]/10 text-[#8B7CFF] border border-[#8B7CFF]/20">
        PERMIT2
      </span>
    );
  }
  if (kind === 'nft') {
    return (
      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#0066FF]/10 text-[#0066FF] border border-[#0066FF]/20 inline-flex items-center gap-0.5">
        <ImageIcon className="w-2.5 h-2.5" /> NFT
      </span>
    );
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalManagerPage() {
  const router = useRouter();
  const { address: connectedAddress, isConnected } = useWallet();
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApprovalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<Record<string, RevokeState>>({});
  const [batchBusy, setBatchBusy] = useState(false);
  const [txNote, setTxNote] = useState<string | null>(null);

  const selectedChain = CHAINS.find(c => c.id === chain) ?? CHAINS[0];
  const explorer = EXPLORERS[chain] ?? EXPLORERS.ethereum;

  // The scanned wallet is revocable only when it matches the connected signer.
  const isOwnWallet = useMemo(
    () => !!connectedAddress && !!address.trim() && addressesEqual(connectedAddress, address.trim(), chain),
    [connectedAddress, address, chain],
  );

  const handleScan = async () => {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setSelected(new Set());
    setRevoking({});
    setTxNote(null);

    try {
      const res = await fetch('/api/security/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, chain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Scan failed. Please try again.');
        return;
      }
      setResponse(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const useConnected = () => {
    if (connectedAddress) setAddress(connectedAddress);
  };

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Ensure the injected wallet is on the chain we are revoking against.
  const ensureChain = async (): Promise<boolean> => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!eth) return false;
    try {
      const current = (await eth.request({ method: 'eth_chainId' })) as string;
      if (current?.toLowerCase() === selectedChain.hex.toLowerCase()) return true;
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: selectedChain.hex }],
      });
      return true;
    } catch {
      setTxNote(`Switch your wallet to ${selectedChain.label} to revoke.`);
      return false;
    }
  };

  // Sign + broadcast approve(spender, 0) for a single approval.
  const sendRevoke = async (a: ApprovalResult): Promise<boolean> => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!eth || !connectedAddress) return false;
    const key = approvalKey(a);
    setRevoking(prev => ({ ...prev, [key]: 'pending' }));
    try {
      await eth.request({
        method: 'eth_sendTransaction',
        // revokeTarget is the contract the revoke tx goes to: the token for
        // ERC-20, the Permit2 contract for Permit2, the collection for NFTs.
        params: [{ from: connectedAddress, to: a.revokeTarget, data: a.revokeCalldata, value: '0x0' }],
      });
      setRevoking(prev => ({ ...prev, [key]: 'done' }));
      return true;
    } catch {
      setRevoking(prev => ({ ...prev, [key]: 'failed' }));
      return false;
    }
  };

  const handleRevoke = async (a: ApprovalResult) => {
    setTxNote(null);
    if (!(await ensureChain())) return;
    await sendRevoke(a);
  };

  // Batch revoke: sign each selected approval sequentially (one wallet prompt
  // per tx — EIP-1193 has no native multicall, and approve targets differ per
  // token contract). Stops cleanly if the user rejects mid-batch.
  const handleBatchRevoke = async () => {
    if (selected.size === 0 || !response) return;
    setTxNote(null);
    setBatchBusy(true);
    try {
      if (!(await ensureChain())) return;
      const targets = response.approvals.filter(a => selected.has(approvalKey(a)));
      let ok = 0;
      for (const a of targets) {
        const success = await sendRevoke(a);
        if (success) ok++;
        else break; // user rejected or tx failed — stop the batch
      }
      setTxNote(`Submitted ${ok} of ${targets.length} revocations. Rescan in a moment to confirm on-chain state.`);
    } finally {
      setBatchBusy(false);
    }
  };

  const selectedCount = selected.size;

  return (
    <AuroraBackground fullHeight className="text-white">
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 nl-glass backdrop-blur-2xl border-b border-white/10">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF] to-[#8B7CFF] rounded-xl flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-heading font-bold">Approval Manager</h1>
              <p className="text-[10px] text-gray-500">Scan, price, and revoke token spending approvals</p>
            </div>
            <HowItWorksButton content={approvalManagerHowItWorks} className="ms-auto shrink-0" />
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Hero */}
          <TiltCard className="nl-glass nl-glass--interactive rounded-2xl p-5 nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 24px rgba(0,102,255,.18)' }}>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#8B7CFF] mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-gray-300 leading-relaxed">
                Approvals let contracts spend your assets. We scan the wallet&apos;s real on-chain history
                across ERC20 allowances, Permit2 time-bounded grants, and ERC721 / ERC1155 operator
                approvals, price the exposure against live liquidity, flag malicious spenders, and let
                you revoke any of them with one click.
              </p>
            </div>
          </TiltCard>

          {/* Info banner */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-3 nl-fade-up">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Unlimited approvals to contracts you no longer use are a standing risk. Revoke broadcasts the
              right zeroing call for each type (ERC20 approve to 0, Permit2 approve to 0, or NFT
              setApprovalForAll to false) signed by your own wallet. No key ever leaves your device.
            </p>
          </div>

          {/* Chain selector */}
          <div className="flex gap-2 flex-wrap">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChain(c.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  chain === c.id
                    ? 'bg-[#0066FF]/10 border-[#0066FF]/40 text-[#8B7CFF]'
                    : 'border-white/10 text-gray-500 hover:text-gray-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Wallet address (0x...)"
              className="flex-1 nl-glass rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/40"
            />
            <button
              onClick={handleScan}
              disabled={loading || !address.trim()}
              className="nl-btn-neon px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Scan
            </button>
          </div>

          {isConnected && connectedAddress && !addressesEqual(connectedAddress, address.trim(), chain) && (
            <button onClick={useConnected} className="text-[11px] text-[#8B7CFF] hover:underline">
              Use connected wallet {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 text-[#8B7CFF] animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Scanning approvals…</p>
              <p className="text-[10px] text-gray-600 mt-1">ERC20, Permit2, and NFT operator grants in parallel, then resolving live on-chain state</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="nl-glass nl-glass--crimson rounded-2xl p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Results */}
          {response && !loading && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-4 gap-2 nl-fade-up">
                <div className="nl-glass rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold">{response.approvals.length}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Active</p>
                </div>
                <div className="nl-glass rounded-2xl p-3 text-center" style={{ boxShadow: '0 0 0 1px rgba(245,158,11,.4), 0 0 16px rgba(245,158,11,.18)' }}>
                  <p className="text-lg font-bold text-amber-400">{response.unlimitedCount}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Unlimited</p>
                </div>
                <div className="nl-glass rounded-2xl p-3 text-center" style={{ boxShadow: '0 0 0 1px rgba(239,68,68,.4), 0 0 16px rgba(239,68,68,.18)' }}>
                  <p className="text-lg font-bold text-red-400">{response.dangerCount}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Dangerous</p>
                </div>
                <div className="nl-glass rounded-2xl p-3 text-center" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                  <p className="text-lg font-bold text-[#8B7CFF]">{fmtUsd(response.totalUsdAtRisk)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">At risk</p>
                </div>
              </div>

              {/* Approval-type breakdown */}
              <div className="flex items-center justify-center gap-2 flex-wrap nl-fade-up">
                <span className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400">
                  <span className="text-gray-200 font-bold">{response.erc20Count}</span> ERC20
                </span>
                <span className="text-[10px] px-2 py-1 rounded-lg bg-[#8B7CFF]/10 border border-[#8B7CFF]/20 text-[#8B7CFF]">
                  <span className="font-bold">{response.permit2Count}</span> Permit2
                </span>
                <span className="text-[10px] px-2 py-1 rounded-lg bg-[#0066FF]/10 border border-[#0066FF]/20 text-[#0066FF]">
                  <span className="font-bold">{response.nftCount}</span> NFT operator
                </span>
              </div>

              {/* Batch action bar */}
              {response.approvals.length > 0 && isOwnWallet && (
                <div className="nl-glass nl-glass--interactive flex items-center justify-between rounded-2xl p-3 nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelected(prev =>
                        prev.size === response.approvals.length
                          ? new Set()
                          : new Set(response.approvals.map(approvalKey)))}
                      className="text-[11px] text-gray-400 hover:text-gray-200 underline"
                    >
                      {selectedCount === response.approvals.length ? 'Clear all' : 'Select all'}
                    </button>
                    <span className="text-[11px] text-gray-500">{selectedCount} selected</span>
                  </div>
                  <button
                    onClick={handleBatchRevoke}
                    disabled={selectedCount === 0 || batchBusy}
                    className="nl-btn-neon px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {batchBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Batch revoke
                  </button>
                </div>
              )}

              {!isOwnWallet && response.approvals.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-start gap-2">
                  <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-gray-400">
                    Connect this wallet ({address.slice(0, 6)}…{address.slice(-4)}) on {selectedChain.label} to revoke in-app.
                    You can still inspect every approval below.
                  </p>
                </div>
              )}

              {txNote && (
                <div className="nl-glass rounded-2xl p-3 text-[11px] text-[#8B7CFF]" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4)' }}>
                  {txNote}
                </div>
              )}

              {/* Approval list */}
              {response.approvals.length > 0 ? (
                <div className="nl-glass rounded-2xl overflow-hidden nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">Active Approvals</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Contracts with live access to your tokens</p>
                    </div>
                    {response.totalRisk === 'danger' && (
                      <div className="flex items-center gap-1.5 text-red-400">
                        <ShieldAlert className="w-4 h-4" />
                        <span className="text-[10px] font-bold">HIGH RISK</span>
                      </div>
                    )}
                    {response.totalRisk === 'warning' && (
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-[10px] font-bold">REVIEW NEEDED</span>
                      </div>
                    )}
                    {response.totalRisk === 'safe' && (
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold">ALL SAFE</span>
                      </div>
                    )}
                  </div>
                  <div className="divide-y divide-white/10">
                    {response.approvals.map((approval) => {
                      const key = approvalKey(approval);
                      const state = revoking[key] ?? 'idle';
                      return (
                        <div key={key} className="flex items-center gap-3 px-4 py-3">
                          {isOwnWallet && (
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              onChange={() => toggleSelect(key)}
                              disabled={state === 'done'}
                              className="w-4 h-4 accent-[#0066FF] flex-shrink-0"
                              aria-label={`Select ${approval.tokenSymbol} approval`}
                            />
                          )}
                          <div className={`w-8 h-8 bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden ${approval.kind === 'nft' ? 'rounded-md' : 'rounded-lg'}`}>
                            {approval.tokenLogo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={approval.tokenLogo} alt="" className="w-full h-full object-cover" />
                            ) : approval.kind === 'nft' ? (
                              <ImageIcon className="w-4 h-4 text-[#0066FF]/70" />
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400">
                                {(approval.tokenSymbol || '??').slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold truncate">{approval.tokenSymbol}</p>
                              {approval.spenderRisk?.isMalicious && (
                                <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                              )}
                              <KindBadge kind={approval.kind} />
                              {approval.kind === 'nft' && approval.nft?.tokenType && approval.nft.tokenType !== 'UNKNOWN' && (
                                <span className="text-[8px] text-gray-500 font-mono">{approval.nft.tokenType}</span>
                              )}
                            </div>
                            <a
                              href={`${explorer}/address/${approval.spender}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-gray-500 truncate hover:text-gray-300 inline-flex items-center gap-1"
                            >
                              {approval.kind === 'nft' ? 'Operator: ' : ''}{approval.spenderLabel}
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                            </a>
                            {approval.kind === 'permit2' && fmtExpiry(approval.permit2Expiration) && (
                              <p className="text-[9px] text-gray-500 mt-0.5 inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {fmtExpiry(approval.permit2Expiration)}
                              </p>
                            )}
                            {approval.kind === 'nft' && (
                              <p className="text-[9px] text-gray-500 mt-0.5">
                                {approval.nft?.ownedCount !== null && approval.nft?.ownedCount !== undefined
                                  ? `${approval.nft.ownedCount} owned now`
                                  : 'owned count unknown'}
                                {approval.nft?.floorNative !== null && approval.nft?.floorNative !== undefined
                                  ? ` · floor ${approval.nft.floorNative}` : ''}
                              </p>
                            )}
                            {(approval.spenderRisk?.isMalicious || approval.spenderRisk?.isPhishing || approval.spenderRisk?.isBlacklisted) && (
                              <p className="text-[10px] text-red-400 mt-0.5">
                                {approval.spenderRisk.isMalicious && 'Flagged malicious. '}
                                {approval.spenderRisk.isPhishing && 'Flagged phishing. '}
                                {approval.spenderRisk.isBlacklisted && 'Blacklisted. '}
                                {approval.spenderRisk.scamReportCount !== null && approval.spenderRisk.scamReportCount > 0 &&
                                  `${approval.spenderRisk.scamReportCount} scam report${approval.spenderRisk.scamReportCount === 1 ? '' : 's'}. `}
                                {(approval.spenderRisk.maliciousSourceCount ?? 0) > 1 &&
                                  `${approval.spenderRisk.maliciousSourceCount} sources agree. `}
                                Revoke now.
                              </p>
                            )}
                            {!approval.spenderRisk?.isMalicious && approval.spenderRisk?.isUnverifiedContract === true && (
                              <p className="text-[10px] text-amber-400 mt-0.5">
                                Unverified contract source. Treat with caution.
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <RiskBadge level={approval.riskLevel} />
                            <p className="text-[10px] text-gray-300 font-semibold flex items-center gap-0.5">
                              <DollarSign className="w-2.5 h-2.5 text-gray-500" />
                              {fmtUsd(approval.usdAtRisk)}
                            </p>
                            <p className="text-[9px] text-gray-600 font-mono">{approval.allowance}</p>
                          </div>
                          {isOwnWallet && (
                            <button
                              onClick={() => handleRevoke(approval)}
                              disabled={state === 'pending' || state === 'done'}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 flex-shrink-0 transition-all ${
                                state === 'done'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : state === 'failed'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : 'bg-red-500/90 hover:bg-red-500 text-white'
                              }`}
                            >
                              {state === 'pending' && <Loader2 className="w-3 h-3 animate-spin" />}
                              {state === 'done' && <CheckCircle className="w-3 h-3" />}
                              {state === 'failed' && <Ban className="w-3 h-3" />}
                              {state === 'done' ? 'Revoked' : state === 'failed' ? 'Retry' : 'Revoke'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="nl-glass rounded-2xl p-6 text-center nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(16,185,129,.4), 0 0 16px rgba(16,185,129,.18)' }}>
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-emerald-400">No active approvals detected</p>
                  <p className="text-[11px] text-gray-500 mt-1">This wallet has a clean approval history on {selectedChain.label}</p>
                </div>
              )}

              {/* Safety tips */}
              <div className="nl-glass rounded-2xl p-4 nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#8B7CFF]" />
                  Approval Safety Rules
                </h3>
                <div className="space-y-2">
                  {[
                    'Revoke unlimited approvals from protocols you no longer use',
                    'Never approve unlimited spending from unknown contracts',
                    'Revoke approvals immediately after completing a swap',
                    'Use hardware wallets for high-value approval management',
                    'Any approval from a DANGER-flagged spender should be revoked immediately',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF]/60 mt-1.5 flex-shrink-0" />
                      <span className="text-[11px] text-gray-500">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-600 text-center">
                Scanned {response.approvals.length} active approvals ({response.erc20Count} ERC20, {response.permit2Count} Permit2, {response.nftCount} NFT) · on-chain via Alchemy · prices via DexScreener &amp; CoinGecko · spender labels &amp; risk via Etherscan, GoPlus &amp; Chainabuse · {new Date(response.scannedAt).toLocaleTimeString()}
              </p>
            </>
          )}

          {/* Empty state */}
          {!response && !loading && !error && (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0066FF]/10 flex items-center justify-center">
                <Key className="w-8 h-8 text-[#8B7CFF]/60" />
              </div>
              <h3 className="text-sm font-semibold text-gray-500">Enter a wallet address</h3>
              <p className="text-[11px] text-gray-600 mt-1.5 max-w-[260px] mx-auto">
                Detect active token approvals, the dollars they expose, and revoke the risky ones in one click
              </p>
            </div>
          )}
        </div>
      </div>
    </AuroraBackground>
  );
}
