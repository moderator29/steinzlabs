import { toHex } from 'viem';

/**
 * Shared EVM SIWE signing helper for every wallet-connect auth entry point
 * (login/signup buttons, Enter-NakaCult, etc.) so they all get the same
 * resilient behavior.
 *
 * Why the fallback exists: wagmi's signMessage normally routes personal_sign to
 * the connected wallet, but some WalletConnect sessions (seen on mobile) surface
 * it as "personal_sign does not exist / is not available / method not found"
 * (JSON-RPC -32601) — the signature of the request being routed to a public RPC
 * node, which doesn't implement wallet methods. On that specific failure we
 * retry against the connector's OWN EIP-1193 provider, which always targets the
 * wallet, never a node. The injected/desktop path is unaffected (wagmi stays the
 * primary route; the fallback only fires on the -32601-class error).
 */

/** Minimal EIP-1193 surface for the raw personal_sign fallback. */
interface Eip1193 { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; }
/** Minimal wagmi connector surface. */
interface ConnectorLike { getProvider?: () => Promise<unknown> }
/** wagmi's signMessageAsync, narrowed to what we call. */
type SignMessageAsync = (args: { message: string; account?: `0x${string}` }) => Promise<`0x${string}`>;

/** True when an error looks like "personal_sign isn't available" (-32601 /
 *  viem MethodNotFound), i.e. the request was misrouted away from the wallet. */
export function isMethodNotFound(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return m.includes('method not found')
    || m.includes('does not exist')
    || m.includes('is not available')
    || m.includes('-32601');
}

/**
 * Sign a SIWE message: wagmi first, then the connector's raw provider on a
 * method-not-found failure. Returns the 0x signature.
 */
export async function signSiweMessage(opts: {
  signMessageAsync: SignMessageAsync;
  connector: ConnectorLike | null | undefined;
  message: string;
  address: `0x${string}`;
}): Promise<`0x${string}`> {
  const { signMessageAsync, connector, message, address } = opts;
  try {
    return await signMessageAsync({ message, account: address });
  } catch (err) {
    if (!isMethodNotFound(err) || !connector?.getProvider) throw err;
    const provider = (await connector.getProvider()) as Eip1193 | undefined;
    if (!provider?.request) throw err;
    // personal_sign params are [hexMessage, address].
    const sig = await provider.request({ method: 'personal_sign', params: [toHex(message), address] });
    if (typeof sig !== 'string' || !sig.startsWith('0x')) throw err;
    return sig as `0x${string}`;
  }
}

/**
 * Establish the Supabase session after /api/auth/wallet-verify succeeds, then
 * navigate into the app.
 *
 * Preferred path: exchange the hashed_token for a session IN PLACE via
 * verifyOtp — no navigation to the Supabase action_link. The action_link
 * round-trip (browser → project.supabase.co → back) drops the session in mobile
 * in-app browsers (Trust/MetaMask webview), so /auth/callback times out and
 * bounces the user to the email login screen. verifyOtp sets the session on the
 * current origin's client directly, so we can hard-navigate straight to the app.
 * Falls back to the action_link only if the token exchange is unavailable.
 */
export async function finishWalletSession(opts: {
  tokenHash?: string | null;
  actionLink?: string | null;
  redirectTo: string;
}): Promise<void> {
  const { tokenHash, actionLink, redirectTo } = opts;
  if (tokenHash) {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    if (!error && data?.session) {
      // Hard navigation so the middleware/session cookie is picked up fresh.
      window.location.href = redirectTo;
      return;
    }
  }
  if (actionLink) {
    window.location.href = actionLink;
    return;
  }
  throw new Error('Could not establish your session. Please try again.');
}
