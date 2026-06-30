import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeDomain } from '@/lib/services/domainShield';

const schema = z.object({
  url: z.string().trim().min(1).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    let url = parsed.data.url.trim();
    // Normalize URL — add a scheme so URL parsing and downstream lookups work.
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Multi-source verdict: GoPlus + MetaMask blocklist + RDAP age
    // (+ Google Safe Browsing when configured). Every number traces to a real
    // signal; no fabricated risk percentages.
    const result = await analyzeDomain(url);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }
}
