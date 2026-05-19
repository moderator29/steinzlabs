import { redirect } from 'next/navigation';

// Bug §3c — the /market sub-tree carried a second market UI (price
// table + side-nav) that diverged from /dashboard/market. Owner asked
// to retire the side-nav design and route every entry point to the
// dashboard market view (the watchlist-aware one).
export default function MarketPage() {
  redirect('/dashboard/market');
}
