/**
 * SoundManager — singleton for cinematic SFX + ambient music.
 *
 * Uses native HTMLAudioElement (no Howler dep). Sounds live in
 * /public/sounds/<name>.{ogg,mp3} — we prefer ogg for bandwidth, mp3 fallback.
 *
 * Asset pipeline (owner action): drop royalty-free files matching the names
 * in SOUND_LIBRARY into /public/sounds/. Until then, .play() is a no-op
 * (silently fails). Wiring + UX work first; assets second.
 *
 * Settings are persisted to localStorage AND mirrored to the
 * `cult_user_preferences.sound_*` columns when a session exists (Phase 4
 * adds the table; until then, localStorage only).
 */

export type SoundName =
  | 'vault-door-open'
  | 'vault-door-close'
  | 'seal-rotate'
  | 'success-chime'
  | 'error-tone'
  | 'notification'
  | 'hover-soft'
  | 'click-soft'
  | 'proposal-pass'
  | 'proposal-fail'
  | 'whisper-arrive'
  | 'daily-seal'
  | 'cult-enter'
  | 'level-up';

const STORAGE_ENABLED = 'naka_sound_enabled';
const STORAGE_VOLUME = 'naka_sound_volume';
const STORAGE_MUSIC_ENABLED = 'naka_music_enabled';
const STORAGE_MUSIC_VOLUME = 'naka_music_volume';

class SoundManagerImpl {
  private cache = new Map<SoundName, HTMLAudioElement>();
  private music: HTMLAudioElement | null = null;
  private musicSrc: string | null = null;

  enabled = true;
  volume = 0.4;
  musicEnabled = true;
  musicVolume = 0.15;

  constructor() {
    if (typeof window === 'undefined') return;
    this.enabled = localStorage.getItem(STORAGE_ENABLED) !== 'false';
    this.volume = parseFloat(localStorage.getItem(STORAGE_VOLUME) ?? '0.4');
    this.musicEnabled = localStorage.getItem(STORAGE_MUSIC_ENABLED) !== 'false';
    this.musicVolume = parseFloat(localStorage.getItem(STORAGE_MUSIC_VOLUME) ?? '0.15');
  }

  /** Lazily resolve an audio element. Returns null if the asset doesn't exist. */
  private resolve(name: SoundName): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    let audio = this.cache.get(name);
    if (audio) return audio;
    audio = new Audio();
    // Use mp3 fallback first (best browser support); ogg listed as alt source.
    audio.src = `/sounds/${name}.mp3`;
    audio.volume = this.volume;
    audio.preload = 'auto';
    audio.addEventListener('error', () => {
      // Asset missing — silently disable to avoid console spam in dev.
      this.cache.delete(name);
    }, { once: true });
    this.cache.set(name, audio);
    return audio;
  }

  play(name: SoundName) {
    if (!this.enabled) return;
    const audio = this.resolve(name);
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked, ignore */ });
    } catch { /* swallow */ }
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_ENABLED, String(v));
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.cache.forEach(a => { a.volume = this.volume; });
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_VOLUME, String(this.volume));
  }

  /** Ambient music (Vault). Persists across chamber routes via this singleton. */
  playMusic(src: string) {
    if (!this.musicEnabled) return;
    if (typeof window === 'undefined') return;
    if (this.musicSrc === src && this.music && !this.music.paused) return;
    this.stopMusic();
    this.music = new Audio(src);
    this.music.loop = true;
    this.music.volume = this.musicVolume;
    this.musicSrc = src;
    const p = this.music.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked */ });
  }

  pauseMusic() { this.music?.pause(); }
  resumeMusic() {
    if (!this.musicEnabled) return;
    const p = this.music?.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
  stopMusic() {
    this.music?.pause();
    this.music = null;
    this.musicSrc = null;
  }
  setMusicEnabled(v: boolean) {
    this.musicEnabled = v;
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_MUSIC_ENABLED, String(v));
    if (!v) this.pauseMusic(); else this.resumeMusic();
  }
  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.music) this.music.volume = this.musicVolume;
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_MUSIC_VOLUME, String(this.musicVolume));
  }
}

let _instance: SoundManagerImpl | null = null;
export function soundManager(): SoundManagerImpl {
  if (!_instance) _instance = new SoundManagerImpl();
  return _instance;
}

/** Convenience: fire-and-forget a sound from anywhere (server-safe no-op). */
export function playSound(name: SoundName) {
  if (typeof window === 'undefined') return;
  soundManager().play(name);
}
