/**
 * EIP-4361 (Sign-In with Ethereum) + SIWS (Sign-In with Solana) message
 * construction. Used by both /api/auth/wallet-nonce (issuer) and
 * /api/auth/wallet-verify (re-constructor) so the exact same bytes are
 * signed and verified.
 *
 * Why this matters (P0 audit finding):
 *
 * The previous message was a free-form line:
 *
 *   "Sign this message to authenticate with Naka Labs.
 *
 *    Address: 0xabc...
 *    Nonce: <hex>
 *    Expires: <iso>"
 *
 * It carried no domain, no URI, and no chainId. Without domain binding,
 * a phishing site (`fake.nakalabs.xyz`) can request the same string,
 * the wallet UI shows nothing distinguishing, and a relayed signature
 * is structurally indistinguishable from a real one. EIP-4361 fixes
 * this by making the domain + URI + chainId part of the signed
 * payload, which compliant wallets surface in their signing prompt.
 *
 * Format reference: https://eips.ethereum.org/EIPS/eip-4361
 *
 * Solana wallets (Phantom etc.) accept plain-text messages, so we use
 * an EIP-4361-shaped string with `Chain: solana` instead of a numeric
 * chainId. Phantom's SIWS RFC matches this layout closely.
 */

export interface SiweParams {
  domain: string;             // e.g. "nakalabs.xyz"
  address: string;            // canonical (EVM lower-case checksum, Solana base58)
  uri: string;                // e.g. "https://nakalabs.xyz"
  chain: 'evm' | 'solana';
  chainId?: number;           // EVM only — defaults to 1 (mainnet)
  nonce: string;
  issuedAt: string;           // ISO 8601
  expirationTime: string;     // ISO 8601
}

const STATEMENT = 'Sign in to Naka Labs.';

export function buildSiweMessage(p: SiweParams): string {
  const lines: string[] = [];

  if (p.chain === 'evm') {
    // EIP-4361 strict format. Order MUST match the spec or compliant
    // wallets reject the message.
    const cid = p.chainId ?? 1;
    lines.push(`${p.domain} wants you to sign in with your Ethereum account:`);
    lines.push(p.address);
    lines.push('');
    lines.push(STATEMENT);
    lines.push('');
    lines.push(`URI: ${p.uri}`);
    lines.push(`Version: 1`);
    lines.push(`Chain ID: ${cid}`);
    lines.push(`Nonce: ${p.nonce}`);
    lines.push(`Issued At: ${p.issuedAt}`);
    lines.push(`Expiration Time: ${p.expirationTime}`);
  } else {
    // Solana SIWS — same shape, `Chain: solana` instead of numeric ID.
    // Phantom + Backpack render plain-text messages so the user sees
    // domain + URI just like an EIP-4361 prompt on EVM.
    lines.push(`${p.domain} wants you to sign in with your Solana account:`);
    lines.push(p.address);
    lines.push('');
    lines.push(STATEMENT);
    lines.push('');
    lines.push(`URI: ${p.uri}`);
    lines.push(`Version: 1`);
    lines.push(`Chain: solana`);
    lines.push(`Nonce: ${p.nonce}`);
    lines.push(`Issued At: ${p.issuedAt}`);
    lines.push(`Expiration Time: ${p.expirationTime}`);
  }

  return lines.join('\n');
}

/**
 * Resolve the canonical site domain + URI from env. Falls back to the
 * Vercel preview URL or, if absent, the bare host header passed in.
 *
 * Centralising here means nonce-issuance and signature-verification
 * always agree on which domain string was signed, even when the same
 * verifier deploys to multiple environments (preview / prod).
 */
export function resolveSiweOrigin(reqHost: string | null | undefined): { domain: string; uri: string } {
  const envSite = process.env.NEXT_PUBLIC_SITE_URL;
  if (envSite) {
    try {
      const u = new URL(envSite);
      return { domain: u.hostname, uri: envSite.replace(/\/$/, '') };
    } catch {
      /* fall through */
    }
  }
  const fallbackHost = reqHost?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'nakalabs.xyz';
  return { domain: fallbackHost, uri: `https://${fallbackHost}` };
}
