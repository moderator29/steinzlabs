/**
 * The Wire - catalogue topic vocabulary.
 *
 * Single source of truth for both the feed catalogue filter chips and the
 * composer tag picker. `value` is the canonical lowercase tag persisted in
 * wire_posts.tags (text[]); `label` is the human chip copy. Keep these two in
 * lockstep - the API validates incoming tags against WIRE_TOPIC_SET.
 *
 * "All" is NOT a topic - it is the no-filter pseudo-chip rendered by the UI and
 * simply omits the `tag` query param.
 */

export interface WireTopic {
  /** Canonical lowercase value stored in wire_posts.tags. */
  value: string;
  /** Chip / picker label shown to users. */
  label: string;
}

export const WIRE_TOPICS: WireTopic[] = [
  { value: 'new', label: 'New' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'rwa', label: 'RWA' },
  { value: 'ai', label: 'AI' },
  { value: 'agi', label: 'AGI' },
  { value: 'blockchain', label: 'Blockchain' },
  { value: 'solana', label: 'SOL' },
  { value: 'eth', label: 'ETH' },
  { value: 'bnb', label: 'BNB' },
  { value: 'prediction', label: 'Prediction' },
  { value: 'memes', label: 'Memes' },
];

/** Canonical values in catalogue order. */
export const WIRE_TOPIC_VALUES = WIRE_TOPICS.map((t) => t.value);

/** Fast membership check for API validation. */
export const WIRE_TOPIC_SET = new Set(WIRE_TOPIC_VALUES);

/** Max topics a single wire may carry. */
export const WIRE_MAX_TAGS = 3;

/** Look up a label for a canonical value (falls back to the value itself). */
export function wireTopicLabel(value: string): string {
  return WIRE_TOPICS.find((t) => t.value === value)?.label ?? value;
}
