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

  const { data, error } = await supabase
    .from("whale_submissions")
    .select("*")
    .eq("submitter_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { address, chain, proposed_label, proposed_entity_type, reason, evidence_urls } = body as {
    address?: string;
    chain?: string;
    proposed_label?: string;
    proposed_entity_type?: string;
    reason?: string;
    evidence_urls?: string[];
  };
  if (!address || !chain) {
    return NextResponse.json({ error: "Missing address or chain" }, { status: 400 });
  }

  const { error } = await supabase.from("whale_submissions").insert({
    submitter_id: user.id,
    address,
    chain,
    proposed_label: proposed_label ?? null,
    proposed_entity_type: proposed_entity_type ?? null,
    reason: reason ?? null,
    evidence_urls: evidence_urls ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
