import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeAddress } from "@/lib/utils/addressNormalize";
import { buildSiweMessage, resolveSiweOrigin } from "@/lib/auth/siwe";

export const runtime = "nodejs";

/**
 * Wallet sign-in nonce issuer.
 *
 * Builds an EIP-4361 (SIWE) message for EVM chains and a SIWS-shaped
 * message for Solana. Both formats embed the domain, URI, and chainId
 * inside the signed payload so a phishing site can't replay a
 * nakalabs-bound signature on a different origin (compliant wallets
 * surface the domain in their signing prompt).
 *
 * The issued chainId + issuedAt are persisted on auth_wallet_nonces
 * so wallet-verify can reconstruct the exact same bytes the user
 * actually signed.
 */
export async function POST(request: NextRequest) {
  try {
    const { address, chain, chainId: chainIdRaw } = await request.json();
    if (!address || typeof address !== "string" || !["evm", "solana"].includes(chain)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const normalized = normalizeAddress(address, chain === "evm" ? "ethereum" : "solana");

    // Default EVM chainId to 1 (mainnet); ignore non-finite or non-positive
    // input. Solana keeps chainId null — the message uses `Chain: solana`.
    const chainId =
      chain === "evm"
        ? Number.isFinite(chainIdRaw) && Number(chainIdRaw) > 0
          ? Math.floor(Number(chainIdRaw))
          : 1
        : null;

    const supabase = getSupabaseAdmin();
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);

    const { error } = await supabase.from("auth_wallet_nonces").insert({
      address: normalized,
      chain,
      nonce,
      expires_at: expiresAt.toISOString(),
      chain_id: chainId,
      issued_at: issuedAt.toISOString(),
    });
    if (error) {
      Sentry.captureException(error, { tags: { route: "auth/wallet-nonce" } });
      return NextResponse.json({ error: "Failed to issue nonce" }, { status: 500 });
    }

    const host = request.headers.get("host");
    const { domain, uri } = resolveSiweOrigin(host);
    const message = buildSiweMessage({
      domain,
      address: normalized,
      uri,
      chain: chain as "evm" | "solana",
      chainId: chainId ?? undefined,
      nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: expiresAt.toISOString(),
    });

    return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "auth/wallet-nonce" } });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
