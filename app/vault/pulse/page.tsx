import { PulsePanel } from '@/components/vault/commons/PulsePanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Signal Pulse — Naka Cult' };

export default function PulsePage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4C0E0]">The Commons</p>
        <h1 className="mt-2 text-[clamp(24px,3.5vw,36px)] font-bold text-white">Signal Pulse</h1>
        <p className="mt-2 text-sm text-[#8C9AC0]">A cult-only stream of on-chain signals. Members see them before they reach the public feed.</p>
      </header>
      <PulsePanel />
    </div>
  );
}
