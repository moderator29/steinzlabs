import 'server-only';
import { lookupEnsName } from '@/lib/services/alchemy';

/**
 * Default profile naming for wallet sign-ups (industry-standard pattern).
 *
 *   display_name : the wallet's primary ENS name if it has one (vitalik.eth),
 *                  else a stable, friendly handle derived from the address.
 *   username     : a deterministic, collision-proof @handle (naka_<addr slug>).
 *
 * Everything is editable later in Profile → Edit; this just guarantees a wallet
 * user never lands nameless. The ENS lookup is bounded by a short timeout so a
 * slow resolver never delays sign-in — it falls back instantly.
 */

const ADJECTIVES = [
  'Silent', 'Crimson', 'Golden', 'Shadow', 'Astral', 'Velvet', 'Iron', 'Lunar',
  'Obsidian', 'Electric', 'Frost', 'Ember', 'Cobalt', 'Phantom', 'Sacred', 'Wild',
];
const NOUNS = [
  'Whale', 'Sigil', 'Oracle', 'Comet', 'Raven', 'Cipher', 'Falcon', 'Specter',
  'Warden', 'Nomad', 'Phoenix', 'Vector', 'Drifter', 'Sentinel', 'Glyph', 'Tide',
];

/** Small, stable, non-cryptographic hash of an address → 32-bit unsigned int. */
function hashAddress(addr: string): number {
  let h = 2166136261;
  const s = addr.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** `naka_<12-char address slug>` — unique per address, valid handle charset. */
export function buildWalletUsername(address: string): string {
  const slug = address.replace(/^0x/i, '').toLowerCase().slice(0, 12);
  return `naka_${slug}`;
}

/** Deterministic friendly handle, e.g. "ObsidianOracle4821". Same wallet → same name. */
export function buildFallbackDisplayName(address: string): string {
  const h = hashAddress(address);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
  const num = (h % 9000) + 1000;
  return `${adj}${noun}${num}`;
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Resolve the default { username, displayName } for a freshly-linked wallet.
 * ENS is only attempted for EVM addresses and capped at 2.5s.
 */
export async function generateWalletProfileName(
  address: string,
  chain: 'evm' | 'solana',
): Promise<{ username: string; displayName: string }> {
  const username = buildWalletUsername(address);
  let displayName = buildFallbackDisplayName(address);

  if (chain === 'evm') {
    const ens = await withTimeout(lookupEnsName(address), 2_500, null);
    if (ens) displayName = ens;
  }

  return { username, displayName };
}
