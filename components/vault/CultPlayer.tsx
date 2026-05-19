'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Music, Play, Pause, X, ChevronUp, Volume2, VolumeX } from 'lucide-react';

/**
 * CultPlayer — single global Spotify embed for the entire Vault.
 *
 * Mounts once at /vault/layout.tsx so playback survives chamber-to-
 * chamber navigation (Conclave → Oracle → Sanctum). Renders a quiet,
 * cinematic mini-bar pinned to the bottom-right. The actual Spotify
 * iframe lives inside the bar — when "expanded" the full Spotify
 * player drops in, when minimized only the bar shows.
 *
 * Auto-resume: the bar honours localStorage('naka_cult_player') —
 * once a member clicks Play once, every subsequent /vault visit
 * auto-mounts the iframe so playback can resume without re-asking
 * (browser autoplay-with-sound policy still requires the original
 * user gesture; once granted it persists for the session). After the
 * first click, navigating between chambers preserves track position
 * because the iframe is never remounted.
 *
 * Playlist source is read from the per-track `storage_path` in
 * cult_ambient_tracks via /api/cult/sanctum/library, so swapping the
 * playlist is a single SQL update — no code change required.
 */

const STORAGE_KEY = 'naka_cult_player_v1';
const DEFAULT_PLAYLIST_ID = '2tuf8ddMY5YPMlqzNWsVyC'; // Ddergo Sanctuary

interface PlayerState {
  expanded: boolean;
  consented: boolean;
}

function loadState(): PlayerState {
  if (typeof window === 'undefined') return { expanded: false, consented: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerState;
      if (parsed && typeof parsed.consented === 'boolean') return parsed;
    }
  } catch { /* ignore */ }
  return { expanded: false, consented: false };
}

function saveState(state: PlayerState) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
}

interface TrackHint {
  title: string;
  artist: string;
}

export function CultPlayer() {
  const [playlistId, setPlaylistId] = useState<string>(DEFAULT_PLAYLIST_ID);
  const [tracks, setTracks] = useState<TrackHint[]>([]);
  const [state, setState] = useState<PlayerState>({ expanded: false, consented: false });
  const [tickerIndex, setTickerIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const tickerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydrated = useRef(false);

  // First-paint state hydrate (avoids SSR flash with empty bar)
  useEffect(() => {
    setState(loadState());
    hydrated.current = true;
  }, []);

  // Pull the active playlist + track metadata for the ticker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cult/sanctum/library', { cache: 'no-store' });
        const json = (await res.json()) as { tracks?: Array<{ title: string; artist: string; storage_path: string }> };
        if (cancelled) return;
        const all = json.tracks ?? [];
        if (all.length === 0) return;
        const spotifyOnly = all.filter((t) => t.storage_path.startsWith('spotify:playlist:'));
        if (spotifyOnly.length === all.length && spotifyOnly[0]) {
          setPlaylistId(spotifyOnly[0].storage_path.replace('spotify:playlist:', ''));
        }
        setTracks(all.map((t) => ({ title: t.title, artist: t.artist })));
      } catch { /* library route unavailable — fall back to defaults */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Track ticker — cycles every 8s so the bar never feels static.
  useEffect(() => {
    if (tracks.length === 0) return;
    tickerTimer.current = setInterval(() => {
      setTickerIndex((i) => (i + 1) % tracks.length);
    }, 8000);
    return () => { if (tickerTimer.current) clearInterval(tickerTimer.current); };
  }, [tracks.length]);

  const grantConsent = useCallback(() => {
    const next = { expanded: true, consented: true };
    setState(next);
    saveState(next);
  }, []);

  const toggleExpand = useCallback(() => {
    const next = { ...state, expanded: !state.expanded };
    if (next.expanded) next.consented = true;
    setState(next);
    saveState(next);
  }, [state]);

  const dismissBar = useCallback(() => {
    // Soft dismiss: collapses the bar for this session but keeps consent so
    // a return visit re-opens cleanly. Hard reset lives in Settings.
    const next = { ...state, expanded: false };
    setState(next);
    saveState(next);
  }, [state]);

  const trackNow = tracks[tickerIndex];
  const embedSrc = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=naka-cult&theme=0`;

  return (
    <div
      className={`cult-player ${state.expanded ? 'cult-player--expanded' : 'cult-player--mini'}`}
      role="region"
      aria-label="Cult library player"
    >
      {/* Cinematic mini-bar — always rendered once hydrated */}
      <button
        type="button"
        className="cult-player__bar"
        onClick={state.consented ? toggleExpand : grantConsent}
        aria-expanded={state.expanded}
        aria-label={state.consented ? (state.expanded ? 'Collapse the Library' : 'Expand the Library') : 'Open the Library and begin playback'}
      >
        <span className="cult-player__sigil" aria-hidden>
          <span className="cult-player__sigil-ring" />
          <Music className="cult-player__icon" />
        </span>
        <span className="cult-player__meta">
          <span className="cult-player__eyebrow">
            {state.consented ? 'The Library' : 'Tap to begin'} · Ddergo Sanctuary
          </span>
          <span className="cult-player__title">
            {trackNow ? `${trackNow.title} — ${trackNow.artist}` : 'Curated sound for the chamber'}
          </span>
        </span>
        <span className="cult-player__cta" aria-hidden>
          {state.expanded ? <X size={14} /> : state.consented ? <ChevronUp size={14} /> : <Play size={14} />}
        </span>
      </button>

      {/* Active iframe — only mounted after the user grants consent so
          we don't ship Spotify's network calls to non-listeners. Once
          mounted it stays mounted across chamber nav. */}
      {state.consented && (
        <div className="cult-player__pane" aria-hidden={!state.expanded}>
          <div className="cult-player__pane-head">
            <div>
              <span className="cult-player__eyebrow">Now playing in the Sanctum</span>
              <h3 className="cult-player__pane-title">Ddergo Sanctuary</h3>
            </div>
            <div className="cult-player__pane-actions">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-pressed={muted}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="cult-player__icon-btn"
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button
                type="button"
                onClick={dismissBar}
                aria-label="Close player"
                className="cult-player__icon-btn"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className={`cult-player__embed ${muted ? 'cult-player__embed--muted' : ''}`}>
            <iframe
              src={embedSrc}
              width="100%"
              height="352"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Ddergo Sanctuary — cult Library"
              style={{ border: 0, borderRadius: 12 }}
            />
          </div>
          {tracks.length > 0 && (
            <ol className="cult-player__tracklist" aria-label="Tracks in the Sanctum">
              {tracks.map((t, i) => (
                <li
                  key={`${t.title}-${i}`}
                  className={`cult-player__track ${i === tickerIndex ? 'cult-player__track--active' : ''}`}
                >
                  <span className="cult-player__track-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="cult-player__track-title">{t.title}</span>
                  <span className="cult-player__track-artist">{t.artist}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
