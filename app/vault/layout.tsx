import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCultAccess } from '@/lib/cult/access';
import { IdentityStrip } from '@/components/vault/IdentityStrip';
import './vault.css';

export const dynamic = 'force-dynamic';

/**
 * Vault root layout. Gates every /vault route on cult access.
 * Non-members are bounced to /naka-cult (the dramatic landing). The
 * gate runs server-side via getCultAccess() so the chamber HTML never
 * ships to non-members.
 */
export default async function VaultLayout({ children }: { children: ReactNode }) {
  const access = await getCultAccess();
  if (!access.allowed) {
    // /naka-cult is shipped in Phase 8 (dramatic landing). Until then
    // /dashboard is a sane fallback so the redirect never 404s.
    redirect('/dashboard?denied=cult');
  }

  return (
    <div className="vault-shell">
      <header className="vault-header">
        <IdentityStrip
          username={access.displayName ?? access.username ?? 'Cultist'}
          isChosen={access.isChosen}
        />
      </header>
      <main className="vault-main">{children}</main>
    </div>
  );
}
