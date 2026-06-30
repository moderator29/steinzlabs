'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

/**
 * Compact bell/mute control for the Discover feed header. Toggles the chime on
 * the button itself; a tiny popover exposes the volume slider. Styling matches
 * the surrounding nl-button filters (ghost when muted, neon accent when armed).
 */
export function FeedSoundToggle({
  enabled, volume, onToggle, onVolume,
}: {
  enabled: boolean; volume: number; onToggle: () => void; onVolume: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        onContextMenu={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        title={enabled ? 'Meme Zone sound alerts: ON (click to mute · right-click for volume)' : 'Meme Zone sound alerts: OFF'}
        aria-pressed={enabled}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
          enabled
            ? 'nl-btn-neon'
            : 'nl-button nl-button--ghost'
        }`}
      >
        {enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{enabled ? 'Alerts on' : 'Alerts'}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); } }}
          className="ms-0.5 text-[9px] opacity-70 hover:opacity-100"
          aria-label="Sound options"
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 nl-glass rounded-xl p-3 shadow-xl">
          <div className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">Meme Zone alerts</div>
          <button
            type="button"
            onClick={onToggle}
            className={`w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition mb-3 ${
              enabled ? 'bg-[#0066FF]/20 border-[#0066FF]/50 text-blue-200' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            {enabled ? 'Chime on new tokens' : 'Muted'}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Vol</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
              className="flex-1 accent-[#0066FF]"
              aria-label="Alert volume"
            />
            <span className="text-[10px] text-white/50 w-7 text-right tabular-nums">{Math.round(volume * 100)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
