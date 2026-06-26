import { ConvictionPanel } from '@/components/vault/commons/ConvictionPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conviction Board · Naka Cult' };

export default function ConvictionPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4C0E0]">The Commons</p>
        <h1 className="mt-2 text-[clamp(24px,3.5vw,36px)] font-bold text-white">Conviction Board</h1>
        <p className="mt-2 text-sm text-[#8C9AC0]">Put your calls on record. Scored on what actually happens · reputation that sticks to your sigil.</p>
      </header>
      <ConvictionPanel />
    </div>
  );
}
