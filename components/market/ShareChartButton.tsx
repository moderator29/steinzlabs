'use client';

import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';

interface ShareChartButtonProps {
  targetId: string;
  filename?: string;
  label?: string;
}

export function ShareChartButton({
  targetId,
  filename = 'chart',
  label = 'Save Chart',
}: ShareChartButtonProps) {
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);

    try {
      const el = document.getElementById(targetId);
      if (!el) {
        setCapturing(false);
        return;
      }

      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(el, {
        backgroundColor: '#0A0E1A',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // capture failed silently
    } finally {
      setCapturing(false);
    }
  };

  return (
    <button
      onClick={handleCapture}
      disabled={capturing}
      className="nl-button--ghost gap-2 px-3 py-1.5 rounded-lg text-xs disabled:cursor-not-allowed"
    >
      {capturing ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Camera size={13} />
      )}
      {capturing ? 'Capturing...' : label}
    </button>
  );
}
