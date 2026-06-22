'use client';

import { useEffect, useState, useCallback } from 'react';
import { Disc3, ChevronDown } from 'lucide-react';

/**
 * CultPlayer — the Vault's ambient player (Ddergo, scored for the chamber).
 *
 * Mounts once in /vault/layout so playback survives chamber-to-chamber nav.
 * Surface: a circular ORB pinned bottom-right that opens a rectangle PANEL
 * holding the Spotify embed for the owner's curated playlist.
 *
 * The Spotify iframe is only mounted after the first interaction (consent), so
 * non-listeners never pay Spotify's network calls; once consented we persist it
 * and auto-mount on every future Vault visit. The playlist defaults to the
 * owner-provided Ddergo playlist but can be overridden by a
 * 'spotify:playlist:<id>' row in cult_ambient_tracks (no code change).
 */

const KEY = 'naka_cult_player_v3';
const DEFAULT_PLAYLIST = '4ZjnNBKs9x7XdHPLQJmsiK'; // Ddergo — owner-provided

interface Persist {
  expanded: boolean;
  consented: boolean;
}

function loadPersist(): Persist {
  if (typeof window === 'undefined') return { expanded: false, consented: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persist>;
      return { expanded: !!p.expanded, consented: !!p.consented };
    }
  } catch { /* ignore */ }
  return { expanded: false, consented: false };
}

function savePersist(p: Persist) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

export function CultPlayer() {
  const [playlistId, setPlaylistId] = useState(DEFAULT_PLAYLIST);
  const [persist, setPersist] = useState<Persist>({ expanded: false, consented: false });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setPersist(loadPersist()); setHydrated(true); }, []);

  // Optional override: a spotify:playlist:<id> row in cult_ambient_tracks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cult/sanctum/library', { cache: 'no-store' });
        const json = (await res.json()) as { tracks?: Array<{ storage_path: string }> };
        if (cancelled) return;
        const sp = (json.tracks ?? []).find((t) => t.storage_path?.startsWith('spotify:playlist:'));
        if (sp) setPlaylistId(sp.storage_path.replace('spotify:playlist:', ''));
      } catch { /* library unavailable — keep the default playlist */ }
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

  // First orb tap grants consent + opens; afterwards it just toggles the panel.
  const onOrb = useCallback(() => {
    setPersist((prev) => {
      const next = prev.consented
        ? { ...prev, expanded: !prev.expanded }
        : { consented: true, expanded: true };
      savePersist(next);
      return next;
    });
  }, []);

  if (!hydrated) return null;

  const embedSrc = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=naka-cult&theme=0`;

  return (
    <div
      className={`cult-player ${persist.expanded ? 'cult-player--expanded' : 'cult-player--mini'}`}
      role="region"
      aria-label="Cult Library player"
    >
      {/* Rectangle panel — the Spotify embed. Mounted only after consent. */}
      {persist.consented && (
        <div className="cult-player__panel" aria-hidden={!persist.expanded}>
          <div className="cult-player__panel-head">
            <div className="cult-player__np-wrap">
              <span className="cult-player__eyebrow">The Library</span>
              <h3 className="cult-player__np">Ddergo · Sanctuary</h3>
              <p className="cult-player__artist">Scored for the chamber</p>
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
          <div className="cult-player__embed">
            <iframe
              src={embedSrc}
              width="100%"
              height="352"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Ddergo — the cult Library"
              style={{ border: 0, borderRadius: 12 }}
            />
          </div>
        </div>
      )}

      {/* Circle orb — persistent handle */}
      <button
        type="button"
        className={`cult-player__orb ${persist.consented ? 'cult-player__orb--playing' : ''}`}
        onClick={onOrb}
        aria-expanded={persist.expanded}
        aria-label={persist.consented
          ? (persist.expanded ? 'Collapse the Library' : 'Open the Library')
          : 'Open the Library and begin playback'}
      >
        <span className="cult-player__orb-ring" aria-hidden />
        <Disc3 className="cult-player__orb-icon" size={22} />
      </button>
    </div>
  );
}
