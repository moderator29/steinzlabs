import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function getSupabase() {
  const cookieStore = cookies();
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

export async function GET() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabase
    .from("user_security_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    target_type?: "token" | "address";
    target?: string;
    chain?: string;
    notify_on_level?: "medium" | "high" | "critical";
  };
  if (!body.target_type || !body.target || !body.chain) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const { error } = await supabase.from("user_security_subscriptions").upsert(
    {
      user_id: user.id,
      target_type: body.target_type,
      target: body.target,
      chain: body.chain,
      notify_on_level: body.notify_on_level ?? "high",
    },
    { onConflict: "user_id,target_type,target,chain" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase
    .from("user_security_subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
