import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeAddress } from "@/lib/utils/addressNormalize";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { address, chain } = await request.json();
    if (!address || typeof address !== "string" || !["evm", "solana"].includes(chain)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    // EVM normalizes to lowercase; Solana base58 preserves case.
    const normalized = normalizeAddress(address, chain === "evm" ? "ethereum" : "solana");

    const supabase = getSupabaseAdmin();
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error } = await supabase.from("auth_wallet_nonces").insert({
      address: normalized,
      chain,
      nonce,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      console.error("[wallet-nonce] insert failed:", error);
      return NextResponse.json({ error: "Failed to issue nonce" }, { status: 500 });
    }

    const message = `Sign this message to authenticate with Naka Labs.\n\nAddress: ${address}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;

    return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error("[wallet-nonce] failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
