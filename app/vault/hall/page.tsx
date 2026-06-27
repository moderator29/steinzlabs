import { HallPanel } from '@/components/vault/commons/HallPanel';
import { VaultBackLink } from '@/components/vault/VaultBackLink';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Hall · Naka Cult' };

export default function HallPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <VaultBackLink className="mb-5" />
      <header className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4C0E0]">The Commons</p>
        <h1 className="mt-2 text-[clamp(24px,3.5vw,36px)] font-bold text-white">The Hall</h1>
        <p className="mt-2 text-sm text-[#8C9AC0]">Where the cult speaks in real time. Identity-based · your Mantle shows.</p>
      </header>
      <HallPanel />
    </div>
  );
}
