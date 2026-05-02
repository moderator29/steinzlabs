"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { addressesEqual } from "@/lib/utils/addressNormalize";

interface GraphMember {
  address: string;
  label: string | null;
  whale_score: number;
  verified: boolean;
}

interface GraphEdge {
  from_address: string;
  to_address: string;
  edge_type: string;
  confidence: number;
}

interface Cluster2DGraphProps {
  rootAddress: string;
  members: GraphMember[];
  edges: GraphEdge[];
  height?: number;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  score: number;
  isRoot: boolean;
  verified: boolean;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  type: string;
  confidence: number;
}

const EDGE_COLORS: Record<string, string> = {
  direct_transfer: "#4d80ff",
  common_funding: "#a855f7",
  coordinated_trading: "#f59e0b",
  behavioral_fingerprint: "#22c55e",
  sybil_pattern: "#ef4444",
};

export function Cluster2DGraph({ rootAddress, members, edges, height = 480 }: Cluster2DGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const width = svgRef.current.clientWidth;
    const h = height;

    const nodes: D3Node[] = members.map((m) => ({
      id: m.address,
      label: m.label ?? `${m.address.slice(0, 6)}…${m.address.slice(-4)}`,
      score: m.whale_score,
      isRoot: addressesEqual(m.address, rootAddress),
      verified: m.verified,
    }));
    const links: D3Link[] = edges.map((e) => ({
      source: e.from_address,
      target: e.to_address,
      type: e.edge_type,
      confidence: e.confidence,
    }));

    const sim = d3
      .forceSimulation<D3Node>(nodes)
      .force(
        "link",
        d3.forceLink<D3Node, D3Link>(links).id((d) => d.id).distance(90).strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, h / 2))
      .force("collision", d3.forceCollide().radius(22));

    const link = svg
      .append("g")
      .attr("stroke-opacity", 0.55)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d) => EDGE_COLORS[d.type] ?? "#4d80ff")
      .attr("stroke-width", (d) => 0.8 + d.confidence * 1.5);

    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", (d) => (d.isRoot ? 12 : 8))
      .attr("fill", (d) => (d.isRoot ? "#4d80ff" : "#1e293b"))
      .attr("stroke", (d) => (d.verified ? "#22c55e" : d.isRoot ? "#93c5fd" : "#334155"))
      .attr("stroke-width", (d) => (d.verified ? 2 : 1));

    node
      .append("text")
      .text((d) => d.label)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "#cbd5e1")
      .attr("font-size", 10)
      .attr("font-family", "ui-monospace, SFMono-Regular, monospace");

    node.append("title").text((d) => `${d.label}\n${d.id}`);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as D3Node).x ?? 0)
        .attr("y1", (d) => (d.source as D3Node).y ?? 0)
        .attr("x2", (d) => (d.target as D3Node).x ?? 0)
        .attr("y2", (d) => (d.target as D3Node).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
    };
  }, [rootAddress, members, edges, height]);

  return (
    <svg
      ref={svgRef}
      className="w-full rounded-xl bg-slate-950/40 border border-slate-800"
      style={{ height }}
    />
  );
}

export default Cluster2DGraph;
