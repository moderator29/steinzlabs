'use client';

/**
 * Coins home. A store-front, not a scanner list: a featured coin leads, then a
 * Game-of-Thrones "houses" tab bar switches the discovery list beneath it —
 * Heating Up (hot now), House Stark (verified/trusted), House Targaryen (just
 * graduated), the Iron Throne (most held) and your own Watch. A chain filter
 * scopes every house, and a unified "search for anything" returns coins and
 * people together. Real data only, graduated DEX coins across Solana, Ethereum,
 * BNB — every coin surfaced clears the quality bar, so it has a live chart.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Star, Flame, ShieldCheck, Crown, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { CoinLogo, PriceDelta } from '@/components/coins/atoms';
import { FeaturedCoin } from '@/components/coins/CoinRails';
import { CoinRow } from '@/components/coins/CoinRow';
import { ChainFilter, type ChainFilterValue } from '@/components/coins/ChainFilter';
import { TopTrades } from '@/components/coins/TopTrades';
import { CircleBuying } from '@/components/coins/CircleBuying';
import { LiveTape } from '@/components/coins/LiveTape';
import { CoinMomentsStrip } from '@/components/coins/CoinMomentsStrip';
import { FundButton } from '@/components/coins/FundButton';
import { isSolanaAddress } from '@/lib/utils/addressNormalize';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { useWallet } from '@/lib/hooks/useWallet';
import type { Coin } from '@/lib/coins/types';
import { coinPrice, compactUsd } from '@/lib/coins/format';

type Cat = 'trending' | 'verified' | 'graduated' | 'most_held' | 'watchlist';
const CATS: Cat[] = ['trending', 'verified', 'graduated', 'most_held', 'watchlist'];

/** The discovery "houses". Sigils + a plain-English sub keep the Game-of-Thrones
 *  theming fun without hiding what each tab actually does. */
interface House { key: Cat; name: string; sub: string; sigil: string; accent: string; Icon: LucideIcon; empty: string }
const HOUSES: House[] = [
  { key: 'trending',  name: 'Wildlings',     sub: 'Hot now',   sigil: '🔥', accent: '#FF7847', Icon: Flame,       empty: 'Beyond the wall is quiet on this chain right now. Try another chain.' },
  { key: 'verified',  name: 'Stark',         sub: 'Verified',  sigil: '🐺', accent: '#9DB8DE', Icon: ShieldCheck, empty: 'No coin has earned the wolf yet. Verified coins appear here once our team vets them — real, trusted, no imposters.' },
  { key: 'graduated', name: 'Targaryen',     sub: 'Graduated', sigil: '🐉', accent: '#E4482E', Icon: Flame,       empty: 'No dragons have hatched here recently. Fresh graduates land here the moment a new pool clears the liquidity bar.' },
  { key: 'most_held', name: 'Iron Throne',   sub: 'Most held', sigil: '👑', accent: '#F0B90B', Icon: Crown,       empty: 'No coin holds the throne on this chain yet.' },
  { key: 'watchlist', name: "Night's Watch", sub: 'Watchlist', sigil: '🛡️', accent: '#7FB2FF', Icon: Star,        empty: 'Your watch is empty. Tap the star on any coin to take the black and keep an eye on it.' },
];

interface Person { id: string; username: string | null; display_name: string | null; avatar_url: string | null; verified: boolean }

export default function CoinsPage() {
  const [chain, setChain] = useState<ChainFilterValue>('all');
  const [cats, setCats] = useState<Record<Cat, Coin[]> | null>(null);
  const [tab, setTab] = useState<Cat>('trending');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchCoins, setSearchCoins] = useState<Coin[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { address, balance } = useWallet();

  const loadCats = useCallback(async () => {
    setCats(null);
    const one = async (cat: Cat): Promise<Coin[]> => {
      const params = new URLSearchParams({ tab: cat });
      if (chain !== 'all') params.set('chain', chain);
      try {
        const r = await fetch(`/api/coins?${params.toString()}`, { cache: 'no-store' });
        const j = await r.json();
        return Array.isArray(j.coins) ? j.coins : [];
      } catch { return []; }
    };
    // Keyed by category so the result never depends on array order.
    const entries = await Promise.all(CATS.map(async (c) => [c, await one(c)] as const));
    setCats(Object.fromEntries(entries) as Record<Cat, Coin[]>);
  }, [chain]);

  useEffect(() => { if (!query) void loadCats(); }, [loadCats, query]);

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
  const featured = cats?.trending[0] ?? null;
  const anyCoins = cats && CATS.some((c) => cats[c].length > 0);

  const activeHouse = HOUSES.find((h) => h.key === tab)!;
  // Heating Up drops its first coin — that one already leads as the featured hero.
  const activeCoins = !cats ? [] : tab === 'trending' ? cats.trending.slice(1) : cats[tab];

  return (
    <AuroraBackground fullHeight>
    <div className="min-h-screen text-white max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-28">
      <div className="flex items-center gap-2 mb-3">
        <BackButton href="/dashboard" />
        <h1 className="text-lg font-bold bg-gradient-to-r from-white to-[#8fb4ff] bg-clip-text text-transparent">Coins</h1>
        <div className="ms-auto flex items-center gap-2">
          {address ? (
            <div className="text-right leading-tight">
              <div className="text-[15px] font-bold text-white tabular-nums">{compactUsd(balance?.totalUsd ?? 0)}</div>
              <div className="text-[10px] text-white/40">Wallet</div>
            </div>
          ) : null}
          <FundButton
            address={address}
            chain={address && isSolanaAddress(address) ? 'solana' : 'ethereum'}
            label="Deposit"
            className="relative overflow-hidden inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shrink-0 nl-glass transition-all hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-10px_rgba(0,102,255,.55)]"
          />
        </div>
      </div>

      {/* Unified search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for anything"
          className="w-full h-12 rounded-2xl nl-glass pl-10 pr-10 text-[15px] text-white placeholder:text-white/35 outline-none focus:shadow-[0_0_22px_-6px_rgba(0,102,255,.7)] transition-shadow"
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
        <div className="space-y-5">
          {/* Chain filter scopes every house */}
          <ChainFilter value={chain} onChange={setChain} />

          {cats === null ? (
            <div className="space-y-5">
              <div className="h-[200px] rounded-3xl bg-white/[0.03] animate-pulse" />
              <div className="h-[52px] rounded-2xl bg-white/[0.03] animate-pulse" />
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] rounded-2xl bg-white/[0.03] animate-pulse" />)}</div>
            </div>
          ) : !anyCoins ? (
            <div className="nl-glass rounded-2xl p-8 text-center text-white/50 text-sm">No coins to show on this chain right now. Try another chain.</div>
          ) : (
            <>
              {/* Featured hero */}
              {featured ? <FeaturedCoin coin={featured} /> : null}

              {/* Auto-detected coin moments (milestones, your circle aping). */}
              <CoinMomentsStrip />

              {/* Leaderboard entry */}
              <Link
                href="/dashboard/coins/leaderboard"
                className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 nl-glass transition-all hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-10px_rgba(0,102,255,.55)]"
              >
                <Trophy className="w-4 h-4 text-[#F0B90B] shrink-0" />
                <span className="text-[13px] font-semibold text-white">Leaderboard</span>
                <span className="text-[12px] text-white/45 truncate">Top traders and trades</span>
                <span className="ms-auto text-[12px] font-semibold text-[#7FB2FF] shrink-0">View</span>
              </Link>

              {/* Houses — the discovery tab bar */}
              <HouseTabs tab={tab} onSelect={setTab} counts={cats} />

              {/* Active house list */}
              <AnimatePresence mode="wait">
                <motion.div key={`${tab}:${chain}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  <HouseHeader house={activeHouse} count={activeCoins.length} />
                  <HouseCoinList coins={activeCoins} house={activeHouse} />
                </motion.div>
              </AnimatePresence>

              {/* Social floor — same for every house */}
              <div className="space-y-5 pt-1">
                <CircleBuying />
                <TopTrades />
                <LiveTape />
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </AuroraBackground>
  );
}

/** The Game-of-Thrones house tab bar — a scrollable pill row, X-style. */
function HouseTabs({ tab, onSelect, counts }: { tab: Cat; onSelect: (c: Cat) => void; counts: Record<Cat, Coin[]> }) {
  return (
    <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 backdrop-blur-md bg-[#060a1a]/70 border-b border-white/[0.04]">
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 snap-x">
      {HOUSES.map((h) => {
        const active = tab === h.key;
        const n = counts[h.key]?.length ?? 0;
        return (
          <button
            key={h.key}
            type="button"
            onClick={() => onSelect(h.key)}
            aria-pressed={active}
            className={`snap-start shrink-0 flex items-center gap-2 rounded-2xl px-3.5 py-2 transition-all ${active ? 'nl-glass -translate-y-[1px]' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}
            style={active ? { boxShadow: `0 10px 26px -12px ${h.accent}cc, inset 0 0 0 1px ${h.accent}66` } : undefined}
          >
            <span className="text-[17px] leading-none">{h.sigil}</span>
            <span className="text-left leading-tight">
              <span className="block text-[13px] font-bold text-white whitespace-nowrap">{h.name}</span>
              <span className="block text-[10px] font-semibold whitespace-nowrap" style={{ color: active ? h.accent : 'rgba(255,255,255,.4)' }}>
                {h.sub}{n > 0 ? ` · ${n}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
    </div>
  );
}

/** Section header for the active house — sigil, name and the plain-English sub. */
function HouseHeader({ house, count }: { house: House; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2.5 px-0.5">
      <span className="text-[16px] leading-none">{house.sigil}</span>
      <h2 className="text-[15px] font-bold text-white">{house.name}</h2>
      <span className="text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ color: house.accent, background: `${house.accent}1f` }}>{house.sub}</span>
      {count > 0 ? <span className="ms-auto text-[12px] text-white/35 font-semibold">{count}</span> : null}
    </div>
  );
}

/** The active house's coins as a clean vertical list, windowed with "show more".
 *  A themed empty state keeps every house honest when it has nothing to show. */
function HouseCoinList({ coins, house }: { coins: Coin[]; house: House }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [house.key]);

  if (coins.length === 0) {
    return (
      <div className="nl-glass rounded-2xl p-8 text-center">
        <div className="text-[34px] mb-2 leading-none">{house.sigil}</div>
        <div className="text-white/55 text-[13px] max-w-sm mx-auto">{house.empty}</div>
      </div>
    );
  }

  const shown = expanded ? coins : coins.slice(0, 12);
  const remaining = coins.length - shown.length;
  return (
    <div className="space-y-2">
      {shown.map((c, i) => (
        <CoinRow key={`${c.chain}:${c.tokenKey}`} coin={c} index={i} />
      ))}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-2xl py-2.5 text-[13px] font-semibold text-[#7FB2FF] nl-glass hover:text-white transition-colors"
        >
          Show {remaining} more
        </button>
      ) : null}
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
