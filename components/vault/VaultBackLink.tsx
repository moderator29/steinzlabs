import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Consistent "back to the Vault" link for every chamber/feature. Several
 * chambers (Oracle, Sanctum, Ape, Hall, Conviction, Offering, Pulse) shipped
 * with no way back except the browser button; this gives them all the same
 * explicit control the Conclave already had.
 */
export function VaultBackLink({
  href = '/vault',
  label = 'Back to the Vault',
  className = '',
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 text-[13px] font-semibold text-[#9FB0D8] transition hover:text-white ${className}`}
    >
      <ArrowLeft size={15} /> {label}
    </Link>
  );
}
