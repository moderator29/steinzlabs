import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodSchema, z } from 'zod';

/**
 * validateBody — convenience wrapper that JSON-parses the request body,
 * runs a Zod schema over it, and returns either { ok: true, data } or
 * { ok: false, response } with a 400 response already shaped for the
 * route to return directly.
 *
 * Drops the boilerplate try/catch/Zod-error-shape that every API route
 * was repeating. Returns SAFE 400 responses — never leaks raw Zod
 * issue paths in production, just a slim 'invalid: [<paths>]' so
 * automated probes can't enumerate the schema.
 *
 * Audit B.19 + audit findings 'inconsistent error shapes across API
 * routes'.
 */

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function validateBody<S extends ZodSchema>(
  request: Request,
  schema: S,
): Promise<ValidationResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const paths = parsed.error.issues
      .map((i) => i.path.join('.'))
      .filter(Boolean);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', invalid: paths },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Query-string variant — pulls searchParams off the request URL and
 * coerces it through the schema. Useful for GET handlers that want
 * the same validation discipline as their POST cousins.
 */
export function validateQuery<S extends ZodSchema>(
  request: Request,
  schema: S,
): ValidationResult<z.infer<S>> {
  const url = new URL(request.url);
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    obj[key] = all.length > 1 ? all : all[0];
  }
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    const paths = parsed.error.issues
      .map((i) => i.path.join('.'))
      .filter(Boolean);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', invalid: paths },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
