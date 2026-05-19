'use client';

import { useEffect, useState } from 'react';

interface Slot {
  id: string;
  position: number;
  address: string;
  chain: string;
  label: string | null;
  notes: string | null;
  added_at: string;
}

interface EchoResponse {
  slots: Slot[];
  capacity: number;
  isChosen: boolean;
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Echo Chamber — twenty-five communal stealth-wallet slots. Cult-only read,
 * Chosen-only mutate. Replaces the SubChamberPlaceholder of the same name
 * inside OracleHubClient.
 *
 * v1 lists wallets as plain rows. Live holdings enrichment (USD totals,
 * top positions) is the obvious next pass — keep the UI compact so adding
 * a holdings preview later doesn't require reflow.
 */
export function EchoChamberPanel() {
  const [state, setState] = useState<EchoResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  async function refresh() {
    const res = await fetch('/api/cult/oracle/echo', { credentials: 'include' });
    if (!res.ok) {
      setState(null);
      return;
    }
    setState((await res.json()) as EchoResponse);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/oracle/echo', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EchoResponse | null) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  async function add() {
    if (!address.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cult/oracle/echo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          chain: chain.trim(),
          label: label.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'add_failed');
        return;
      }
      setAddress('');
      setLabel('');
      setNotes('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cult/oracle/echo/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'remove_failed');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const slotsUsed = state.slots.length;

  return (
    <article
      className="oracle-subchamber oracle-subchamber--echo"
      aria-label="Echo Chamber — stealth wallets"
    >
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">Echo Chamber</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">
          {slotsUsed} / {state.capacity}
        </span>
      </header>
      <h3 className="oracle-subchamber__title">The cult&apos;s quiet pack</h3>
      <p className="oracle-subchamber__tagline">
        Twenty-five wallets only the cult sees. Watch what they hold; the noise hears nothing.
      </p>

      {slotsUsed > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5">
          {state.slots.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="w-6 text-end text-[10px] text-[#7F8AA8]">#{s.position}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[13px] text-white font-mono">
                  {shortAddr(s.address)}
                </span>
                <span className="block truncate text-[11px] text-[#B4C0E0]">
                  {s.chain}
                  {s.label ? ` · ${s.label}` : ''}
                </span>
              </span>
              {state.isChosen ? (
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={busy}
                  aria-label={`Remove ${shortAddr(s.address)} from the Echo Chamber`}
                  className="rounded-md border border-[#FF1744]/30 px-2 py-1 text-[11px] text-[#FF1744] hover:bg-[#FF1744]/10 disabled:opacity-30"
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[12px] text-[#7F8AA8]">The chamber is empty.</p>
      )}

      {state.isChosen && slotsUsed < state.capacity ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[#FFD86B]/30 bg-white/[0.02] p-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#FFD86B]">
            Chosen path — seat a new wallet
          </span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Wallet address"
            className="rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[12px] text-white outline-none focus:border-[#FFD86B]/60"
          />
          <div className="flex gap-2">
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[12px] text-white outline-none focus:border-[#FFD86B]/60"
            >
              <option value="ethereum">Ethereum</option>
              <option value="bsc">BSC</option>
              <option value="base">Base</option>
              <option value="arbitrum">Arbitrum</option>
              <option value="optimism">Optimism</option>
              <option value="polygon">Polygon</option>
              <option value="avalanche">Avalanche</option>
              <option value="solana">Solana</option>
            </select>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              maxLength={80}
              className="flex-1 rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[12px] text-white outline-none focus:border-[#FFD86B]/60"
            />
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            maxLength={280}
            className="rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[12px] text-[#E6ECFF] outline-none focus:border-[#FFD86B]/60"
          />
          {error ? (
            <p className="text-[11px] text-[#FF1744]" role="alert">
              {error === 'chosen_only'
                ? 'Only the Chosen may seat wallets.'
                : error === 'address_format_unknown'
                  ? 'Address must be EVM (0x…) or Solana base58.'
                  : error === 'chamber_full'
                    ? 'All twenty-five slots are taken.'
                    : 'Add failed. Try again.'}
            </p>
          ) : null}
          <button
            type="button"
            onClick={add}
            disabled={busy || !address.trim()}
            className="nl-button inline-flex items-center justify-center px-4 py-2 text-[12px] uppercase tracking-[0.18em] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Seating…' : 'Seat wallet'}
          </button>
        </div>
      ) : null}

      <div className="oracle-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
