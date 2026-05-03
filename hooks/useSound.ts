'use client';
import { useCallback, useEffect, useState } from 'react';
import { soundManager, type SoundName } from '@/lib/cinematic/sound';

/** Returns a memoized play() and reactive enabled/volume getters/setters. */
export function useSound() {
  const [enabled, setEnabledState] = useState(true);
  const [volume, setVolumeState] = useState(0.4);
  const [musicEnabled, setMusicEnabledState] = useState(true);
  const [musicVolume, setMusicVolumeState] = useState(0.15);

  useEffect(() => {
    const m = soundManager();
    setEnabledState(m.enabled);
    setVolumeState(m.volume);
    setMusicEnabledState(m.musicEnabled);
    setMusicVolumeState(m.musicVolume);
  }, []);

  const play = useCallback((name: SoundName) => soundManager().play(name), []);

  const setEnabled = useCallback((v: boolean) => {
    soundManager().setEnabled(v);
    setEnabledState(v);
  }, []);
  const setVolume = useCallback((v: number) => {
    soundManager().setVolume(v);
    setVolumeState(v);
  }, []);
  const setMusicEnabled = useCallback((v: boolean) => {
    soundManager().setMusicEnabled(v);
    setMusicEnabledState(v);
  }, []);
  const setMusicVolume = useCallback((v: number) => {
    soundManager().setMusicVolume(v);
    setMusicVolumeState(v);
  }, []);

  return { play, enabled, volume, musicEnabled, musicVolume, setEnabled, setVolume, setMusicEnabled, setMusicVolume };
}
