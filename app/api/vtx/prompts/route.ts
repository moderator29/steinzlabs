import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";

export const runtime = "nodejs";

interface PromptRow {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  sort_order: number | null;
}

export async function GET() {
  try {
    const prompts = await cacheWithFallback<PromptRow[]>("vtx:prompts:featured", 600, async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("naka_prompts")
        .select("id, title, prompt, category, sort_order")
        .eq("is_featured", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .limit(10);
      if (error) {
        // Table may not exist yet — return empty so client uses fallback
        return [];
      }
      return (data ?? []) as PromptRow[];
    });

    return NextResponse.json({ prompts });
  } catch (err) {
    console.error("[vtx/prompts]", err);
    return NextResponse.json({ prompts: [] });
  }
}
