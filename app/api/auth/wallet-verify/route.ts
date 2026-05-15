import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import nacl from "tweetnacl";
import bs58 from "bs58";
import * as Sentry from "@sentry/nextjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeAddress } from "@/lib/utils/addressNormalize";
import { buildSiweMessage, resolveSiweOrigin } from "@/lib/auth/siwe";

export const runtime = "nodejs";

interface VerifyBody {
  address: string;
  signature: string;
  nonce: string;
  chain: "evm" | "solana";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyBody;
    const { address, signature, nonce, chain } = body;
    if (!address || !signature || !nonce || !["evm", "solana"].includes(chain)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const normalized = normalizeAddress(address, chain === "evm" ? "ethereum" : "solana");

    // Nonce is bound to (nonce, address, chain) so a stolen nonce cannot be
    // replayed against a different wallet.
    const { data: nonceRow } = await supabase
      .from("auth_wallet_nonces")
      .select("*")
      .eq("nonce", nonce)
      .eq("address", normalized)
      .eq("chain", chain)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!nonceRow) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 403 });
    }

    // Reconstruct the message from the nonce row's stored values (not
    // client input) so the signature is verified against EXACTLY what
    // the user signed at issuance. Domain / URI / chainId now live
    // inside the signed payload (EIP-4361 / SIWS), so a phishing site
    // can't replay nakalabs-bound signatures.
    //
    // Backwards compat: legacy nonce rows (pre-migration) lack
    // `chain_id` / `issued_at`. For those we fall back to the original
    // free-form message so existing in-flight sign-ins don't 403
    // mid-rollout. The migration backfills NULL → today, so this
    // branch is only hit for the 5-minute nonce-TTL window after deploy.
    const host = request.headers.get("host");
    const { domain, uri } = resolveSiweOrigin(host);
    const issuedAt = nonceRow.issued_at as string | null | undefined;
    const chainIdStored = nonceRow.chain_id as number | null | undefined;
    const message = issuedAt
      ? buildSiweMessage({
          domain,
          address: nonceRow.address,
          uri,
          chain: chain as "evm" | "solana",
          chainId: typeof chainIdStored === "number" ? chainIdStored : undefined,
          nonce,
          issuedAt,
          expirationTime: nonceRow.expires_at,
        })
      : `Sign this message to authenticate with Naka Labs.\n\nAddress: ${nonceRow.address}\nNonce: ${nonce}\nExpires: ${nonceRow.expires_at}`;

    let verified = false;
    try {
      if (chain === "evm") {
        verified = await verifyMessage({
          address: nonceRow.address as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });
      } else {
        const pubkeyBytes = bs58.decode(nonceRow.address);
        const sigBytes = bs58.decode(signature);
        const msgBytes = new TextEncoder().encode(message);
        verified = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
      }
    } catch {
      return NextResponse.json({ error: "Malformed signature" }, { status: 400 });
    }

    if (!verified) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
    }

    // Consume immediately on successful verify so a parallel request can't
    // re-use the same nonce while the user-creation path is mid-flight.
    await supabase.from("auth_wallet_nonces").update({ consumed: true }).eq("nonce", nonce);

    const { data: existing } = await supabase
      .from("wallet_identities")
      .select("user_id")
      .eq("address", normalized)
      .eq("chain", chain)
      .maybeSingle();

    // Email synthesis must be deterministic per (address, chain). Lower-case
    // the EVM canonical form for email-safe characters; Solana addresses are
    // already email-safe (base58, no symbols), use them as-is.
    const email = chain === "evm" ? `${normalized}@wallet.nakalabs.com` : `${normalized.toLowerCase()}@wallet.nakalabs.com`;
    let userId: string;

    if (existing) {
      userId = existing.user_id;
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { wallet_address: address, chain, auth_method: "wallet" },
      });
      if (createErr || !newUser.user) {
        return NextResponse.json(
          { error: createErr?.message || "Failed to create user" },
          { status: 500 },
        );
      }
      userId = newUser.user.id;

      await supabase.from("wallet_identities").insert({
        user_id: userId,
        address: normalized,
        chain,
        is_primary: true,
      });
    }

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return NextResponse.json(
        { error: linkErr?.message || "Failed to create session link" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      userId,
      actionLink: linkData.properties.action_link,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "auth/wallet-verify" } });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
