import { AuroraBackground } from '@/components/brand/AuroraBackground';
import * as BrandIcons from '@/components/icons/brand';

export const metadata = { title: 'Brand · Naka Labs', robots: { index: false } };

const ICONS = [
  // Starter (Phase 2)
  ['Dashboard', BrandIcons.Dashboard],
  ['Search',    BrandIcons.Search],
  ['Bell',      BrandIcons.Bell],
  ['User',      BrandIcons.User],
  ['Settings',  BrandIcons.Settings],
  ['Menu',      BrandIcons.Menu],
  ['X',         BrandIcons.X],
  ['Wallet',    BrandIcons.Wallet],
  ['Coin',      BrandIcons.Coin],
  ['TrendingUp',   BrandIcons.TrendingUp],
  ['TrendingDown', BrandIcons.TrendingDown],
  ['ChartBar',     BrandIcons.ChartBar],
  ['ChartCandle',  BrandIcons.ChartCandle],
  ['Sigil',     BrandIcons.Sigil],
  ['Vault',     BrandIcons.Vault],
  ['Crown',     BrandIcons.Crown],
  ['Shield',    BrandIcons.Shield],
  ['CheckCircle', BrandIcons.CheckCircle],
  ['XCircle',     BrandIcons.XCircle],
  ['Loader',    BrandIcons.Loader],
  ['Eye',       BrandIcons.Eye],
  ['Activity',  BrandIcons.Activity],
  ['Whale',     BrandIcons.Whale],
  ['Sparkle',   BrandIcons.Sparkle],
  // Phase C — navigation chevrons + arrows
  ['ChevronRight', BrandIcons.ChevronRight],
  ['ChevronLeft',  BrandIcons.ChevronLeft],
  ['ChevronUp',    BrandIcons.ChevronUp],
  ['ChevronDown',  BrandIcons.ChevronDown],
  ['ArrowUp',      BrandIcons.ArrowUp],
  ['ArrowDown',    BrandIcons.ArrowDown],
  // Phase C — actions
  ['Plus',         BrandIcons.Plus],
  ['Minus',        BrandIcons.Minus],
  ['Edit',         BrandIcons.Edit],
  ['Trash2',       BrandIcons.Trash2],
  ['Save',         BrandIcons.Save],
  ['Copy',         BrandIcons.Copy],
  ['ExternalLink', BrandIcons.ExternalLink],
  ['Share',        BrandIcons.Share],
  ['Download',     BrandIcons.Download],
  ['Upload',       BrandIcons.Upload],
  ['Send',         BrandIcons.Send],
  ['RefreshCw',    BrandIcons.RefreshCw],
  ['Filter',       BrandIcons.Filter],
  ['MoreHorizontal', BrandIcons.MoreHorizontal],
  ['MoreVertical', BrandIcons.MoreVertical],
  // Phase C — feedback
  ['Info',          BrandIcons.Info],
  ['AlertCircle',   BrandIcons.AlertCircle],
  ['AlertTriangle', BrandIcons.AlertTriangle],
  ['HelpCircle',    BrandIcons.HelpCircle],
  ['Star',          BrandIcons.Star],
  ['Heart',         BrandIcons.Heart],
  ['ThumbsUp',      BrandIcons.ThumbsUp],
  ['ThumbsDown',    BrandIcons.ThumbsDown],
  // Phase C — auth / privacy
  ['Lock',   BrandIcons.Lock],
  ['Unlock', BrandIcons.Unlock],
  ['EyeOff', BrandIcons.EyeOff],
  ['LogIn',  BrandIcons.LogIn],
  ['LogOut', BrandIcons.LogOut],
  // Phase C — date / time / theme
  ['Calendar', BrandIcons.Calendar],
  ['Clock',    BrandIcons.Clock],
  ['Sun',      BrandIcons.Sun],
  ['Moon',     BrandIcons.Moon],
  // Phase C — media
  ['Play',  BrandIcons.Play],
  ['Pause', BrandIcons.Pause],
  // Phase C — comms / brand
  ['Mail',    BrandIcons.Mail],
  ['Github',  BrandIcons.Github],
  ['Twitter', BrandIcons.Twitter],
] as const;

const SWATCHES: { label: string; cssVar: string }[] = [
  { label: 'Canvas',         cssVar: 'var(--nl-canvas-base)' },
  { label: 'Canvas Deep',    cssVar: 'var(--nl-canvas-deep)' },
  { label: 'Canvas Elev',    cssVar: 'var(--nl-canvas-elev)' },
  { label: 'Blue',           cssVar: 'var(--nl-blue)' },
  { label: 'Blue Ice',       cssVar: 'var(--nl-blue-ice)' },
  { label: 'Blue Deep',      cssVar: 'var(--nl-blue-deep)' },
  { label: 'Crimson',        cssVar: 'var(--nl-crimson)' },
  { label: 'Crimson Hot',    cssVar: 'var(--nl-crimson-hot)' },
  { label: 'Gold (Chosen)',  cssVar: 'var(--nl-gold)' },
];

const GRADIENTS: { label: string; cssVar: string }[] = [
  { label: 'Blue → Crimson (signature)', cssVar: 'var(--nl-grad-bluecrimson)' },
  { label: 'Rocket (purple-pink-blue)',  cssVar: 'var(--nl-grad-rocket)' },
  { label: 'Helmet (deep blue)',         cssVar: 'var(--nl-grad-helmet)' },
  { label: 'Pentagon (electric)',        cssVar: 'var(--nl-grad-pentagon)' },
];

export default function BrandPage() {
  return (
    <AuroraBackground fullHeight>
      <div className="mx-auto max-w-6xl px-6 py-16 text-white">
        <header className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#00C8FF] mb-2">Internal · Brand Preview</p>
          <h1 className="text-4xl font-bold tracking-tight">Naka Labs Brand System</h1>
          <p className="mt-3 text-[15px] text-[#B4C0E0] max-w-2xl">
            Single-page reference for the platform-wide visual layer. Tokens, primitives, and the starter icon set anchored to the
            W &quot;REDEFINING THE WEB3 SPACE&quot; reference image (rocket / helmet / pentagon).
          </p>
        </header>

        <Section title="Color tokens">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {SWATCHES.map(s => (
              <div key={s.label} className="nl-card p-3">
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
              <div key={g.label} className="nl-card p-3">
                <div className="h-20 rounded-lg mb-2 border border-white/10" style={{ background: g.cssVar }} />
                <div className="text-[13px] font-semibold">{g.label}</div>
                <code className="text-[10px] text-[#B4C0E0]">{g.cssVar}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Primitives">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="nl-card p-6">
              <div className="text-[11px] uppercase tracking-wider text-[#B4C0E0] mb-3">.nl-card</div>
              <p className="text-[14px] text-[#D5DEFF]">Hover to see the gradient halo activate. Backdrop-blur + faint inner luminance match the rocket frame from the reference.</p>
            </div>
            <div className="nl-card nl-card--featured p-6">
              <div className="text-[11px] uppercase tracking-wider text-[#FFD86B] mb-3">.nl-card--featured</div>
              <p className="text-[14px] text-[#D5DEFF]">Featured variant has the gradient halo on by default — use for hero / highlighted items.</p>
            </div>
            <div className="nl-card p-6 flex flex-col items-start gap-4">
              <div className="text-[11px] uppercase tracking-wider text-[#B4C0E0]">.nl-button</div>
              <button type="button" className="nl-button">Primary</button>
              <button type="button" className="nl-button nl-button--ghost">Ghost</button>
              <button type="button" className="nl-button" disabled>Disabled</button>
              <div className="text-[11px] uppercase tracking-wider text-[#B4C0E0] mt-2">.nl-loader</div>
              <div className="nl-loader" aria-label="loading" />
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
              <div key={name} className="nl-card p-4 flex flex-col items-center gap-2">
                <Icon size={32} />
                <code className="text-[10px] text-[#B4C0E0] truncate w-full text-center">{name}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Variant grid (Sigil)">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(['blue', 'crimson', 'rocket', 'pentagon', 'gold'] as const).map(v => (
              <div key={v} className="nl-card p-4 flex flex-col items-center gap-2">
                <BrandIcons.Sigil size={48} variant={v} />
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
