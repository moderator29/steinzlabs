'use client';
import { Volume2, VolumeX, Music, Music2, type LucideIcon } from 'lucide-react';
import { useSound } from '@/hooks/useSound';

/**
 * Drop-in sound + ambient music controls. Goes in /settings and the Vault
 * mini-player. State persists to localStorage via SoundManager.
 */
export function SoundControls() {
  const { enabled, volume, musicEnabled, musicVolume, setEnabled, setVolume, setMusicEnabled, setMusicVolume } = useSound();

  return (
    <div className="space-y-5">
      <Row
        label="Sound effects"
        on={enabled}
        toggle={() => setEnabled(!enabled)}
        IconOn={Volume2}
        IconOff={VolumeX}
        volume={volume}
        setVolume={setVolume}
      />
      <Row
        label="Ambient music"
        on={musicEnabled}
        toggle={() => setMusicEnabled(!musicEnabled)}
        IconOn={Music}
        IconOff={Music2}
        volume={musicVolume}
        setVolume={setMusicVolume}
      />
    </div>
  );
}

function Row({
  label, on, toggle, IconOn, IconOff, volume, setVolume,
}: {
  label: string;
  on: boolean;
  toggle: () => void;
  IconOn: LucideIcon;
  IconOff: LucideIcon;
  volume: number;
  setVolume: (v: number) => void;
}) {
  const Icon = on ? IconOn : IconOff;
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={`${label} ${on ? 'on' : 'off'}`}
        className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-white/80 transition hover:bg-white/[0.06] hover:text-white"
      >
        <Icon size={18} />
      </button>
      <div className="flex-1">
        <div className="naka-text-body mb-1.5">{label}</div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={!on}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#0066FF] disabled:opacity-40"
          aria-label={`${label} volume`}
        />
      </div>
      <span className="naka-text-tertiary w-10 text-right tabular-nums">{Math.round(volume * 100)}%</span>
    </div>
  );
}
