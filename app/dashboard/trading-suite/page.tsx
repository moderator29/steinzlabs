import { redirect } from "next/navigation";

/**
 * Trading Suite has been unified into the Market terminal:
 *   /dashboard/market (token list) → click any coin →
 *   /dashboard/market/[chain]/[address] (full trading terminal for that coin).
 *
 * This route redirects any bookmarks / stale links to the market list.
 */
export default function TradingSuiteRedirect() {
  redirect("/dashboard/market");
}
