'use client';
import { useEffect, useState } from 'react';

type Track = {
  id: string;
  title: string;
  artist: string;
  storage_path: string;
  duration_seconds: number | null;
  display_order: number;
};

/**
 * LibraryPlayer — Sanctum's Library headline. Renders the cult ambient
 * catalog plus an embedded player. If every track shares the same
 * spotify:playlist:<id> source (current state — see seed in cult_ambient_tracks),
 * we render a single Spotify embed. Once individual MP3 tracks land in
 * /public/audio, the catalog flips to per-track <audio> with playback queue.
 */
export function LibraryPlayer() {
  const [tracks, setTracks] = useState<Track[] | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cult/sanctum/library', { cache: 'no-store' });
        const j = await res.json();
        if (!cancelled) setTracks((j.tracks ?? []) as Track[]);
      } catch {
        if (!cancelled) setTracks(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (tracks === 'loading') {
    return (
      <article className="sanctum-library sanctum-library--loading">
        <div className="nl-loader" aria-label="Reading the catalog" />
      </article>
    );
  }
  if (!tracks || tracks.length === 0) {
    return (
      <article className="sanctum-library sanctum-library--empty">
        <h3 className="cinematic-heading text-lg">The Library is silent</h3>
        <p className="text-[13px] text-[#B4C0E0]">No tracks in the catalog yet. Drop ambient tracks via cult_ambient_tracks.</p>
      </article>
    );
  }

  // Detect "all tracks point to a single Spotify playlist" → single embed.
  const spotifyPaths = tracks.map(t => t.storage_path).filter(p => p.startsWith('spotify:playlist:'));
  const allSpotify = spotifyPaths.length === tracks.length && spotifyPaths.length > 0;
  const playlistId = allSpotify ? spotifyPaths[0].replace('spotify:playlist:', '') : null;

  return (
    <article className="sanctum-library">
      <header className="sanctum-library__head">
        <div>
          <span className="text-[10px] uppercase tracking-[0.24em] text-[#FFD86B]">The Library</span>
          <h2 className="sanctum-library__title">Ddergo Sanctuary</h2>
        </div>
        <span className="text-[11px] text-[#B4C0E0]">{tracks.length} tracks</span>
      </header>

      {playlistId ? (
        <div className="sanctum-library__embed">
          <iframe
            src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=naka-cult&theme=0`}
            width="100%"
            height="380"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title="Ddergo Sanctuary — Spotify Playlist"
          />
        </div>
      ) : (
        <ul className="sanctum-library__list">
          {tracks.map(t => (
            <li key={t.id} className="sanctum-library__row">
              <div>
                <div className="sanctum-library__track-title">{t.title}</div>
                <div className="sanctum-library__track-artist">{t.artist}</div>
              </div>
              <span className="sanctum-library__track-time">{formatDuration(t.duration_seconds)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
