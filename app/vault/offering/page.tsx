import { OfferingPanel } from '@/components/vault/commons/OfferingPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Offering — Naka Cult' };

export default function OfferingPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4C0E0]">The Commons</p>
        <h1 className="mt-2 text-[clamp(24px,3.5vw,36px)] font-bold text-white">The Offering</h1>
        <p className="mt-2 text-sm text-[#8C9AC0]">Treasury-funded raffles and rewards. One entry per member; the cult shares its spoils.</p>
      </header>
      <OfferingPanel />
    </div>
  );
}
