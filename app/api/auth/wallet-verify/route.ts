import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

    const { data: nonceRow } = await supabase
      .from("auth_wallet_nonces")
      .select("*")
      .eq("nonce", nonce)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!nonceRow) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 403 });
    }

    const message = `Sign this message to authenticate with Naka Labs.\n\nAddress: ${address}\nNonce: ${nonce}\nExpires: ${nonceRow.expires_at}`;

    let verified = false;
    if (chain === "evm") {
      verified = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } else {
      const pubkeyBytes = bs58.decode(address);
      const sigBytes = bs58.decode(signature);
      const msgBytes = new TextEncoder().encode(message);
      verified = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    }

    if (!verified) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
    }

    await supabase.from("auth_wallet_nonces").update({ consumed: true }).eq("nonce", nonce);

    const { data: existing } = await supabase
      .from("wallet_identities")
      .select("user_id")
      .eq("address", address.toLowerCase())
      .eq("chain", chain)
      .maybeSingle();

    const email = `${address.toLowerCase()}@wallet.nakalabs.com`;
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
        address: address.toLowerCase(),
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
    console.error("[wallet-verify] failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
