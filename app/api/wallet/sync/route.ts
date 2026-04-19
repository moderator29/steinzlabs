/**
 * Wallet cloud-sync — backs the local-storage wallets array up to Supabase
 * so users never lose their wallets to a cleared browser, a different
 * device, or a stale initial render. Keys are still encrypted client-side
 * with the user's password before they ever hit this endpoint; the server
 * only stores opaque ciphertext.
 *
 * Critical safety rule on POST: NEVER allow a write that would *shrink*
 * the cloud-stored wallet count to zero unless the request explicitly
 * sets `intent: "clear"`. This prevents the historical bug where an
 * empty initial-load state silently overwrote the user's stored wallets.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WalletRow {
  address: string;
  encryptedKey: string;
  name: string;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_wallets_v2")
    .select("wallets, default_address, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    wallets: (data?.wallets as WalletRow[] | null) ?? [],
    defaultAddress: data?.default_address ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const incoming = Array.isArray(body.wallets) ? (body.wallets as WalletRow[]) : null;
  const defaultAddress = typeof body.defaultAddress === "string" ? body.defaultAddress : null;
  const intent = body.intent === "clear" ? "clear" : "save";

  if (!incoming) return NextResponse.json({ error: "wallets array required" }, { status: 400 });

  // Validate shape — reject anything that doesn't look like a real wallet row,
  // since a single bad row would corrupt the whole backup.
  for (const w of incoming) {
    if (!w || typeof w.address !== "string" || typeof w.encryptedKey !== "string" || w.encryptedKey.length < 8) {
      return NextResponse.json({ error: "invalid wallet row" }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();

  // Safety guard: if caller is trying to write an empty array (or fewer
  // wallets than we have stored), require an explicit `intent: "clear"`.
  // This is the entire point of cloud sync — never silently lose wallets.
  if (intent !== "clear") {
    const { data: existing } = await supabase
      .from("user_wallets_v2")
      .select("wallets")
      .eq("user_id", user.id)
      .maybeSingle();
    const stored = (existing?.wallets as WalletRow[] | null) ?? [];
    if (stored.length > 0 && incoming.length === 0) {
      return NextResponse.json(
        { error: "refusing to overwrite stored wallets with empty array; pass intent:'clear' to confirm" },
        { status: 409 },
      );
    }
    // Merge: union by address, preferring incoming versions (latest name etc.)
    const byAddr = new Map<string, WalletRow>();
    for (const w of stored) byAddr.set(w.address.toLowerCase(), w);
    for (const w of incoming) byAddr.set(w.address.toLowerCase(), w);
    const merged = Array.from(byAddr.values());

    const { error } = await supabase
      .from("user_wallets_v2")
      .upsert(
        { user_id: user.id, wallets: merged, default_address: defaultAddress, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: merged.length, wallets: merged });
  }

  // intent === "clear" — caller explicitly wants to overwrite (e.g. user deleted all wallets)
  const { error } = await supabase
    .from("user_wallets_v2")
    .upsert(
      { user_id: user.id, wallets: incoming, default_address: defaultAddress, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: incoming.length });
}
