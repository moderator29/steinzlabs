import { NextResponse } from 'next/server';
import crypto from 'crypto';

const shareStore = new Map<string, Record<string, string>>();

function encodeSharePayload(data: Record<string, string>): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64url');
}

function decodeSharePayload(encoded: string): Record<string, string> | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { eventId, title, summary, chain, tokenSymbol, platform } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    const payload = {
      t: (title || '').slice(0, 120),
      s: (summary || '').slice(0, 200),
      c: chain || '',
      tk: tokenSymbol || '',
      p: platform || '',
    };

    const shortId = crypto.randomBytes(4).toString('hex');
    shareStore.set(shortId, payload);

    const host = request.headers.get('host') || 'steinzlabs.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const shareUrl = `${protocol}://${host}/s/${shortId}`;

    const shareText = `${title}\n\n${summary}\n\nPowered by Steinz Labs — Real-time on-chain intelligence\n${shareUrl}`;

    return NextResponse.json({
      shareUrl,
      shareText,
    });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const shortId = searchParams.get('id');
  if (shortId) {
    const data = shareStore.get(shortId);
    if (!data) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }
    return NextResponse.json({
      title: data.t || '',
      summary: data.s || '',
      chain: data.c || '',
      tokenSymbol: data.tk || '',
      platform: data.p || '',
    });
  }

  const encoded = searchParams.get('payload');
  if (!encoded) {
    return NextResponse.json({ error: 'Missing payload or id' }, { status: 400 });
  }

  const data = decodeSharePayload(encoded);
  if (!data) {
    return NextResponse.json({ error: 'Invalid share link' }, { status: 400 });
  }

  return NextResponse.json({
    title: data.t || '',
    summary: data.s || '',
    chain: data.c || '',
    tokenSymbol: data.tk || '',
    platform: data.p || '',
  });
}
