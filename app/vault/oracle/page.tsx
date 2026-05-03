import Link from 'next/link';
import { OracleSigil } from '@/components/vault/sigils/OracleSigil';

export const metadata = { title: 'The Oracle — Vault — Naka Labs' };

export default function OraclePage() {
  return (
    <section className="vault-coming-soon">
      <OracleSigil size={120} />
      <h1 className="vault-coming-soon__title">The Oracle</h1>
      <p className="vault-coming-soon__sub">
        The Daily Seal, VTX Sage, the Whisper Network, the Echo Chamber. Sight chamber — opening with the next pass.
      </p>
      <Link href="/vault" className="naka-button-primary">← Back to the Vault</Link>
    </section>
  );
}
