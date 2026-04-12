import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

/**
 * POST /api/admin/run-migrations
 * Executes pending SQL migration files against the Supabase Postgres database.
 * Requires ADMIN_MIGRATION_SECRET header + DATABASE_URL env.
 * Used by CI/CD — never exposed to end users.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret');
  if (!secret || secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  const migrations = [
    'phase1-schema.sql',
    'phase2-missing-tables.sql',
  ];

  const results: { file: string; ok: boolean; error?: string }[] = [];
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    for (const file of migrations) {
      try {
        const sql = readFileSync(join(process.cwd(), 'scripts', file), 'utf8');
        await client.query(sql);
        results.push({ file, ok: true });
      } catch (e) {
        results.push({ file, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally {
    await client.end().catch(() => {});
  }

  const allOk = results.every(r => r.ok);
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}
