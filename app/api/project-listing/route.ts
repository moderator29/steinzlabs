import { NextResponse } from 'next/server';

interface TokenListing {
  id: string;
  tokenName: string;
  symbol: string;
  contractAddress: string;
  chain: string;
  website: string;
  telegram: string;
  twitter: string;
  description: string;
  logoUrl: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

const listings: TokenListing[] = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const password = searchParams.get('password');
  if (password !== '195656') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ listings, total: listings.length });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenName, symbol, contractAddress, chain, website, telegram, twitter, description, logoUrl, email } = body;

    if (!tokenName || !symbol || !contractAddress || !chain || !email) {
      return NextResponse.json({ error: 'Token name, symbol, contract address, chain, and email are required' }, { status: 400 });
    }

    const listing: TokenListing = {
      id: Math.random().toString(36).slice(2, 10),
      tokenName,
      symbol: symbol.toUpperCase(),
      contractAddress,
      chain,
      website: website || '',
      telegram: telegram || '',
      twitter: twitter || '',
      description: description || '',
      logoUrl: logoUrl || '',
      email,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    listings.push(listing);

    return NextResponse.json({
      success: true,
      message: 'Your token listing has been submitted for review. You will receive an email once verified.',
      listingId: listing.id,
    });
  } catch (error) {
    console.error('Listing submission error:', error);
    return NextResponse.json({ error: 'Failed to submit listing' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, status, password } = await request.json();
    if (password !== '195656') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const listing = listings.find(l => l.id === id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    listing.status = status;
    return NextResponse.json({ success: true, listing });
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
