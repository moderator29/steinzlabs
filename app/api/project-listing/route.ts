import { NextResponse } from 'next/server';

type ListingStatus = 'pending' | 'approved_pending_payment' | 'payment_sent' | 'paid' | 'listed' | 'rejected';

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
  status: ListingStatus;
  submittedAt: string;
  previewUrl: string;
  paymentEmailSentAt?: string;
  paidAt?: string;
  listedAt?: string;
  rejectedAt?: string;
  approvedAt?: string;
}

const listings: TokenListing[] = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const password = searchParams.get('password');
  const previewId = searchParams.get('preview');

  if (previewId) {
    const listing = listings.find(l => l.id === previewId);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    return NextResponse.json({ listing });
  }

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

    const id = Math.random().toString(36).slice(2, 10);
    const listing: TokenListing = {
      id,
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
      previewUrl: `/dashboard/token-preview/${id}`,
    };

    listings.push(listing);

    return NextResponse.json({
      success: true,
      message: 'Your token listing has been submitted for review!',
      listingId: listing.id,
      previewUrl: listing.previewUrl,
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to submit listing' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, action, password } = await request.json();
    if (password !== '195656') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const listing = listings.find(l => l.id === id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    switch (action) {
      case 'approve':
        listing.status = 'approved_pending_payment';
        listing.approvedAt = now;
        break;
      case 'send_payment_email':
        listing.status = 'payment_sent';
        listing.paymentEmailSentAt = now;
        break;
      case 'confirm_payment':
        listing.status = 'paid';
        listing.paidAt = now;
        break;
      case 'list':
        listing.status = 'listed';
        listing.listedAt = now;
        break;
      case 'reject':
        listing.status = 'rejected';
        listing.rejectedAt = now;
        break;
      default:
        if (['pending', 'approved_pending_payment', 'payment_sent', 'paid', 'listed', 'rejected'].includes(action)) {
          listing.status = action as ListingStatus;
        } else {
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    }

    return NextResponse.json({ success: true, listing });
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
