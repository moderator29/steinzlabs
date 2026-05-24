/**
 * Defense-in-depth sanitizer for decrypted DM body text before render.
 *
 * React already escapes JSX text expressions, so there is no innerHTML
 * XSS risk on the DM thread. This pass exists to neutralise:
 *  - C0 / C1 control chars (\x00-\x1F, \x7F-\x9F) that break layout
 *  - bidi overrides (U+200E-U+200F, U+202A-U+202E, U+2066-U+2069)
 *    used in homograph / Trojan-Source attacks
 *  - zero-width spaces / joiners (U+200B-U+200D)
 *  - byte-order mark (U+FEFF)
 *  - line / paragraph separators (U+2028, U+2029)
 */
// eslint-disable-next-line no-control-regex
const CONTROL_RE = new RegExp(
  "[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]",
  "g",
);

export function sanitizeMessageBody(input: unknown): string {
  if (input == null) return "";
  return String(input).replace(CONTROL_RE, "");
}
