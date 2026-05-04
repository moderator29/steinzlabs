import { AuroraBackground } from '@/components/brand/AuroraBackground';
import * as CultIcons from '@/components/icons/cult';

export const metadata = { title: 'Brand · Steinz Labs', robots: { index: false } };

const ICONS = [
  ['Dashboard', CultIcons.Dashboard],
  ['Search',    CultIcons.Search],
  ['Bell',      CultIcons.Bell],
  ['User',      CultIcons.User],
  ['Settings',  CultIcons.Settings],
  ['Menu',      CultIcons.Menu],
  ['X',         CultIcons.X],
  ['Wallet',    CultIcons.Wallet],
  ['Coin',      CultIcons.Coin],
  ['TrendingUp',   CultIcons.TrendingUp],
  ['TrendingDown', CultIcons.TrendingDown],
  ['ChartBar',     CultIcons.ChartBar],
  ['ChartCandle',  CultIcons.ChartCandle],
  ['Sigil',     CultIcons.Sigil],
  ['Vault',     CultIcons.Vault],
  ['Crown',     CultIcons.Crown],
  ['Shield',    CultIcons.Shield],
  ['CheckCircle', CultIcons.CheckCircle],
  ['XCircle',     CultIcons.XCircle],
  ['Loader',    CultIcons.Loader],
  ['Eye',       CultIcons.Eye],
  ['Activity',  CultIcons.Activity],
  ['Whale',     CultIcons.Whale],
  ['Sparkle',   CultIcons.Sparkle],
] as const;

const SWATCHES: { label: string; cssVar: string }[] = [
  { label: 'Canvas',         cssVar: 'var(--cult-canvas-base)' },
  { label: 'Canvas Deep',    cssVar: 'var(--cult-canvas-deep)' },
  { label: 'Canvas Elev',    cssVar: 'var(--cult-canvas-elev)' },
  { label: 'Blue',           cssVar: 'var(--cult-blue)' },
  { label: 'Blue Ice',       cssVar: 'var(--cult-blue-ice)' },
  { label: 'Blue Deep',      cssVar: 'var(--cult-blue-deep)' },
  { label: 'Crimson',        cssVar: 'var(--cult-crimson)' },
  { label: 'Crimson Hot',    cssVar: 'var(--cult-crimson-hot)' },
  { label: 'Gold (Chosen)',  cssVar: 'var(--cult-gold)' },
];

const GRADIENTS: { label: string; cssVar: string }[] = [
  { label: 'Blue → Crimson (signature)', cssVar: 'var(--cult-grad-bluecrimson)' },
  { label: 'Rocket (purple-pink-blue)',  cssVar: 'var(--cult-grad-rocket)' },
  { label: 'Helmet (deep blue)',         cssVar: 'var(--cult-grad-helmet)' },
  { label: 'Pentagon (electric)',        cssVar: 'var(--cult-grad-pentagon)' },
];

export default function BrandPage() {
  return (
    <AuroraBackground fullHeight>
      <div className="mx-auto max-w-6xl px-6 py-16 text-white">
        <header className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#00C8FF] mb-2">Internal · Brand Preview</p>
          <h1 className="text-4xl font-bold tracking-tight">Naka Cult Brand System</h1>
          <p className="mt-3 text-[15px] text-[#B4C0E0] max-w-2xl">
            Single-page reference for the cinematic visual layer. Tokens, primitives, and the starter icon set anchored to the
            W &quot;REDEFINING THE WEB3 SPACE&quot; reference image (rocket / helmet / pentagon).
          </p>
        </header>

        <Section title="Color tokens">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {SWATCHES.map(s => (
              <div key={s.label} className="cult-card p-3">
                <div className="h-14 rounded-lg mb-2 border border-white/10" style={{ background: s.cssVar }} />
                <div className="text-[12px] font-semibold">{s.label}</div>
                <code className="text-[10px] text-[#B4C0E0]">{s.cssVar}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Gradients">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GRADIENTS.map(g => (
              <div key={g.label} className="cult-card p-3">
                <div className="h-20 rounded-lg mb-2 border border-white/10" style={{ background: g.cssVar }} />
                <div className="text-[13px] font-semibold">{g.label}</div>
                <code className="text-[10px] text-[#B4C0E0]">{g.cssVar}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Primitives">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="cult-card p-6">
              <div className="text-[11px] uppercase tracking-wider text-[#B4C0E0] mb-3">.cult-card</div>
              <p className="text-[14px] text-[#D5DEFF]">Hover to see the gradient halo activate. Backdrop-blur + faint inner luminance match the rocket frame from the reference.</p>
            </div>
            <div className="cult-card cult-card--featured p-6">
              <div className="text-[11px] uppercase tracking-wider text-[#FFD86B] mb-3">.cult-card--featured</div>
              <p className="text-[14px] text-[#D5DEFF]">Featured variant has the gradient halo on by default — use for hero / highlighted items.</p>
            </div>
            <div className="cult-card p-6 flex flex-col items-start gap-4">
              <div className="text-[11px] uppercase tracking-wider text-[#B4C0E0]">.cult-button</div>
              <button type="button" className="cult-button">Primary</button>
              <button type="button" className="cult-button cult-button--ghost">Ghost</button>
              <button type="button" className="cult-button" disabled>Disabled</button>
              <div className="text-[11px] uppercase tracking-wider text-[#B4C0E0] mt-2">.cult-loader</div>
              <div className="cult-loader" aria-label="loading" />
            </div>
          </div>
        </Section>

        <Section title={`Icon library (${ICONS.length} icons — starter set)`}>
          <p className="text-[13px] text-[#B4C0E0] mb-4 max-w-2xl">
            Each icon mirrors the lucide-react name so the platform-wide ascension is a mechanical import swap. Variants:{' '}
            <code className="text-[#00C8FF]">blue</code>, <code className="text-[#FF6E8A]">crimson</code>,{' '}
            <code className="text-[#B07BFF]">rocket</code>, <code className="text-[#00C8FF]">pentagon</code>,{' '}
            <code className="text-[#FFD86B]">gold</code>.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {ICONS.map(([name, Icon]) => (
              <div key={name} className="cult-card p-4 flex flex-col items-center gap-2">
                <Icon size={32} />
                <code className="text-[10px] text-[#B4C0E0] truncate w-full text-center">{name}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Variant grid (Sigil)">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(['blue', 'crimson', 'rocket', 'pentagon', 'gold'] as const).map(v => (
              <div key={v} className="cult-card p-4 flex flex-col items-center gap-2">
                <CultIcons.Sigil size={48} variant={v} />
                <code className="text-[11px] text-[#B4C0E0]">variant=&quot;{v}&quot;</code>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AuroraBackground>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-[#00C8FF] mb-4">{title}</h2>
      {children}
    </section>
  );
}
