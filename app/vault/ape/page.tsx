import { ApePanel } from '@/components/vault/commons/ApePanel';
import { VaultBackLink } from '@/components/vault/VaultBackLink';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ape or Nope · Naka Cult' };

export default function ApePage() {
  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <VaultBackLink className="mb-5" />
      <header className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4C0E0]">The Commons</p>
        <h1 className="mt-2 text-[clamp(24px,3.5vw,36px)] font-bold text-white">Ape or Nope 🚀💀</h1>
        <p className="mt-2 text-sm text-[#8C9AC0]">
          A trending coin a day. Call it · pump or dump in 24h. Build your streak, climb the cult.
        </p>
      </header>
      <ApePanel />
    </div>
  );
}
