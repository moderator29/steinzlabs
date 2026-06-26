/**
 * HeroSigil · the giant cult sigil at the top of /naka-cult.
 *
 * Inline SVG: octagonal mask + concentric rings + central diamond, gold-on-
 * crimson gradient with electric-blue accent edges. Same family as the wax
 * seal in the Oracle (Daily Seal) but dialed up for hero scale.
 */
export function HeroSigil({ size = 200 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id="hs-core" cx="40%" cy="35%" r="70%">
          <stop offset="0%"   stopColor="#FF6E8A" />
          <stop offset="55%"  stopColor="#DC143C" />
          <stop offset="100%" stopColor="#3A050F" />
        </radialGradient>
        <linearGradient id="hs-edge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#00C8FF" />
          <stop offset="100%" stopColor="#0066FF" />
        </linearGradient>
        <linearGradient id="hs-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFE89A" />
          <stop offset="100%" stopColor="#FFD86B" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="none" stroke="url(#hs-edge)" strokeWidth="1.4" opacity="0.6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="url(#hs-edge)" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.5" />

      <circle cx="100" cy="100" r="68" fill="url(#hs-core)" />

      <polygon points="100,38 138,58 158,100 138,142 100,162 62,142 42,100 62,58"
        fill="none" stroke="url(#hs-gold)" strokeWidth="1.8" />
      <polygon points="100,52 128,66 142,100 128,134 100,148 72,134 58,100 72,66"
        fill="none" stroke="url(#hs-gold)" strokeWidth="1" opacity="0.7" />

      <polygon points="100,72 128,100 100,128 72,100" fill="none" stroke="url(#hs-gold)" strokeWidth="1.4" />

      <circle cx="100" cy="100" r="6" fill="url(#hs-gold)" />
      <circle cx="100" cy="100" r="2.4" fill="#FFFFFF" />
    </svg>
  );
}
