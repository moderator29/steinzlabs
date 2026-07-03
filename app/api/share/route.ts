import 'server-only';
import { NextResponse } from 'next/server';

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

    // Stateless id: the id IS the base64url-encoded payload, so any lambda
    // can resolve it without shared state. The old in-memory Map lost every
    // link because the POST (mint) and GET (resolve) ran on different Vercel
    // instances — shares 404'd in production.
    const shortId = encodeSharePayload(payload);

    const host = request.headers.get('host') || 'nakalabs.xyz';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const shareUrl = `${protocol}://${host}/s/${shortId}`;

    const shareText = `${title}\n\n${summary}\n\nPowered by Naka Labs — Real-time on-chain intelligence\n${shareUrl}`;

    return NextResponse.json({
      shareUrl,
      shareText,
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const shortId = searchParams.get('id');
  if (shortId) {
    // The id is a self-describing base64url payload (see POST). Decode it
    // directly — no server-side store, works across serverless instances.
    const data = decodeSharePayload(shortId);
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
