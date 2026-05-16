import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Geo lookup for jurisdiction-aware UI. Reads Vercel's edge geo
 * headers (x-vercel-ip-country / region / city) so the client doesn't
 * have to ship a geo IP DB. Returns null fields when running outside
 * Vercel (local dev) so the client renders without a warning.
 *
 * Not used for gating — that lives server-side on trade-execute and is
 * scoped to the OFAC-blocked countries set. This endpoint exists for
 * the soft warning banner only.
 */

const HIGH_RISK_COUNTRIES: ReadonlySet<string> = new Set([
  // OFAC comprehensive sanctions (kept narrow on purpose; the legal
  // team can extend via a follow-up).
  'IR', 'KP', 'SY', 'CU',
  // Regions inside Ukraine that fall under sanctions — Vercel reports
  // ISO-3166-2 region codes here; the country is still UA so we treat
  // these as advisory not hard-block.
]);

export async function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  const region = request.headers.get('x-vercel-ip-country-region');
  const city = request.headers.get('x-vercel-ip-city');
  const flagged = country ? HIGH_RISK_COUNTRIES.has(country) : false;
  return NextResponse.json(
    {
      country: country ?? null,
      region: region ?? null,
      city: city ? decodeURIComponent(city) : null,
      flagged,
    },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
