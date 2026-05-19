import { redirect } from 'next/navigation';

// Bug §3c — retired: /market/watchlist had its own minimal UI. The
// dashboard market already exposes watchlist via the star toggle on
// each row plus a watchlist filter. Redirect users to the canonical
// surface.
export default function WatchlistRedirect() {
  redirect('/dashboard/market?filter=watchlist');
}
