'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Persistent in-vault chamber switcher. Until now the vault shell had only the
 * identity pill and members navigated via per-page "← back" links — there was
 * no way to move between chambers. This rail sits in the vault header on every
 * /vault route, highlights the current destination, and scrolls horizontally on
 * narrow screens so it stays usable on mobile.
 */
const LINKS: ReadonlyArray<{ href: string; label: string; exact?: boolean }> = [
  { href: '/vault', label: 'Vault', exact: true },
  { href: '/vault/conclave', label: 'Conclave' },
  { href: '/vault/oracle', label: 'Oracle' },
  { href: '/vault/sanctum', label: 'Sanctum' },
  { href: '/vault/profile', label: 'Profile' },
];

export function VaultNav() {
  const pathname = usePathname();
  return (
    <nav className="vault-nav" aria-label="Vault chambers">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch
            className={`vault-nav__link${active ? ' vault-nav__link--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
