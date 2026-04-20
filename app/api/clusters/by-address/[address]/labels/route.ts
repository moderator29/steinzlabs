import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  await params; // Next.js 15: params is a Promise
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cluster_key, label, description } = (await request.json()) as {
    cluster_key?: string;
    label?: string;
    description?: string;
  };
  if (!cluster_key || !label) return NextResponse.json({ error: "Missing cluster_key or label" }, { status: 400 });

  const { error } = await supabase.from("cluster_labels").insert({
    cluster_key,
    label: label.trim(),
    description: description?.trim() ?? null,
    submitted_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
