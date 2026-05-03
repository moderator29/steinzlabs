'use client';
import { motion } from 'framer-motion';

interface Props {
  username: string;
  isChosen: boolean;
}

/**
 * Member identity strip across the top of the Vault. Shows the cult
 * member's username, their tier badge ("Cultist" / "Chosen"), and the
 * cult sigil mark. Always-visible inside Vault routes.
 *
 * The Chosen-only members get a gold trim; standard cultists get the
 * blue trim.
 */
export function IdentityStrip({ username, isChosen }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`vault-identity ${isChosen ? 'vault-identity--chosen' : ''}`}
    >
      <span className="vault-identity__sigil" aria-hidden="true">◈</span>
      <span className="vault-identity__name">{username || 'Cultist'}</span>
      <span className="vault-identity__divider" aria-hidden="true">·</span>
      <span className="vault-identity__rank">{isChosen ? 'Chosen' : 'Cultist'}</span>
    </motion.div>
  );
}
