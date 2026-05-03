import Link from 'next/link';
import { ConclaveSigil } from '@/components/vault/sigils/ConclaveSigil';

export const metadata = { title: 'The Conclave — Vault — Naka Labs' };

export default function ConclavePage() {
  return (
    <section className="vault-coming-soon">
      <ConclaveSigil size={120} />
      <h1 className="vault-coming-soon__title">The Conclave</h1>
      <p className="vault-coming-soon__sub">
        Decrees, Whispers, the treasury, the vote orbs. Opening soon — the next chamber pass adds proposal authoring, the live vote bar, and the Codex of passed decrees.
      </p>
      <Link href="/vault" className="naka-button-primary">← Back to the Vault</Link>
    </section>
  );
}
