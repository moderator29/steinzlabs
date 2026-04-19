import { Rocket, Wallet, BarChart3, Users } from 'lucide-react';

// User-facing roadmap. Every item listed here is already scoped in the
// codebase but not yet exposed on the frontend — this is the "Coming Soon"
// disclosure the product team wants live on the docs page.

interface RoadmapGroup {
  id: string;
  icon: typeof Wallet;
  title: string;
  items: Array<{ name: string; desc: string }>;
}

const GROUPS: RoadmapGroup[] = [
  {
    id: 'roadmap-wallet',
    icon: Wallet,
    title: 'Naka Wallet upgrades',
    items: [
      { name: 'Watchlist tab', desc: 'A dedicated tab inside the wallet for tokens you track but do not yet hold.' },
      { name: 'NFT tab', desc: 'Multi-chain NFT gallery with floor-price and rarity at a glance.' },
      { name: 'dApp browser', desc: 'In-wallet connection to DeFi apps with permission review and a kill switch.' },
      { name: 'Scan QR', desc: 'Scan any payment address directly from the wallet header.' },
      { name: 'Biometric unlock', desc: 'Face ID / Touch ID for wallet actions on mobile browsers that support it.' },
      { name: 'Manage crypto', desc: 'Toggle which tokens show up in the list and pin your favourites.' },
    ],
  },
  {
    id: 'roadmap-trading',
    icon: BarChart3,
    title: 'Advanced trading',
    items: [
      { name: 'DCA bots', desc: 'Schedule recurring buys of any token across any chain we support.' },
      { name: 'Take-profit ladders', desc: 'Multi-step profit taking on a single position without manually placing each order.' },
      { name: 'Cross-chain swap routing', desc: 'Bridge + swap in a single click when the best price lives on another chain.' },
      { name: 'Trading competitions', desc: 'Tier-gated leaderboards for weekly P&L competitions.' },
    ],
  },
  {
    id: 'roadmap-social',
    icon: Users,
    title: 'Social & sharing',
    items: [
      { name: 'Share cards', desc: 'One-click shareable PNGs of your DNA report, a whale move, or a Trust Score.' },
      { name: 'Follow & feed', desc: 'Follow other users and see a feed of their verified on-chain activity.' },
      { name: 'Comment threads', desc: 'Discuss any token directly from its Intelligence page.' },
      { name: 'Verified handles', desc: 'Tier badges + a unique @handle so your reputation is portable.' },
    ],
  },
];

export function DocsSection12() {
  return (
    <section id="coming-soon" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">12</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Coming Soon</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        Features on the build list. Order and timing can shift based on what the
        community asks for — if you want to vote, drop your pick in the Naka
        Labs community channel.
      </p>

      <div className="space-y-6">
        {GROUPS.map(({ id, icon: Icon, title, items }) => (
          <div id={id} key={id} className="scroll-mt-20 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-[#4D6BFF]" />
              </div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <ul className="space-y-2.5">
              {items.map((item) => (
                <li key={item.name} className="flex items-start gap-3">
                  <Rocket className="w-3.5 h-3.5 text-[#4D6BFF] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-white">{item.name}</div>
                    <div className="text-xs text-gray-400 leading-relaxed mt-0.5">{item.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
