import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { scanDomain } from '@/lib/security/goplusService';

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
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const result = await scanDomain(url);

    return NextResponse.json({
      url,
      verdict: result.verdict,
      confidenceScore: result.confidenceScore,
      isPhishing: result.isPhishing,
      isMalicious: result.isMalicious,
      description: result.description,
      signals: result.signals,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {

    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }
}
