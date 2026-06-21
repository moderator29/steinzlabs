'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Disc3, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown } from 'lucide-react';

/**
 * CultPlayer — the Vault's self-hosted ambient player (Ddergo, scored for the
 * chamber). Mounts once in /vault/layout so playback survives chamber nav.
 *
 * Rebrand: replaced the Spotify embed with a native <audio> player so we get
 * full tracks, full styling control, and real auto-play. Two surfaces:
 *   • a circular ORB pinned bottom-right (the persistent handle), and
 *   • a RECTANGLE panel with transport + tracklist that slides up from it.
 *
 * Auto-play on entry: browsers block sound without a user gesture, so we try
 * play() on mount AND arm a one-time global gesture listener — the instant the
 * member touches anything in the Vault (including the orb), the Library starts.
 *
 * Tracks come from cult_ambient_tracks via /api/cult/sanctum/library; only
 * self-hosted entries (storage_path that isn't a 'spotify:' marker) are played.
 * If none are configured yet the player renders nothing — drop MP3s into
 * /public/audio and point storage_path at them (e.g. /audio/seal.mp3).
 */

interface Track {
  title: string;
  artist: string;
  src: string;
}

interface Persist {
  expanded: boolean;
  muted: boolean;
  volume: number;
  index: number;
}

const KEY = 'naka_cult_player_v2';
const DEFAULTS: Persist = { expanded: false, muted: false, volume: 0.55, index: 0 };

function loadPersist(): Persist {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persist>;
      return {
        expanded: !!p.expanded,
        muted: !!p.muted,
        volume: typeof p.volume === 'number' ? p.volume : DEFAULTS.volume,
        index: typeof p.index === 'number' ? p.index : 0,
      };
    }
  } catch { /* ignore */ }
  return DEFAULTS;
}

function savePersist(p: Persist) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

export function CultPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [persist, setPersist] = useState<Persist>(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted UI state (avoids SSR mismatch).
  useEffect(() => { setPersist(loadPersist()); setHydrated(true); }, []);

  // Pull the self-hosted track catalog.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cult/sanctum/library', { cache: 'no-store' });
        const json = (await res.json()) as { tracks?: Array<{ title: string; artist: string; storage_path: string }> };
        if (cancelled) return;
        const selfHosted = (json.tracks ?? [])
          .filter((t) => t.storage_path && !t.storage_path.startsWith('spotify:'))
          .map((t) => ({ title: t.title, artist: t.artist, src: t.storage_path }));
        setTracks(selfHosted);
      } catch { /* library route unavailable — render nothing */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((patch: Partial<Persist>) => {
    setPersist((prev) => {
      const next = { ...prev, ...patch };
      savePersist(next);
      return next;
    });
  }, []);

  const current = tracks[persist.index] ?? null;

  // Load the current track's source (and resume if we were playing).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.src.endsWith(current.src)) return;
    const wasPlaying = !a.paused;
    a.src = current.src;
    a.load();
    if (wasPlaying || playing) a.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist.index, current?.src]);

  // Auto-play on entry, with a global first-gesture fallback.
  useEffect(() => {
    if (!hydrated || tracks.length === 0) return;
    const a = audioRef.current;
    if (!a) return;
    a.volume = persist.muted ? 0 : persist.volume;
    let started = false;
    const tryPlay = () => {
      a.play().then(() => { started = true; setPlaying(true); detach(); }).catch(() => {});
    };
    const onGesture = () => { if (!started) tryPlay(); };
    const detach = () => {
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('keydown', onGesture);
    };
    tryPlay();
    document.addEventListener('pointerdown', onGesture, { passive: true });
    document.addEventListener('keydown', onGesture);
    return detach;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tracks.length]);

  // Keep volume / mute in sync.
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = persist.muted ? 0 : persist.volume;
  }, [persist.muted, persist.volume]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
  }, []);

  const skip = useCallback((dir: 1 | -1) => {
    setPersist((prev) => {
      if (tracks.length === 0) return prev;
      const next = { ...prev, index: (prev.index + dir + tracks.length) % tracks.length };
      savePersist(next);
      return next;
    });
  }, [tracks.length]);

  if (!hydrated || tracks.length === 0) return null;

  const pct = Math.round(progress * 100);

  return (
    <div
      className={`cult-player ${persist.expanded ? 'cult-player--expanded' : 'cult-player--mini'}`}
      role="region"
      aria-label="Cult Library player"
    >
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) setProgress(a.currentTime / a.duration);
        }}
        onEnded={() => skip(1)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Rectangle panel — transport + tracklist */}
      <div className="cult-player__panel" aria-hidden={!persist.expanded}>
        <div className="cult-player__panel-head">
          <div className="cult-player__np-wrap">
            <span className="cult-player__eyebrow">Now playing · The Library</span>
            <h3 className="cult-player__np">{current ? current.title : '—'}</h3>
            <p className="cult-player__artist">{current ? current.artist : 'Ddergo'}</p>
          </div>
          <button
            type="button"
            className="cult-player__icon-btn"
            onClick={() => update({ expanded: false })}
            aria-label="Collapse the Library"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        <div className="cult-player__seek" aria-hidden>
          <span className="cult-player__seek-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="cult-player__controls">
          <button type="button" className="cult-player__ctrl" onClick={() => skip(-1)} aria-label="Previous track">
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            className="cult-player__ctrl cult-player__ctrl--play"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button type="button" className="cult-player__ctrl" onClick={() => skip(1)} aria-label="Next track">
            <SkipForward size={18} />
          </button>
          <button
            type="button"
            className="cult-player__ctrl"
            onClick={() => update({ muted: !persist.muted })}
            aria-pressed={persist.muted}
            aria-label={persist.muted ? 'Unmute' : 'Mute'}
          >
            {persist.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {tracks.length > 1 && (
          <ol className="cult-player__tracklist" aria-label="Library tracks">
            {tracks.map((t, i) => (
              <li key={`${t.title}-${i}`}>
                <button
                  type="button"
                  className={`cult-player__track ${i === persist.index ? 'cult-player__track--active' : ''}`}
                  onClick={() => { update({ index: i }); setPlaying(true); }}
                >
                  <span className="cult-player__track-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="cult-player__track-title">{t.title}</span>
                  <span className="cult-player__track-artist">{t.artist}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Circle orb — persistent handle / play indicator */}
      <button
        type="button"
        className={`cult-player__orb ${playing ? 'cult-player__orb--playing' : ''}`}
        onClick={() => update({ expanded: !persist.expanded })}
        aria-expanded={persist.expanded}
        aria-label={persist.expanded ? 'Collapse the Library' : 'Open the Library'}
      >
        <span className="cult-player__orb-ring" aria-hidden />
        <Disc3 className="cult-player__orb-icon" size={22} />
      </button>
    </div>
  );
}
