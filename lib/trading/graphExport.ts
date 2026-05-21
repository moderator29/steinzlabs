'use client';

/**
 * §3 P2-C.7 — client-side helpers for exporting + sharing the network
 * graph. PNG path uses an SVG-to-canvas conversion (the network graph
 * page renders the graph as inline SVG, which we can serialize); share
 * path POSTs the current snapshot to /api/network-graph/share and
 * returns the public URL.
 */

export interface ShareSnapshot {
  nodes: unknown[];
  edges: unknown[];
  stats?: unknown;
  focusWallet?: string;
  capturedAt: number;
}

/**
 * Serialize an SVG element to a PNG blob. Honors devicePixelRatio so the
 * download is crisp on Retina displays.
 */
export async function svgToPngBlob(svg: SVGElement, watermark = 'NAKALABS · nakalabs.xyz'): Promise<Blob | null> {
  const dpr = window.devicePixelRatio || 1;
  const bbox = svg.getBoundingClientRect();
  const w = bbox.width;
  const h = bbox.height;
  if (w === 0 || h === 0) return null;

  const xml = new XMLSerializer().serializeToString(svg);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const dataUrl = `data:image/svg+xml;base64,${svg64}`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG render failed'));
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Watermark stamp
  ctx.font = 'bold 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(77, 128, 255, 0.85)';
  ctx.fillText(watermark, 16, h - 16);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportGraphPng(svg: SVGElement, filename = 'network-graph.png'): Promise<void> {
  const blob = await svgToPngBlob(svg);
  if (blob) downloadBlob(blob, filename);
}

export async function shareGraph(snapshot: ShareSnapshot): Promise<{ short_code: string; url: string } | null> {
  try {
    const res = await fetch('/api/network-graph/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, focus_wallet: snapshot.focusWallet }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
