import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";

export const GET = withTierGate("pro", async (
  _request: NextRequest,
  { params }: { params: { address: string } },
) => {
  const supabase = getSupabaseAdmin();
  const addr = params.address.toLowerCase();
  try {
    // BFS over wallet_edges from the root address (depth 2, cap members at 50)
    const visited = new Set<string>([addr]);
    const frontier: string[] = [addr];
    const memberEdges: Array<{ from_address: string; to_address: string; edge_type: string; confidence: number }> = [];
    let depth = 0;
    while (frontier.length > 0 && depth < 2 && visited.size < 50) {
      const current = [...frontier];
      frontier.length = 0;
      const { data: edges } = await supabase
        .from("wallet_edges")
        .select("from_address, to_address, edge_type, confidence, chain")
        .or(current.map((a) => `from_address.eq.${a}`).join(",") || "from_address.eq.x")
        .gte("confidence", 0.5)
        .limit(500);
      const { data: edgesIn } = await supabase
        .from("wallet_edges")
        .select("from_address, to_address, edge_type, confidence, chain")
        .or(current.map((a) => `to_address.eq.${a}`).join(",") || "to_address.eq.x")
        .gte("confidence", 0.5)
        .limit(500);
      const all = [...(edges ?? []), ...(edgesIn ?? [])];
      for (const e of all) {
        memberEdges.push({ from_address: e.from_address, to_address: e.to_address, edge_type: e.edge_type, confidence: e.confidence });
        for (const addr2 of [e.from_address, e.to_address]) {
          if (!visited.has(addr2) && visited.size < 50) {
            visited.add(addr2);
            frontier.push(addr2);
          }
        }
      }
      depth++;
    }

    const members = Array.from(visited);
    const clusterKey = members.sort().slice(0, 5).join("-");

    // Enrich members with whale labels
    const { data: labeled } = await supabase
      .from("whales")
      .select("address, label, entity_type, whale_score, verified")
      .in("address", members);

    const labelMap = new Map<string, { label: string | null; entity_type: string | null; whale_score: number; verified: boolean }>();
    (labeled ?? []).forEach((w: { address: string; label: string | null; entity_type: string | null; whale_score: number; verified: boolean }) => {
      labelMap.set(w.address.toLowerCase(), { label: w.label, entity_type: w.entity_type, whale_score: w.whale_score, verified: w.verified });
    });

    const enrichedMembers = members.map((a) => ({
      address: a,
      ...(labelMap.get(a) ?? { label: null, entity_type: null, whale_score: 0, verified: false }),
    }));

    // Community labels on this cluster
    const { data: labels } = await supabase
      .from("cluster_labels")
      .select("*")
      .eq("cluster_key", clusterKey)
      .order("upvotes", { ascending: false })
      .limit(10);

    return NextResponse.json({
      rootAddress: addr,
      clusterKey,
      memberCount: members.length,
      members: enrichedMembers,
      edges: memberEdges,
      labels: labels ?? [],
    });
  } catch (err) {
    console.error("[api/clusters]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
});
