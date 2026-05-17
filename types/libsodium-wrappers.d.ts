/**
 * Minimal ambient type shim for libsodium-wrappers.
 *
 * @types/libsodium-wrappers is declared in package.json but isn't always
 * resolved on lockfile drift (CI sees the runtime package but not the
 * @types). Rather than fail the build for that race, this shim exposes
 * just the surface lib/social/encryption.ts uses. Replace with the
 * upstream @types when the install settles.
 */
declare module 'libsodium-wrappers' {
  const sodium: {
    ready: Promise<void>;
    crypto_box_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array; keyType: string };
    crypto_box_easy(message: Uint8Array | string, nonce: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
    crypto_box_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
    crypto_secretbox_easy(message: Uint8Array | string, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    crypto_secretbox_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    crypto_secretbox_keygen(): Uint8Array;
    crypto_box_seal(message: Uint8Array | string, publicKey: Uint8Array): Uint8Array;
    crypto_box_seal_open(ciphertext: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
    randombytes_buf(length: number): Uint8Array;
    from_base64(input: string, variant?: number): Uint8Array;
    to_base64(input: Uint8Array, variant?: number): string;
    from_string(input: string): Uint8Array;
    to_string(input: Uint8Array): string;
    crypto_box_NONCEBYTES: number;
    crypto_secretbox_NONCEBYTES: number;
    crypto_secretbox_KEYBYTES: number;
    base64_variants: { ORIGINAL: number; URLSAFE_NO_PADDING: number };
  };
  export default sodium;
}
