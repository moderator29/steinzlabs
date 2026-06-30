'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Persisted control for the Discover-feed "Sound Alerts for the Meme Zone".
// Stored as a tiny JSON blob so on/off + volume round-trip across reloads.
export const FEED_SOUND_KEY = 'naka.sniper.feedSound';

// Tokens are considered "about to graduate" once their bonding curve crosses
// this threshold between two refresh cycles (Pump.fun migration parity).
const GRADUATE_PCT = 90;

interface FeedSoundState { enabled: boolean; volume: number }

function readState(): FeedSoundState {
  if (typeof window === 'undefined') return { enabled: false, volume: 0.25 };
  try {
    const raw = window.localStorage.getItem(FEED_SOUND_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<FeedSoundState>;
      return {
        enabled: j.enabled === true,
        volume: typeof j.volume === 'number' ? Math.min(1, Math.max(0, j.volume)) : 0.25,
      };
    }
  } catch { /* fall through to default */ }
  return { enabled: false, volume: 0.25 };
}

/**
 * Web Audio feed-alert hook. Synthesizes short chimes (no binary assets, no
 * remote fetches). The AudioContext is created lazily on the enabling click so
 * autoplay policies are respected — enabling counts as the required gesture.
 */
export function useFeedSound() {
  const initial = useRef<FeedSoundState>(readState());
  const [enabled, setEnabled] = useState(initial.current.enabled);
  const [volume, setVolume] = useState(initial.current.volume);
  const ctxRef = useRef<AudioContext | null>(null);

  // Persist on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(FEED_SOUND_KEY, JSON.stringify({ enabled, volume }));
    } catch { /* storage unavailable — keep in-memory */ }
  }, [enabled, volume]);

  const ensureCtx = useCallback((): AudioContext | null => {
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext
          || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        ctxRef.current = new Ctx();
      }
      if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
      return ctxRef.current;
    } catch { return null; }
  }, []);

  // Two-note pleasant chime (ascending). `high` adds a brighter third note for
  // the graduate alert so it's distinguishable from a plain new-token ping.
  const playChime = useCallback((high = false) => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const vol = Math.min(1, Math.max(0, volume));
    if (vol <= 0) return;
    const notes = high ? [659.25, 987.77, 1318.51] : [659.25, 987.77];
    notes.forEach((freq, i) => {
      try {
        const t0 = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        osc.start(t0); osc.stop(t0 + 0.34);
      } catch { /* one note failed — skip it */ }
    });
  }, [ensureCtx, volume]);

  // Toggle handler — the click is the user gesture that unlocks audio. Prime the
  // context (and a near-silent tick) so the first real chime isn't swallowed.
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (next) {
        const ctx = ensureCtx();
        if (ctx) {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            osc.start(); osc.stop(ctx.currentTime + 0.01);
          } catch { /* priming failed — first chime may be quiet */ }
        }
      }
      return next;
    });
  }, [ensureCtx]);

  return { enabled, volume, setVolume, toggle, playChime, graduatePct: GRADUATE_PCT };
}
