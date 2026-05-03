import Link from 'next/link';
import { SanctumSigil } from '@/components/vault/sigils/SanctumSigil';

export const metadata = { title: 'The Sanctum — Vault — Naka Labs' };

export default function SanctumPage() {
  return (
    <section className="vault-coming-soon">
      <SanctumSigil size={120} />
      <h1 className="vault-coming-soon__title">The Sanctum</h1>
      <p className="vault-coming-soon__sub">
        Identity, achievements, lore, music, the Forge. Soul chamber — opening with the next pass.
      </p>
      <Link href="/vault" className="naka-button-primary">← Back to the Vault</Link>
    </section>
  );
}
