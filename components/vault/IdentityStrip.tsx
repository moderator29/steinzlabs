'use client';
import { motion } from 'framer-motion';

interface Props {
  username: string;
}

/**
 * Member identity strip across the top of the Vault. Shows the cult member's
 * username, the "Cultist" rank, and the cult sigil mark. Always-visible inside
 * Vault routes. (The retired Chosen lineage no longer applies — every member
 * carries the same standard cult identity.)
 */
export function IdentityStrip({ username }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="vault-identity"
    >
      <span className="vault-identity__sigil" aria-hidden="true">◈</span>
      <span className="vault-identity__name">{username || 'Cultist'}</span>
      <span className="vault-identity__divider" aria-hidden="true">·</span>
      <span className="vault-identity__rank">Cultist</span>
    </motion.div>
  );
}
