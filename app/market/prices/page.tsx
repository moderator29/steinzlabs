import { redirect } from 'next/navigation';

// Bug §3c — retired: /market/prices duplicated the dashboard market
// view with an older simpler design. Now redirects to the canonical
// /dashboard/market so every market entry point lands on the same UI.
export default function PricesRedirect() {
  redirect('/dashboard/market');
}
