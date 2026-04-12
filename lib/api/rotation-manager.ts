import 'server-only';

/**
 * API Key Rotation Manager
 * Cycles through multiple keys round-robin, skipping any that hit rate limits.
 * Used by Helius (2 keys) and LunarCrush (4 keys).
 */

export class ApiKeyRotationManager {
  private keys: string[];
  private currentIndex: number = 0;
  private rateLimitedUntil: Map<string, number> = new Map();

  constructor(keys: string[]) {
    this.keys = keys.filter(Boolean);
    if (this.keys.length === 0) {
      throw new Error('ApiKeyRotationManager: no valid keys provided');
    }
  }

  getNextKey(): string {
    const now = Date.now();
    const total = this.keys.length;

    // Try each key starting from current index
    for (let i = 0; i < total; i++) {
      const idx = (this.currentIndex + i) % total;
      const key = this.keys[idx];
      const blockedUntil = this.rateLimitedUntil.get(key) ?? 0;

      if (now >= blockedUntil) {
        // Advance index so next call picks the one after this
        this.currentIndex = (idx + 1) % total;
        return key;
      }
    }

    // All keys are rate-limited — find the one that recovers soonest
    let soonest = Infinity;
    for (const key of this.keys) {
      const until = this.rateLimitedUntil.get(key) ?? 0;
      if (until < soonest) soonest = until;
    }
    const retryAfterMs = soonest - now;
    throw new RateLimitError(
      `All API keys are rate-limited. Retry in ${Math.ceil(retryAfterMs / 1000)}s`,
      retryAfterMs
    );
  }

  markRateLimited(key: string, retryAfterMs: number = 60_000): void {
    this.rateLimitedUntil.set(key, Date.now() + retryAfterMs);
  }

  /** How many keys are currently available (not rate-limited) */
  availableKeyCount(): number {
    const now = Date.now();
    return this.keys.filter(k => (this.rateLimitedUntil.get(k) ?? 0) <= now).length;
  }

  get totalKeys(): number {
    return this.keys.length;
  }
}

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

// ─── Singleton Instances ──────────────────────────────────────────────────────

function buildRotation(keys: (string | undefined)[], name: string): ApiKeyRotationManager {
  const valid = keys.filter((k): k is string => !!k && k.trim().length > 0);
  if (valid.length === 0) {
    // Return a dummy manager that always throws — prevents startup crash
    // when keys are not yet configured
    return new ApiKeyRotationManager(['placeholder']);
  }
  return new ApiKeyRotationManager(valid);
}

export const heliusRotation = buildRotation(
  [process.env.HELIUS_API_KEY_1, process.env.HELIUS_API_KEY_2],
  'Helius'
);

export const lunarCrushRotation = buildRotation(
  [
    process.env.LUNARCRUSH_API_1,
    process.env.LUNARCRUSH_API_2,
    process.env.LUNARCRUSH_API_3,
    process.env.LUNARCRUSH_API_4,
  ],
  'LunarCrush'
);
