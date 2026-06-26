'use client';
import { motion } from 'framer-motion';

interface Props {
  username: string;
  /** Equipped `title` cosmetic label, or 'Cultist' when nothing is equipped. */
  rank?: string;
  /** Accent colour from the equipped glow/frame/sigil cosmetic, if any. */
  accentColor?: string | null;
}

/**
 * Member identity strip across the top of the Vault. Shows the cult member's
 * username, their rank, and the cult sigil mark. When the member has equipped a
 * loadout in the Sanctum, the rank reflects their equipped title and the strip
 * picks up the cosmetic's accent colour · so worn identity actually appears
 * (the loadout used to be write-only). Always-visible inside Vault routes. (The
 * retired Chosen lineage no longer applies.)
 */
export function IdentityStrip({ username, rank = 'Cultist', accentColor }: Props) {
  const accent = accentColor || null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="vault-identity"
      style={accent ? { borderColor: `${accent}73`, boxShadow: `0 4px 24px ${accent}40` } : undefined}
    >
      <span className="vault-identity__sigil" aria-hidden="true">◈</span>
      <span className="vault-identity__name">{username || 'Cultist'}</span>
      <span className="vault-identity__divider" aria-hidden="true">·</span>
      <span className="vault-identity__rank" style={accent ? { color: accent } : undefined}>{rank}</span>
    </motion.div>
  );
}
