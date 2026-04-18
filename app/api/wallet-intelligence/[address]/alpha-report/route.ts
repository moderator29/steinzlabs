import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const maxDuration = 30;

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

interface AlphaReport {
  summary: string;
  archetype: string;
  strengths: string[];
  risks: string[];
  recent_thesis: string;
  confidence: number;
}

function fallback(address: string, activityCount: number): AlphaReport {
  return {
    summary:
      activityCount === 0
        ? `Wallet ${address} has no indexed on-chain activity in the last 30 days. Either it is dormant or its chain is not yet indexed by the whale-activity-poll cron.`
        : `Wallet ${address} has ${activityCount} recorded actions in the last 30 days. A richer profile will appear once more transaction context is available.`,
    archetype: "unknown",
    strengths: [],
    risks: activityCount === 0 ? ["insufficient_data"] : [],
    recent_thesis: "Insufficient indexed history to form a thesis.",
    confidence: 0.1,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address: rawAddress } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const address = rawAddress.toLowerCase();
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const report = await cacheWithFallback<AlphaReport>(`wallet:alpha:${address}`, 3600, async () => {
      const [whaleR, activityR] = await Promise.all([
        admin.from("whales").select("*").eq("address", address).maybeSingle(),
        admin
          .from("whale_activity")
          .select("action, token_symbol, value_usd, counterparty_label, timestamp")
          .eq("whale_address", address)
          .gt("timestamp", since)
          .order("timestamp", { ascending: false })
          .limit(200),
      ]);

      const activity = activityR.data ?? [];
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return fallback(address, activity.length);

      try {
        const anthropic = new Anthropic({ apiKey });
        const context = {
          address,
          whale: whaleR.data ?? null,
          activity_summary: {
            total_events: activity.length,
            buys: activity.filter((a) => a.action === "buy").length,
            sells: activity.filter((a) => a.action === "sell").length,
            transfers_out: activity.filter((a) => a.action === "transfer_out").length,
            transfers_in: activity.filter((a) => a.action === "transfer_in").length,
            total_value_usd: activity.reduce((s: number, a: { value_usd: number | null }) => s + (a.value_usd ?? 0), 0),
            top_tokens: Array.from(
              activity
                .filter((a) => a.token_symbol)
                .reduce((m: Map<string, number>, a) => {
                  m.set(a.token_symbol!, (m.get(a.token_symbol!) ?? 0) + 1);
                  return m;
                }, new Map<string, number>()),
            )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([sym, count]) => ({ sym, count })),
          },
        };

        const prompt = `You analyze an on-chain wallet and produce an institutional-grade alpha intelligence report. Respond with valid JSON only matching this schema:
{ "summary": string (3 sentences), "archetype": one of [vc, fund, trader, sniper, farmer, degen, market_maker, institutional, unknown], "strengths": string[3-5 short phrases], "risks": string[2-4 short phrases], "recent_thesis": string (2 sentences on the apparent current thesis), "confidence": number between 0 and 1 }

Context:
${JSON.stringify(context, null, 2)}

Rules: no markdown, no em dashes, no asterisks, plain clean language.`;

        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        });
        const textBlock = msg.content.find((b) => b.type === "text");
        const raw = textBlock && "text" in textBlock ? textBlock.text : "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return fallback(address, activity.length);
        const parsed = JSON.parse(jsonMatch[0]) as AlphaReport;

        // Persist
        await admin.from("wallet_alpha_reports").insert({
          wallet_address: address,
          chain: whaleR.data?.chain ?? "ethereum",
          generated_by: user.id,
          summary: parsed.summary,
          archetype: parsed.archetype,
          strengths: parsed.strengths,
          risks: parsed.risks,
          recent_thesis: parsed.recent_thesis,
          confidence: parsed.confidence,
          raw_context: context,
          model: "claude-sonnet-4-6",
        });

        return parsed;
      } catch (err) {
        console.error("[alpha-report] claude failed", err);
        return fallback(address, activity.length);
      }
    });

    return NextResponse.json({ report });
  } catch (err) {
    console.error("[alpha-report]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
