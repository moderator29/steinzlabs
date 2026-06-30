'use client';

/**
 * §3 P2-D.7 — Approval Audit Panel UI.
 *
 * Page wrapper around the existing POST /api/security/approvals
 * endpoint (Alchemy getTokenApprovals + GoPlus address-security). Lists
 * every active ERC20 approval for a wallet with spender label, allowance
 * (unlimited/finite), and risk classification (safe/warning/danger).
 *
 * "Revoke" builds an approve(spender, 0) calldata the wallet signs.
 */

import { useState } from 'react';
import { ShieldAlert, Loader2, ExternalLink } from 'lucide-react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

interface ApprovalRow {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  spender: string;
  spenderLabel: string;
  allowance: string;
  isUnlimited: boolean;
  riskLevel: 'safe' | 'warning' | 'danger';
  spenderRisk?: {
    isMalicious: boolean;
    isPhishing: boolean;
    labels: string[];
  };
}

interface AuditResponse {
  approvals?: ApprovalRow[];
  totalRisk?: 'safe' | 'warning' | 'danger';
  unlimitedCount?: number;
  dangerCount?: number;
  scannedAt?: string;
  error?: string;
}

const CHAINS = ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism', 'bsc'];

// approve(address,uint256) selector
const APPROVE_SELECTOR = '0x095ea7b3';

function buildRevokeCalldata(spender: string): string {
  const padded = spender.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  return `${APPROVE_SELECTOR}${padded}${'0'.repeat(64)}`;
}

const RISK_BG: Record<ApprovalRow['riskLevel'], string> = {
  safe: 'bg-emerald-500/10 text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-300',
  danger: 'bg-red-500/10 text-red-300',
};

export default function ApprovalsPage() {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchAudit() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch('/api/security/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, chain }),
      });
      const json = (await res.json()) as AuditResponse;
      setData(json);
    } catch (e) {
      setData({ error: e instanceof Error ? e.message : 'fetch failed' });
    } finally {
      setLoading(false);
    }
  }

  async function revoke(row: ApprovalRow) {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!eth) {
      alert('No EVM wallet detected');
      return;
    }
    const data = buildRevokeCalldata(row.spender);
    try {
      await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: row.tokenAddress, data, value: '0x0' }],
      });
    } catch (e) {
      console.error('Revoke failed', e);
    }
  }

  return (
    <AuroraBackground fullHeight className="text-white">
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6 nl-fade-up">
        <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
        <h1 className="text-2xl font-bold">Approval Audit</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="nl-glass rounded-lg px-3 py-2 text-sm"
        >
          {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="flex-1 nl-glass rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#0066FF]"
        />
        <button
          onClick={fetchAudit}
          disabled={loading}
          className="nl-btn-neon px-4 py-2 rounded-lg disabled:opacity-50 text-sm font-bold flex items-center gap-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning</> : 'Scan'}
        </button>
      </div>

      {data?.error && (
        <div className="nl-glass nl-glass--crimson rounded-xl px-4 py-3 text-sm text-[#EF4444]">
          {data.error}
        </div>
      )}

      {data && data.approvals && (
        <div className="nl-glass rounded-xl px-4 py-3 mb-4 flex items-center gap-6 text-sm" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
          <span>Active: <span className="font-bold">{data.approvals.length}</span></span>
          <span>Unlimited: <span className="font-bold text-amber-300">{data.unlimitedCount ?? 0}</span></span>
          <span>Danger: <span className="font-bold text-red-300">{data.dangerCount ?? 0}</span></span>
        </div>
      )}

      <div className="space-y-2">
        {data?.approvals?.map((row) => (
          <div key={`${row.tokenAddress}-${row.spender}`} className="nl-glass rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{row.tokenSymbol || row.tokenName || 'Unknown'}</span>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${RISK_BG[row.riskLevel]}`}>{row.riskLevel}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">Spender: <span className="text-slate-300">{row.spenderLabel}</span></div>
              <div className="text-xs text-slate-500">Allowance: <span className={row.isUnlimited ? 'text-amber-300 font-bold' : 'text-slate-300'}>{row.allowance}</span></div>
              {row.spenderRisk?.isMalicious && (
                <div className="text-[11px] text-red-300 mt-1">⚠ Spender flagged malicious</div>
              )}
              {row.spenderRisk?.isPhishing && (
                <div className="text-[11px] text-red-300 mt-1">⚠ Spender flagged phishing</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <a
                href={`https://etherscan.io/address/${row.spender}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
              >
                view <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => revoke(row)}
                className="px-3 py-1 rounded-md bg-[#EF4444] hover:bg-[#EF4444]/90 text-xs font-bold"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
        {data?.approvals && data.approvals.length === 0 && !data.error && (
          <div className="text-sm text-slate-400 text-center py-8">No active approvals found.</div>
        )}
      </div>

      <div className="mt-6 text-[11px] text-slate-500 leading-relaxed">
        Approvals data via Alchemy getTokenApprovals + GoPlus address-security.
        Revoke broadcasts approve(spender, 0) from your connected wallet.
      </div>
    </div>
    </AuroraBackground>
  );
}
