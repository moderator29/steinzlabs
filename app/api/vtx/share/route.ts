import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversation_id, messages, expires_in_days } = (await request.json()) as {
    conversation_id?: string;
    messages?: Msg[];
    expires_in_days?: number;
  };

  if (!conversation_id || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing conversation_id or messages" }, { status: 400 });
  }

  // Verify the user actually owns this conversation
  const { data: conv } = await supabase
    .from("vtx_conversations")
    .select("id, title, user_id")
    .eq("id", conversation_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const shareToken = randomBytes(12).toString("base64url");
  const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 86_400_000).toISOString() : null;
  const snapshot = { title: conv.title, messages };

  const { data, error } = await supabase
    .from("vtx_shared_conversations")
    .insert({
      conversation_id,
      owner_id: user.id,
      share_token: shareToken,
      snapshot,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    share_token: data.share_token,
    url: `/vtx/shared/${shareToken}`,
  });
}
