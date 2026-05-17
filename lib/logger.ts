import 'server-only';
import pino from 'pino';

/**
 * Centralized structured logger. Replaces ad-hoc console.* across
 * server-side routes. Two output modes:
 *
 *   - Production: JSON lines (the Vercel runtime captures stdout and
 *     ingests as structured logs in the Vercel dashboard).
 *   - Development: pretty-printed with colors via pino-pretty when
 *     PINO_PRETTY=1 is set; falls back to JSON otherwise so test
 *     environments don't crash if pino-pretty is unavailable.
 *
 * Use:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ req_id, user_id }, 'wallet-intelligence resolved');
 *   logger.error({ err }, 'GoPlus fetch failed');
 *
 * Required fields per convention:
 *   - msg : human description (last positional arg to .info/.warn/etc.)
 *   - err : the Error object on .error / .warn for failures
 *   - req_id : a request correlation id (pass from the route handler;
 *              generate via crypto.randomUUID() on the first hit)
 *   - any domain context (user_id, chain, token, route…)
 */

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  base: { env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown' },
  redact: {
    paths: [
      'password', '*.password',
      'token',    '*.token',
      'jwt',      '*.jwt',
      'authorization', '*.authorization',
      'access_token',  '*.access_token',
      'private_key',   '*.private_key',
      'seed',     '*.seed',
      'encrypted_private_key', '*.encrypted_private_key',
      'cookie',   '*.cookie',
    ],
    censor: '[redacted]',
  },
});

/**
 * Convenience factory — returns a child logger pre-bound to a route
 * name + a fresh request id. Routes should do:
 *
 *   export async function POST(req: NextRequest) {
 *     const log = routeLogger('/api/social/follow');
 *     log.info({ user_id: ... }, 'incoming follow');
 *     ...
 *   }
 */
export function routeLogger(route: string) {
  const reqId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return logger.child({ route, req_id: reqId });
}
