'use client';

/**
 * Coins discovery. Graduated DEX coins across Solana, Ethereum and BNB with a
 * chain filter (All by default), discovery tabs, and a unified "search for
 * anything" that returns coins and people together. Real data only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Star, Flame, Sprout, Users2, Plus } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { CoinRow } from '@/components/coins/CoinRow';
import { CoinLogo, PriceDelta } from '@/components/coins/atoms';
import { ChainFilter, type ChainFilterValue } from '@/components/coins/ChainFilter';
import { TopTrades } from '@/components/coins/TopTrades';
import { useWallet } from '@/lib/hooks/useWallet';
import type { Coin } from '@/lib/coins/types';
import { coinPrice, compactUsd } from '@/lib/coins/format';

type Tab = 'trending' | 'graduated' | 'most_held' | 'watchlist';
const TABS: { id: Tab; label: string; Icon: typeof Flame }[] = [
  { id: 'trending', label: 'Trending', Icon: Flame },
  { id: 'graduated', label: 'Fresh', Icon: Sprout },
  { id: 'most_held', label: 'Most held', Icon: Users2 },
  { id: 'watchlist', label: 'Watchlist', Icon: Star },
];

interface Person { id: string; username: string | null; display_name: string | null; avatar_url: string | null; verified: boolean }

export default function CoinsPage() {
  const [tab, setTab] = useState<Tab>('trending');
  const [chain, setChain] = useState<ChainFilterValue>('all');
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchCoins, setSearchCoins] = useState<Coin[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { address, balance } = useWallet();
  const hasFunds = (balance?.totalUsd ?? 0) > 0;

  const loadTab = useCallback(async () => {
    setCoins(null);
    const params = new URLSearchParams({ tab });
    if (chain !== 'all') params.set('chain', chain);
    try {
      const r = await fetch(`/api/coins?${params.toString()}`, { cache: 'no-store' });
      const j = await r.json();
      setCoins(Array.isArray(j.coins) ? j.coins : []);
    } catch { setCoins([]); }
  }, [tab, chain]);

  useEffect(() => { if (!query) void loadTab(); }, [loadTab, query]);

  useEffect(() => {
    if (!query.trim()) { setSearchCoins([]); setPeople([]); setSearching(false); return; }
    setSearching(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/coins/search?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' });
        const j = await r.json();
        setSearchCoins(Array.isArray(j.coins) ? j.coins : []);
        setPeople(Array.isArray(j.people) ? j.people : []);
      } catch { setSearchCoins([]); setPeople([]); }
      finally { setSearching(false); }
    }, 260);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const showSearch = query.trim().length > 0;

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-28">
      <div className="flex items-center gap-2 mb-3">
        <BackButton href="/dashboard" />
        <h1 className="text-lg font-bold">Coins</h1>
        <div className="ms-auto flex items-center gap-2">
          {address ? (
            <div className="text-right leading-tight">
              <div className="text-[15px] font-bold text-white tabular-nums">{compactUsd(balance?.totalUsd ?? 0)}</div>
              <div className="text-[10px] text-white/40">Wallet</div>
            </div>
          ) : null}
          <Link
            href="/dashboard?tab=wallet"
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)', boxShadow: hasFunds ? 'none' : '0 6px 20px rgba(0,102,255,.4)' }}
          >
            <Plus className="w-4 h-4" /> Deposit
          </Link>
        </div>
      </div>

      {/* Unified search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for anything"
          className="w-full h-11 rounded-2xl bg-white/[0.04] border border-white/10 pl-10 pr-10 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#0066FF]/50"
        />
        {query ? (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {showSearch ? (
        <SearchResults searching={searching} coins={searchCoins} people={people} />
      ) : (
        <>
          <TopTrades />

          <div className="mb-3">
            <ChainFilter value={chain} onChange={setChain} />
          </div>

          {/* Discovery tabs */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition-colors ${
                    active ? 'bg-[#0066FF]/15 border-[#0066FF]/45 text-white' : 'bg-white/[0.03] border-white/10 text-white/55 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={`${tab}:${chain}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-2">
              {coins === null ? (
                [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[66px] rounded-2xl bg-white/[0.03] animate-pulse" />)
              ) : coins.length === 0 ? (
                <div className="nl-glass rounded-2xl p-6 text-center text-white/50 text-sm">
                  {tab === 'watchlist' ? 'No coins on your watchlist yet. Tap the star on any coin to add it.' : 'No coins to show right now. Try another chain or tab.'}
                </div>
              ) : (
                coins.map((c, i) => <CoinRow key={`${c.chain}:${c.tokenKey}`} coin={c} index={i} />)
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function SearchResults({ searching, coins, people }: { searching: boolean; coins: Coin[]; people: Person[] }) {
  if (searching && coins.length === 0 && people.length === 0) {
    return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-[60px] rounded-2xl bg-white/[0.03] animate-pulse" />)}</div>;
  }
  if (coins.length === 0 && people.length === 0) {
    return <div className="nl-glass rounded-2xl p-6 text-center text-white/50 text-sm">No coins or people match that.</div>;
  }
  return (
    <div className="space-y-4">
      {coins.length > 0 ? (
        <section>
          <h2 className="text-[12px] font-semibold text-white/50 mb-2 px-0.5">Coins</h2>
          <div className="space-y-2">
            {coins.map((c) => (
              <Link
                key={`${c.chain}:${c.tokenKey}`}
                href={`/dashboard/coins/${c.chain}/${encodeURIComponent(c.tokenAddress)}`}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 nl-glass hover:bg-white/[0.05]"
              >
                <CoinLogo logoUrl={c.logoUrl} symbol={c.symbol} chain={c.chain} size={40} verified={c.verified} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-white truncate">{c.symbol || c.name}</div>
                  <div className="text-[12px] text-white/45 truncate">{compactUsd(c.marketCapUsd)} MC</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-semibold text-white tabular-nums">{coinPrice(c.priceUsd)}</div>
                  <PriceDelta value={c.change24h} className="text-[12px]" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {people.length > 0 ? (
        <section>
          <h2 className="text-[12px] font-semibold text-white/50 mb-2 px-0.5">People</h2>
          <div className="space-y-2">
            {people.map((p) => {
              const nm = p.display_name || p.username || 'Naka user';
              const inner = (
                <>
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{nm.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-white truncate">{nm}</div>
                    {p.username ? <div className="text-[12px] text-white/45 truncate">@{p.username}</div> : null}
                  </div>
                </>
              );
              const cls = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 nl-glass';
              return p.username
                ? <Link key={p.id} href={`/u/${p.username}`} className={`${cls} hover:bg-white/[0.05]`}>{inner}</Link>
                : <div key={p.id} className={cls}>{inner}</div>;
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
