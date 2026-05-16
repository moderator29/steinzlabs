import 'server-only';
import * as Sentry from '@sentry/nextjs';

/**
 * Structured logger — Pino-shaped output without the dependency. Every
 * call emits a single-line JSON object so Vercel / external log
 * collectors can ingest without regex parsing. Mirrors the §5.11 audit
 * recommendation; preferred over the existing 162 raw `console.*` calls.
 *
 * Levels (lower = noisier):
 *   trace  — diagnostic firehose, disabled in prod
 *   debug  — dev-mode noise
 *   info   — normal lifecycle (route start/end, cron success)
 *   warn   — recoverable surprise (retry succeeded, fallback used)
 *   error  — broke for the user; also captures to Sentry
 *
 * Usage:
 *   import { log } from '@/lib/log/logger';
 *   const r = log.child({ route: 'engagement.POST', userId });
 *   r.info('insert', { eventId, action });
 *   r.error('db failure', err);
 */

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error';
type Context = Record<string, unknown>;

const LEVEL_RANK: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

function activeMinLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase() as Level;
  if (raw in LEVEL_RANK) return LEVEL_RANK[raw];
  return process.env.NODE_ENV === 'production' ? LEVEL_RANK.info : LEVEL_RANK.debug;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 6).join('\n'),
    };
  }
  return { value: typeof err === 'string' ? err : JSON.stringify(err) };
}

function emit(level: Level, base: Context, msg: string, extra?: Context, err?: unknown): void {
  if (LEVEL_RANK[level] < activeMinLevel()) return;
  const payload: Context = {
    level,
    time: new Date().toISOString(),
    msg,
    ...base,
    ...(extra ?? {}),
    ...(err !== undefined ? { err: serializeError(err) } : {}),
  };
  const line = (() => {
    try {
      return JSON.stringify(payload);
    } catch {
      return JSON.stringify({ level, msg, _serializeError: true });
    }
  })();
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
  if (level === 'error' && err !== undefined) {
    Sentry.captureException(err, { extra: { ...base, ...(extra ?? {}) } });
  }
}

export interface Logger {
  trace(msg: string, extra?: Context): void;
  debug(msg: string, extra?: Context): void;
  info(msg: string, extra?: Context): void;
  warn(msg: string, extra?: Context): void;
  error(msg: string, err?: unknown, extra?: Context): void;
  child(context: Context): Logger;
}

function make(base: Context): Logger {
  return {
    trace: (msg, extra) => emit('trace', base, msg, extra),
    debug: (msg, extra) => emit('debug', base, msg, extra),
    info: (msg, extra) => emit('info', base, msg, extra),
    warn: (msg, extra) => emit('warn', base, msg, extra),
    error: (msg, err, extra) => emit('error', base, msg, extra, err),
    child: (context) => make({ ...base, ...context }),
  };
}

export const log: Logger = make({ service: 'naka-labs' });
