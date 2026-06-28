'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import jsQR from 'jsqr';

/**
 * ScanQrModal — real camera QR scanner for the wallet Send flow (all chains).
 * Streams the rear camera, decodes with jsQR (works cross-browser incl. iOS
 * Safari), parses wallet URIs (ethereum:/solana:/bitcoin: + EIP-681) down to a
 * bare address, and returns it. Honest fallback message if the camera is
 * unavailable/denied.
 */

function parseQrToAddress(raw: string): string {
  let v = raw.trim();
  // Strip scheme (ethereum:/solana:/bitcoin:/tron: …).
  const colon = v.indexOf(':');
  if (colon > 0 && colon < 12) v = v.slice(colon + 1);
  // Strip EIP-681 chain suffix (@1) and query (?value=…).
  v = v.split('?')[0].split('@')[0];
  return v.trim();
}

export function ScanQrModal({ onResult, onClose }: { onResult: (address: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            const addr = parseQrToAddress(code.data);
            if (addr) { onResult(addr); return; } // stop loop; parent closes
          }
        }
      }
      if (!cancelled) raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          raf = requestAnimationFrame(tick);
        }
      } catch {
        if (!cancelled) setError('Camera unavailable or permission denied. Use Paste instead.');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4">
      <button onClick={onClose} aria-label="Close scanner" className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center">
        <X className="w-5 h-5" />
      </button>
      <h2 className="text-white font-bold mb-4">Scan address QR</h2>
      <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden" style={{ boxShadow: '0 0 0 2px rgba(0,102,255,.6), 0 0 26px rgba(0,102,255,.4)' }}>
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center text-[13px] text-slate-300 p-4">{error}</div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            {/* Reticle */}
            <div className="absolute inset-6 rounded-xl border-2 border-white/70" />
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <p className="text-slate-400 text-xs mt-4">Point your camera at a wallet QR code.</p>
    </div>
  );
}
