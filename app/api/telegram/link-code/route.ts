import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function generateCode(): string {
  // 6-digit numeric code, zero-padded
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Upsert — preserve existing chat_id if the user already linked and is rotating
  const { data: existing } = await supabase
    .from("user_telegram_links")
    .select("telegram_chat_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // chat_id is the OUTCOME of linking (set by the bot webhook when the
  // user sends /link CODE), not a precondition. Inserting 0 as a placeholder
  // collided on the UNIQUE constraint the moment a second unlinked user
  // asked for a code — see migration 20260420_telegram_link_nullable_chat.sql.
  const payload = {
    user_id: user.id,
    telegram_chat_id: existing?.telegram_chat_id ?? null,
    link_code: code,
    link_code_expires_at: expiresAt,
  };

  const { error } = await supabase
    .from("user_telegram_links")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("[telegram.link-code] upsert failed:", error);
    // Surface the real reason to the client so silent failures don't look
    // like "the button does nothing". Still safe to show — no secrets here.
    return NextResponse.json(
      { error: `Failed to issue code: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    code,
    expiresAt,
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? null,
    instructions: "Open Telegram, message the Naka Labs bot, and send: /link " + code,
  });
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_telegram_links")
    .select("telegram_chat_id, telegram_username, linked_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    linked: !!data?.telegram_chat_id,
    username: data?.telegram_username ?? null,
    linkedAt: data?.linked_at ?? null,
  });
}
