import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConclaveSigil } from '@/components/vault/sigils/ConclaveSigil';
import { TreasuryPanel } from './TreasuryPanel';
import { ConclaveClient } from './ConclaveClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Conclave — Vault — Naka Labs' };

export default function ConclavePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pt-8 pb-4 text-center">
        <ConclaveSigil size={84} className="mx-auto mb-3" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00C8FF]">
          THE CONCLAVE
        </p>
        <h1 className="mt-2 text-[clamp(28px,4vw,40px)] font-bold leading-tight text-white"
            style={{ textShadow: '0 0 36px rgba(0, 153, 255, 0.4)' }}>
          The cult decides.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#B4C0E0]">
          Author Decrees. Cast votes. Hold the treasury. Every passed Decree shapes the platform.
        </p>
        <div className="mt-5">
          <Link href="/vault" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#B4C0E0] hover:text-white transition">
            <ArrowLeft size={14} /> Back to the Vault
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5">
        <TreasuryPanel />
      </div>

      <ConclaveClient />
    </>
  );
}
