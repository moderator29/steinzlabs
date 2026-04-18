/**
 * Built-in Steinz wallet signing is INTENTIONALLY NOT IMPLEMENTED server-side.
 *
 * Naka Labs is non-custodial by product, legal, and trust design:
 *   • Built-in wallet private keys are AES-256-GCM encrypted in the BROWSER and
 *     NEVER leave the user's device.
 *   • The platform has no access to user private keys and cannot, by design,
 *     sign transactions on behalf of users.
 *
 * Automated triggers (limit orders, DCA, stop-loss, copy-trade) therefore use a
 * "pending trade" confirmation flow: the monitor cron detects the trigger, the
 * relayer records a pending_trades row + notifies the user, and the user
 * confirms in-app where the browser signs with their decrypted built-in key
 * (or with MetaMask / Phantom for external wallets).
 *
 * Any future contributor tempted to wire server-side signing here should stop
 * and raise a product/security review first. This is not a TODO.
 */

export class BuiltinAutoSigningNotSupported extends Error {
  constructor() {
    super(
      "Built-in wallet auto-signing is not supported. Naka Labs is non-custodial — " +
      "signing must happen client-side via the pending_trades confirmation flow.",
    );
    this.name = "BuiltinAutoSigningNotSupported";
  }
}

export function signWithBuiltinWallet(): never {
  throw new BuiltinAutoSigningNotSupported();
}
