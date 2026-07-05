'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, Layers } from 'lucide-react';

interface StakeAccount { stakeAccount: string; validator: string | null; stakedSol: number; state: string; }

// REAL native-SOL staking positions read from chain via /api/wallet/staking.
// Honest empties: no accounts → a "stake with Jito/Marinade" CTA (real dApps),
// never a fabricated position. Only shown when a Solana address is present.
function StakingPositions({ solanaAddress }: { solanaAddress: string }) {
  const [data, setData] = useState<{ accounts: StakeAccount[]; totalStakedSol: number; networkApyPct: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/wallet/staking?address=${encodeURIComponent(solanaAddress)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [solanaAddress]);

  if (loading || !data) return null;
  const apy = data.networkApyPct != null ? `${data.networkApyPct.toFixed(1)}%` : '—';

  return (
    <div className="rounded-xl nl-glass p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white"><Layers className="w-3.5 h-3.5 text-[#8FA3FF]" /> SOL Staking</div>
        <span className="text-[10px] text-slate-400">Network APY ~{apy}</span>
      </div>
      {data.accounts.length > 0 ? (
        <>
          <div className="text-sm font-bold text-white">{data.totalStakedSol.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL staked</div>
          <div className="space-y-1">
            {data.accounts.slice(0, 4).map((a) => (
              <div key={a.stakeAccount} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono truncate max-w-[150px]">{a.validator ? `${a.validator.slice(0, 4)}…${a.validator.slice(-4)}` : 'Undelegated'}</span>
                <span className="flex items-center gap-2">
                  <span className="text-white">{a.stakedSol.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${a.state === 'active' ? 'bg-emerald-500/15 text-emerald-300' : a.state === 'deactivating' ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-slate-400'}`}>{a.state}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-400">No active SOL stake accounts. Stake with a validator via <a href="https://www.jito.network" target="_blank" rel="noopener noreferrer" className="text-[#8FA3FF] hover:underline">Jito</a> or <a href="https://marinade.finance" target="_blank" rel="noopener noreferrer" className="text-[#8FA3FF] hover:underline">Marinade</a> to earn ~{apy}.</p>
      )}
    </div>
  );
}

// Curated directory of REAL, well-known dApps — every entry is a genuine live
// product with its real URL. No fabricated listings. Logos are each dApp's own
// favicon (via DuckDuckGo's icon proxy, keyless) with a lettered fallback, so
// nothing is mocked. Tapping a card opens the real dApp in a new tab; the user
// connects there with the same wallet.
interface Dapp {
  name: string;
  url: string;
  category: 'DeFi' | 'Trading' | 'NFT' | 'Staking' | 'Bridge' | 'Tools';
  chains: string;
  blurb: string;
}

const DAPPS: Dapp[] = [
  // DeFi
  { name: 'Uniswap', url: 'https://app.uniswap.org', category: 'Trading', chains: 'ETH · Base · Arbitrum · Polygon', blurb: 'Largest on-chain DEX' },
  { name: 'Aave', url: 'https://app.aave.com', category: 'DeFi', chains: 'ETH · Arbitrum · Base · Avax', blurb: 'Lending & borrowing' },
  { name: 'Curve', url: 'https://curve.fi', category: 'DeFi', chains: 'ETH · Arbitrum · Polygon', blurb: 'Stablecoin & pegged AMM' },
  { name: 'Compound', url: 'https://app.compound.finance', category: 'DeFi', chains: 'ETH · Base · Arbitrum', blurb: 'Money markets' },
  { name: 'Pendle', url: 'https://app.pendle.finance', category: 'DeFi', chains: 'ETH · Arbitrum · BSC', blurb: 'Yield trading' },
  { name: '1inch', url: 'https://app.1inch.io', category: 'Trading', chains: 'ETH · BSC · Arbitrum · Polygon', blurb: 'DEX aggregator' },
  { name: 'PancakeSwap', url: 'https://pancakeswap.finance', category: 'Trading', chains: 'BSC · ETH · Base', blurb: 'Leading BSC DEX' },
  { name: 'GMX', url: 'https://app.gmx.io', category: 'Trading', chains: 'Arbitrum · Avax', blurb: 'Perp & spot trading' },
  // Staking
  { name: 'Lido', url: 'https://stake.lido.fi', category: 'Staking', chains: 'ETH', blurb: 'Liquid ETH staking' },
  { name: 'Rocket Pool', url: 'https://stake.rocketpool.net', category: 'Staking', chains: 'ETH', blurb: 'Decentralised ETH staking' },
  { name: 'EigenLayer', url: 'https://app.eigenlayer.xyz', category: 'Staking', chains: 'ETH', blurb: 'Restaking' },
  { name: 'Jito', url: 'https://www.jito.network', category: 'Staking', chains: 'Solana', blurb: 'Liquid SOL staking (JitoSOL)' },
  // Solana
  { name: 'Jupiter', url: 'https://jup.ag', category: 'Trading', chains: 'Solana', blurb: 'Solana swap aggregator' },
  { name: 'Raydium', url: 'https://raydium.io', category: 'Trading', chains: 'Solana', blurb: 'Solana AMM & launchpad' },
  { name: 'Drift', url: 'https://app.drift.trade', category: 'Trading', chains: 'Solana', blurb: 'Solana perps' },
  { name: 'MarginFi', url: 'https://app.marginfi.com', category: 'DeFi', chains: 'Solana', blurb: 'Solana lending' },
  // NFT
  { name: 'OpenSea', url: 'https://opensea.io', category: 'NFT', chains: 'ETH · Base · Polygon', blurb: 'NFT marketplace' },
  { name: 'Blur', url: 'https://blur.io', category: 'NFT', chains: 'ETH', blurb: 'Pro NFT trading' },
  { name: 'Magic Eden', url: 'https://magiceden.io', category: 'NFT', chains: 'Solana · ETH · Base', blurb: 'Multichain NFT market' },
  { name: 'Tensor', url: 'https://www.tensor.trade', category: 'NFT', chains: 'Solana', blurb: 'Solana NFT trading' },
  // Bridge
  { name: 'Across', url: 'https://app.across.to', category: 'Bridge', chains: 'ETH · Base · Arbitrum · Optimism', blurb: 'Fast canonical bridge' },
  { name: 'Stargate', url: 'https://stargate.finance', category: 'Bridge', chains: 'ETH · BSC · Avax · Arbitrum', blurb: 'Omnichain bridge' },
  { name: 'deBridge', url: 'https://app.debridge.finance', category: 'Bridge', chains: 'ETH · Solana · BSC · Arbitrum', blurb: 'Cross-chain incl. Solana' },
  // Tools
  { name: 'DeBank', url: 'https://debank.com', category: 'Tools', chains: 'All EVM', blurb: 'Portfolio tracker' },
  { name: 'Revoke.cash', url: 'https://revoke.cash', category: 'Tools', chains: 'All EVM', blurb: 'Revoke token approvals' },
  { name: 'Etherscan', url: 'https://etherscan.io', category: 'Tools', chains: 'ETH', blurb: 'Block explorer' },
];

const CATEGORIES = ['All', 'DeFi', 'Trading', 'Staking', 'NFT', 'Bridge', 'Tools'] as const;

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function DappLogo({ dapp, size = 40 }: { dapp: Dapp; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = domainOf(dapp.url);
  if (failed || !domain) {
    return (
      <div className="rounded-xl flex items-center justify-center font-bold text-white shrink-0 bg-gradient-to-br from-[#0066FF]/40 to-[#7C3AED]/40" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {dapp.name.slice(0, 1)}
      </div>
    );
  }
  // Real favicon of the dApp — keyless, no fabricated art.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} alt={dapp.name} width={size} height={size} onError={() => setFailed(true)} className="rounded-xl shrink-0 bg-[#0f172a] object-cover" style={{ width: size, height: size }} />;
}

export function DappDirectory({ solanaAddress }: { solanaAddress?: string | null }) {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('All');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return DAPPS.filter((d) =>
      (cat === 'All' || d.category === cat) &&
      (!query || d.name.toLowerCase().includes(query) || d.blurb.toLowerCase().includes(query) || d.chains.toLowerCase().includes(query)),
    );
  }, [cat, q]);

  return (
    <div className="space-y-3">
      {solanaAddress && <StakingPositions solanaAddress={solanaAddress} />}
      <div className="flex items-center gap-2 bg-[#060A12] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0066FF]/40 transition-colors">
        <Search className="w-4 h-4 text-gray-600 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dApps"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600 text-white"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              cat === c ? 'bg-[#0066FF]/20 text-[#8FA3FF] border border-[#0066FF]/40' : 'bg-white/[0.04] text-slate-400 border border-white/10 hover:text-white'
            }`}
          >{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((d) => (
          <a
            key={d.name}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl nl-glass p-3 hover:border-[#0066FF]/30 transition-colors"
          >
            <DappLogo dapp={d} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white text-sm truncate">{d.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 shrink-0">{d.category}</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">{d.blurb}</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{d.chains}</div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-[#8FA3FF] shrink-0" />
          </a>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center text-xs text-slate-500 py-8">No dApps match your search.</p>}
      <p className="text-[10px] text-slate-600 text-center pt-1">Opens the official dApp in a new tab. Connect there with your wallet.</p>
    </div>
  );
}
