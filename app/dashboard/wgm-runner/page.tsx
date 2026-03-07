'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, Medal, Play, ArrowLeft,
  Crown, Zap, Target, RotateCcw,
  Home, ChevronLeft, ChevronRight, ChevronUp,
  Lock, Unlock, Gift, Settings as SettingsIcon, Palette, Star, Volume2, VolumeX, Info, Sparkles, Music
} from 'lucide-react';

interface LeaderboardEntry {
  id: string; username: string; score: number; coins: number;
  distance: number; gamesPlayed: number; bestStreak: number; timestamp: number;
  character: string;
}

interface SkinData {
  id: string;
  name: string;
  rarity: string;
  rarityColor: string;
  image: string;
  unlockScore: number;
  glowColor: string;
  accentColor: string;
}

const SKINS: SkinData[] = [
  { id: 'cyber-warrior', name: 'Cyber Warrior', rarity: 'Common', rarityColor: '#60A5FA', image: '/game/skins/cyber-warrior.jpg', unlockScore: 0, glowColor: '#00E5FF', accentColor: '#3B82F6' },
  { id: 'vertex-specter', name: 'Vertex Specter', rarity: 'Rare', rarityColor: '#A78BFA', image: '/game/skins/vertex-specter.jpg', unlockScore: 0, glowColor: '#8B5CF6', accentColor: '#7C3AED' },
  { id: 'shadow-runner', name: 'Shadow Runner', rarity: 'Epic', rarityColor: '#F87171', image: '/game/skins/shadow-runner.jpg', unlockScore: 1500, glowColor: '#EF4444', accentColor: '#DC2626' },
  { id: 'gollden', name: 'Gollden', rarity: 'Epic', rarityColor: '#FBBF24', image: '/game/skins/gollden.jpg', unlockScore: 3000, glowColor: '#F59E0B', accentColor: '#D97706' },
  { id: 'inferno-guard', name: 'Inferno Guard', rarity: 'Legendary', rarityColor: '#FB923C', image: '/game/skins/inferno-guard.jpg', unlockScore: 5000, glowColor: '#EF4444', accentColor: '#B91C1C' },
];

const LANE_COUNT = 3;
const MILESTONE_REWARDS = [
  { score: 500, label: '500 Points', reward: '5 $STZ Bonus', type: 'coin' as const },
  { score: 1500, label: '1,500 Points', reward: 'Shadow Runner Skin', type: 'skin' as const },
  { score: 3000, label: '3,000 Points', reward: 'Gollden Skin', type: 'skin' as const },
  { score: 5000, label: '5,000 Points', reward: 'Inferno Guard Skin', type: 'skin' as const },
  { score: 10000, label: '10,000 Points', reward: 'Legend Badge', type: 'badge' as const },
];

interface Obstacle {
  lane: number; z: number; type: 'laser' | 'drone' | 'barrier' | 'car' | 'crate';
  passed: boolean;
}

interface StzCoin {
  lane: number; z: number; collected: boolean; bobPhase: number;
}

interface RunParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

function removeDarkBg(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const cx = c.getContext('2d');
  if (!cx) return c;
  cx.drawImage(img, 0, 0, c.width, c.height);
  try {
    const data = cx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const brightness = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
      if (brightness < 30) { px[i + 3] = 0; }
      else if (brightness < 55) { px[i + 3] = Math.floor((brightness - 30) / 25 * 255); }
    }
    cx.putImageData(data, 0, 0);
  } catch {}
  return c;
}

class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private playing = false;
  enabled = true;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.25;
    this.masterGain.connect(this.ctx.destination);
  }

  startMusic() {
    if (!this.ctx || !this.masterGain || this.playing || !this.enabled) return;
    this.playing = true;
    this.playBeat();
  }

  private playBeat() {
    if (!this.ctx || !this.masterGain || !this.playing || !this.enabled) return;
    const now = this.ctx.currentTime;
    const bpm = 128;
    const beatLen = 60 / bpm;

    for (let i = 0; i < 16; i++) {
      const t = now + i * beatLen;

      if (i % 4 === 0) {
        this.playKick(t);
      }
      if (i % 2 === 1) {
        this.playHihat(t);
      }
      if (i % 8 === 0) {
        this.playBass(t, [55, 65.4, 49, 61.7][Math.floor(i / 4) % 4]);
      }
      if (i % 4 === 2) {
        this.playSnare(t);
      }
      if (i === 0 || i === 3 || i === 7 || i === 10 || i === 14) {
        const notes = [220, 261.6, 329.6, 293.7, 349.2, 392, 440, 523.3];
        this.playSynth(t, notes[Math.floor(Math.random() * notes.length)]);
      }
    }

    const loopLen = 16 * beatLen;
    setTimeout(() => this.playBeat(), loopLen * 1000 - 100);
  }

  private playKick(t: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private playHihat(t: number) {
    if (!this.ctx || !this.masterGain) return;
    const bufSize = this.ctx.sampleRate * 0.05;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.05);
  }

  private playSnare(t: number) {
    if (!this.ctx || !this.masterGain) return;
    const bufSize = this.ctx.sampleRate * 0.1;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.1);
  }

  private playBass(t: number, freq: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private playSynth(t: number, freq: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 5;
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playCoinSfx() {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playCrashSfx() {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const t = this.ctx.currentTime;
    const bufSize = this.ctx.sampleRate * 0.4;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.4);
  }

  stop() {
    this.playing = false;
  }

  setVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) { this.stop(); this.setVolume(0); }
    else { this.setVolume(0.25); this.startMusic(); }
    return this.enabled;
  }
}

const audioRef = { current: null as GameAudio | null };

export default function STZRunnerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanSpritesRef = useRef<Record<string, HTMLCanvasElement>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [gameState, setGameState] = useState<'login' | 'prerun' | 'tutorial' | 'playing' | 'gameover' | 'leaderboard'>('login');
  const [prerunTab, setPrerunTab] = useState<'skins' | 'rewards' | 'settings'>('skins');
  const [username, setUsername] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(0);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(['cyber-warrior', 'vertex-specter']);
  const [personalBestScore, setPersonalBestScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [finalCoins, setFinalCoins] = useState(0);
  const [finalDistance, setFinalDistance] = useState(0);
  const [rank, setRank] = useState(0);
  const [personalBest, setPersonalBest] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState({ totalPlayers: 0, totalGamesPlayed: 0, highestScore: 0, topPlayer: 'N/A' });
  const [showDeathOverlay, setShowDeathOverlay] = useState(false);
  const [liveScore, setLiveScore] = useState(0);
  const [liveCoins, setLiveCoins] = useState(0);
  const [liveDistance, setLiveDistance] = useState(0);
  const [sessionId, setSessionId] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tutorialTimer, setTutorialTimer] = useState(10);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const gameRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const stoppedRef = useRef(false);
  const scoreSubmittedRef = useRef(false);

  useEffect(() => {
    const loaded: Record<string, HTMLCanvasElement> = {};
    let count = 0;
    SKINS.forEach(skin => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loaded[skin.id] = removeDarkBg(img);
        count++;
        if (count === SKINS.length) {
          cleanSpritesRef.current = loaded;
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        count++;
        if (count === SKINS.length) {
          cleanSpritesRef.current = loaded;
          setImagesLoaded(true);
        }
      };
      img.src = skin.image;
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('stz_runner_username');
    if (saved) setUsername(saved);
    const savedSkin = localStorage.getItem('stz_runner_skin');
    if (savedSkin) setSelectedSkin(parseInt(savedSkin) || 0);
    const savedBest = localStorage.getItem('stz_runner_best');
    if (savedBest) setPersonalBestScore(parseInt(savedBest) || 0);
    const savedUnlocked = localStorage.getItem('stz_runner_unlocked');
    if (savedUnlocked) { try { setUnlockedSkins(JSON.parse(savedUnlocked)); } catch {} }
    const firstTime = !localStorage.getItem('stz_runner_played');
    setIsFirstTime(firstTime);
    const savedSound = localStorage.getItem('stz_runner_sound');
    if (savedSound !== null) setSoundEnabled(savedSound !== 'false');
  }, []);

  useEffect(() => {
    const newUnlocked = [...unlockedSkins];
    let changed = false;
    SKINS.forEach(skin => {
      if (skin.unlockScore > 0 && personalBestScore >= skin.unlockScore && !newUnlocked.includes(skin.id)) {
        newUnlocked.push(skin.id);
        changed = true;
      }
    });
    if (changed) {
      setUnlockedSkins(newUnlocked);
      localStorage.setItem('stz_runner_unlocked', JSON.stringify(newUnlocked));
    }
  }, [personalBestScore]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/wgm-scores');
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
      setStats({ totalPlayers: data.totalPlayers, totalGamesPlayed: data.totalGamesPlayed, highestScore: data.highestScore, topPlayer: data.topPlayer });
    } catch {}
  };

  const submitScore = async (score: number, coins: number, distance: number) => {
    if (scoreSubmittedRef.current) return;
    scoreSubmittedRef.current = true;
    if (score > personalBestScore) {
      setPersonalBestScore(score);
      localStorage.setItem('stz_runner_best', score.toString());
    }
    try {
      const res = await fetch('/api/wgm-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score, coins, distance, character: SKINS[selectedSkin].id }),
      });
      const data = await res.json();
      setRank(data.rank);
      setPersonalBest(data.personalBest);
    } catch {}
  };

  const startGame = useCallback(() => {
    if (!imagesLoaded) return;
    stoppedRef.current = false;
    scoreSubmittedRef.current = false;
    setShowDeathOverlay(false);
    setSessionId(prev => prev + 1);
    localStorage.setItem('stz_runner_played', '1');
    setIsFirstTime(false);
    setGameState('playing');

    if (!audioRef.current) audioRef.current = new GameAudio();
    audioRef.current.enabled = soundEnabled;
    audioRef.current.init();
    if (soundEnabled) audioRef.current.startMusic();
  }, [imagesLoaded, soundEnabled]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentSession = sessionId;
    stoppedRef.current = false;

    const resize = () => {
      canvas.width = Math.min(window.innerWidth, 430);
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const skin = SKINS[selectedSkin];
    const spriteCanvas = cleanSpritesRef.current[skin.id];
    const VP_Y = 0.18;
    const GROUND_Y = 0.80;
    const MAX_Z = 1800;
    const PLAYER_Z = 90;

    const game = {
      playerLane: 1,
      targetLane: 1,
      laneProgress: 1,
      jumping: false,
      jumpVel: 0,
      jumpY: 0,
      speed: 5,
      score: 0,
      coins: 0,
      distance: 0,
      obstacles: [] as Obstacle[],
      stzCoins: [] as StzCoin[],
      particles: [] as RunParticle[],
      frame: 0,
      graceFrames: 90,
      tunnelOffset: 0,
      alive: true,
      flashTimer: 0,
      playerScreenX: 0,
      playerScreenY: 0,
      runCycle: 0,
    };
    gameRef.current = game;

    const getScale = (z: number) => Math.max(0.02, 1 - z / MAX_Z);

    const getScreenY = (z: number, h: number) => {
      const vpY = h * VP_Y;
      const gndY = h * GROUND_Y;
      const s = getScale(z);
      return vpY + (gndY - vpY) * s;
    };

    const getLaneX = (lane: number, z: number, w: number) => {
      const s = getScale(z);
      const laneW = w * 0.22 * s;
      const totalW = laneW * LANE_COUNT;
      const cx = w / 2;
      return cx - totalW / 2 + laneW * lane + laneW / 2;
    };

    const spawnObstacle = () => {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const types: Obstacle['type'][] = ['laser', 'drone', 'barrier', 'car', 'crate'];
      game.obstacles.push({ lane, z: MAX_Z, type: types[Math.floor(Math.random() * types.length)], passed: false });
    };

    const spawnCoin = () => {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      game.stzCoins.push({ lane, z: MAX_Z, collected: false, bobPhase: Math.random() * Math.PI * 2 });
    };

    let obstacleTimer = 0;
    let coinTimer = 0;

    const drawEnvironment = (w: number, h: number) => {
      const vpY = h * VP_Y;
      const gndY = h * GROUND_Y;
      const cx = w / 2;

      const bg = ctx.createRadialGradient(cx, vpY, 0, cx, vpY, h);
      bg.addColorStop(0, '#0a0020');
      bg.addColorStop(0.3, '#060015');
      bg.addColorStop(0.7, '#03000a');
      bg.addColorStop(1, '#000003');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const vpGlow = ctx.createRadialGradient(cx, vpY, 0, cx, vpY, w * 0.35);
      vpGlow.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
      vpGlow.addColorStop(0.5, 'rgba(124, 58, 237, 0.03)');
      vpGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = vpGlow;
      ctx.fillRect(0, 0, w, h * 0.5);

      for (let i = 0; i < 12; i++) {
        const depth = ((i * 150 + game.tunnelOffset * 0.8) % MAX_Z);
        const s = getScale(depth);
        const y = getScreenY(depth, h);
        const halfW = w * 0.52 * s;
        const archH = 60 * s;
        const alpha = s * 0.35;
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = Math.max(1, 3 * s);
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 12 * s;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, y);
        ctx.lineTo(cx - halfW * 0.7, y - archH);
        ctx.lineTo(cx + halfW * 0.7, y - archH);
        ctx.lineTo(cx + halfW, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.beginPath();
        let first = true;
        for (let z = 0; z < MAX_Z; z += 20) {
          const s = getScale(z);
          const y = getScreenY(z, h);
          const halfW = w * 0.50 * s;
          const x = cx + side * halfW;
          if (first) { ctx.moveTo(x, y + 30 * s); first = false; }
          else ctx.lineTo(x, y + 30 * s);
        }
        for (let z = MAX_Z - 20; z >= 0; z -= 20) {
          const s = getScale(z);
          const y = getScreenY(z, h);
          const halfW = w * 0.50 * s;
          const x = cx + side * halfW;
          ctx.lineTo(x, y - 80 * s);
        }
        ctx.closePath();
        const wallGrad = ctx.createLinearGradient(side === -1 ? 0 : w, 0, cx, 0);
        wallGrad.addColorStop(0, 'rgba(10, 0, 30, 0.9)');
        wallGrad.addColorStop(1, 'rgba(5, 0, 15, 0.3)');
        ctx.fillStyle = wallGrad;
        ctx.fill();
        ctx.restore();

        for (let i = 0; i < 20; i++) {
          const depth = ((i * 90 + game.tunnelOffset) % MAX_Z);
          const s = getScale(depth);
          const y = getScreenY(depth, h);
          const halfW = w * 0.50 * s;
          const x = cx + side * halfW;
          const panelH = 50 * s;
          const panelW = 6 * s;
          const alpha = s * 0.3;
          ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - panelW / 2, y - panelH / 2, panelW, panelH);
        }
      }

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 6; i++) {
          const depth = ((i * 280 + game.tunnelOffset * 1.5 + (side === 1 ? 140 : 0)) % MAX_Z);
          const s = getScale(depth);
          if (s < 0.1) continue;
          const y = getScreenY(depth, h);
          const halfW = w * 0.48 * s;
          const x1 = cx + side * halfW;
          const targetX = cx + (Math.sin(game.frame * 0.02 + i) * w * 0.15);
          const alpha = s * 0.7;
          ctx.save();
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.lineWidth = Math.max(1, 2.5 * s);
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 15 * s;
          ctx.beginPath();
          ctx.moveTo(x1, y - 20 * s);
          ctx.lineTo(targetX, y - 20 * s + Math.sin(game.frame * 0.05) * 8 * s);
          ctx.stroke();
          ctx.restore();
        }
      }

      for (let lane = 0; lane <= LANE_COUNT; lane++) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
        ctx.lineWidth = 1;
        let first = true;
        for (let z = 0; z < MAX_Z; z += 25) {
          const s = getScale(z);
          const y = getScreenY(z, h);
          const laneW = w * 0.22 * s;
          const totalW = laneW * LANE_COUNT;
          const x = cx - totalW / 2 + laneW * lane;
          if (first) { ctx.moveTo(x, y); first = false; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      for (let i = 0; i < 30; i++) {
        const depth = ((i * 60 + game.tunnelOffset) % MAX_Z);
        const s = getScale(depth);
        const y = getScreenY(depth, h);
        const laneW = w * 0.22 * s;
        const totalW = laneW * LANE_COUNT;
        const alpha = s * 0.06;
        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - totalW / 2, y);
        ctx.lineTo(cx + totalW / 2, y);
        ctx.stroke();
      }

      const floorGlow = ctx.createLinearGradient(0, gndY - 10, 0, h);
      floorGlow.addColorStop(0, 'rgba(0, 229, 255, 0.03)');
      floorGlow.addColorStop(0.3, 'rgba(124, 58, 237, 0.02)');
      floorGlow.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = floorGlow;
      ctx.fillRect(0, gndY, w, h - gndY);
    };

    const drawPlayerSprite = (w: number, h: number) => {
      const s = getScale(PLAYER_Z);
      const smoothLane = game.laneProgress;
      const x = getLaneX(Math.floor(smoothLane), PLAYER_Z, w) +
        (smoothLane % 1) * (getLaneX(Math.ceil(smoothLane), PLAYER_Z, w) - getLaneX(Math.floor(smoothLane), PLAYER_Z, w));
      const y = getScreenY(PLAYER_Z, h);
      const jy = game.jumpY * s;
      const drawY = y - jy;
      game.playerScreenX = x;
      game.playerScreenY = drawY;

      const spriteH = 140 * s;
      const spriteW = spriteH * 0.72;

      game.runCycle += game.speed * 0.06;
      const runPhase = game.runCycle;
      const bodyBob = Math.abs(Math.sin(runPhase)) * 4 * s;
      const armSwing = Math.sin(runPhase) * 0.06;
      const shoulderTilt = Math.sin(runPhase * 0.5) * 0.02;

      ctx.save();

      ctx.shadowColor = skin.glowColor;
      ctx.shadowBlur = 30 * s;
      ctx.fillStyle = `${skin.glowColor}18`;
      ctx.beginPath();
      ctx.ellipse(x, y + 3, spriteW * 0.55, spriteH * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const drawX = x - spriteW / 2;
      const drawTop = drawY - spriteH - bodyBob;

      ctx.translate(x, drawY);
      ctx.rotate(shoulderTilt);
      ctx.translate(-x, -drawY);

      if (spriteCanvas) {
        ctx.shadowColor = skin.glowColor;
        ctx.shadowBlur = 18 * s;

        const upperH = spriteH * 0.55;
        const lowerH = spriteH * 0.45;
        const upperTop = drawTop;
        const lowerTop = drawTop + upperH;

        ctx.drawImage(spriteCanvas, 0, 0, spriteCanvas.width, spriteCanvas.height * 0.55,
          drawX, upperTop, spriteW, upperH);

        ctx.save();
        const legSwing = Math.sin(runPhase) * 0.04;
        ctx.translate(x, lowerTop);
        ctx.rotate(legSwing);
        ctx.translate(-x, -lowerTop);
        ctx.drawImage(spriteCanvas, 0, spriteCanvas.height * 0.55, spriteCanvas.width, spriteCanvas.height * 0.45,
          drawX, lowerTop, spriteW, lowerH);
        ctx.restore();

        ctx.shadowBlur = 0;

        const glowPulse = 0.08 + Math.sin(game.frame * 0.1) * 0.04;
        ctx.globalAlpha = glowPulse;
        ctx.fillStyle = skin.glowColor;
        ctx.fillRect(drawX, drawTop, spriteW, spriteH);
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.shadowColor = skin.glowColor;
        ctx.shadowBlur = 6 * s;
        ctx.strokeStyle = `${skin.glowColor}30`;
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX + 2, drawTop + 2, spriteW - 4, spriteH - 4);
        ctx.restore();
      } else {
        const sz = 60 * s;
        ctx.fillStyle = skin.accentColor;
        ctx.beginPath();
        ctx.ellipse(x, drawY - sz * 0.62 - bodyBob, sz * 0.22, sz * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = skin.glowColor;
        ctx.fillRect(x - sz * 0.14, drawY - sz * 0.66 - bodyBob, sz * 0.28, sz * 0.05);
        ctx.fillRect(x - sz * 0.24, drawY - sz * 0.50 - bodyBob, sz * 0.48, sz * 0.42);
        const ls = Math.sin(runPhase) * sz * 0.1;
        ctx.fillRect(x - sz * 0.16, drawY - sz * 0.12, sz * 0.13, sz * 0.32 + ls);
        ctx.fillRect(x + sz * 0.03, drawY - sz * 0.12, sz * 0.13, sz * 0.32 - ls);
      }

      ctx.restore();
    };

    const drawObstacle = (obs: Obstacle, w: number, h: number) => {
      const s = getScale(obs.z);
      const x = getLaneX(obs.lane, obs.z, w);
      const y = getScreenY(obs.z, h);
      const obsW = 70 * s;
      const obsH = 55 * s;

      ctx.save();
      if (obs.type === 'laser') {
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 20 * s;
        ctx.fillStyle = '#3d0808';
        ctx.fillRect(x - obsW * 0.42, y - obsH * 1.6, obsW * 0.12, obsH * 1.6);
        ctx.fillRect(x + obsW * 0.30, y - obsH * 1.6, obsW * 0.12, obsH * 1.6);
        ctx.fillStyle = '#1a0404';
        ctx.fillRect(x - obsW * 0.44, y - obsH * 1.7, obsW * 0.16, obsH * 0.15);
        ctx.fillRect(x + obsW * 0.28, y - obsH * 1.7, obsW * 0.16, obsH * 0.15);
        const pulse = 0.4 + Math.sin(game.frame * 0.35) * 0.6;
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.lineWidth = Math.max(2, 4 * s);
        ctx.shadowBlur = 30 * s;
        ctx.beginPath();
        ctx.moveTo(x - obsW * 0.36, y - obsH * 0.7);
        ctx.lineTo(x + obsW * 0.36, y - obsH * 0.7);
        ctx.stroke();
        ctx.strokeStyle = `rgba(252, 165, 165, ${pulse * 0.25})`;
        ctx.lineWidth = Math.max(6, 12 * s);
        ctx.beginPath();
        ctx.moveTo(x - obsW * 0.36, y - obsH * 0.7);
        ctx.lineTo(x + obsW * 0.36, y - obsH * 0.7);
        ctx.stroke();
      } else if (obs.type === 'drone') {
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 16 * s;
        const dy = y - obsH * 2;
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.ellipse(x, dy, obsW * 0.35, obsH * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(x, dy + obsH * 0.05, obsW * 0.22, obsH * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 10 * s;
        ctx.beginPath();
        ctx.arc(x, dy - obsH * 0.08, obsW * 0.06, 0, Math.PI * 2);
        ctx.fill();
        const prop = game.frame * 0.5;
        ctx.strokeStyle = 'rgba(107, 114, 128, 0.7)';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(x - obsW * 0.45 * Math.cos(prop), dy - obsH * 0.25);
        ctx.lineTo(x + obsW * 0.45 * Math.cos(prop), dy - obsH * 0.25);
        ctx.stroke();
      } else if (obs.type === 'car') {
        ctx.shadowColor = '#6B7280';
        ctx.shadowBlur = 10 * s;
        const carW = obsW * 0.9;
        const carH = obsH * 0.55;
        const carY = y - carH;
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.roundRect(x - carW / 2, carY, carW, carH, 6 * s);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.roundRect(x - carW * 0.35, carY - carH * 0.5, carW * 0.7, carH * 0.55, 4 * s);
        ctx.fill();
        ctx.fillStyle = '#374151';
        ctx.fillRect(x - carW * 0.30, carY - carH * 0.4, carW * 0.28, carH * 0.35);
        ctx.fillRect(x + carW * 0.02, carY - carH * 0.4, carW * 0.28, carH * 0.35);
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8 * s;
        ctx.fillRect(x - carW / 2 + 2 * s, carY + carH * 0.15, carW * 0.12, carH * 0.2);
        ctx.fillRect(x + carW / 2 - carW * 0.12 - 2 * s, carY + carH * 0.15, carW * 0.12, carH * 0.2);
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(x - carW * 0.3, y + 1, carH * 0.18, 0, Math.PI * 2);
        ctx.arc(x + carW * 0.3, y + 1, carH * 0.18, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'crate') {
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 10 * s;
        const crW = obsW * 0.55;
        const crH = obsH * 0.65;
        ctx.fillStyle = '#78350F';
        ctx.fillRect(x - crW / 2, y - crH, crW, crH);
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 2 * s;
        ctx.strokeRect(x - crW / 2, y - crH, crW, crH);
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(x, y - crH);
        ctx.lineTo(x, y);
        ctx.moveTo(x - crW / 2, y - crH / 2);
        ctx.lineTo(x + crW / 2, y - crH / 2);
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.fillText('!', x - 3 * s, y - crH * 0.35);
      } else {
        ctx.shadowColor = '#7C3AED';
        ctx.shadowBlur = 14 * s;
        const pulse = 0.25 + Math.sin(game.frame * 0.15) * 0.15;
        const bw = obsW * 0.9;
        const bh = obsH * 0.18;
        ctx.fillStyle = `rgba(124, 58, 237, ${pulse * 0.8})`;
        ctx.fillRect(x - bw / 2, y - bh, bw, bh);
        ctx.fillStyle = `rgba(139, 92, 246, ${pulse})`;
        for (let seg = 0; seg < 5; seg++) {
          ctx.fillRect(x - bw / 2 + seg * bw * 0.22, y - bh * 2, bw * 0.18, bh);
        }
        ctx.fillStyle = `rgba(167, 139, 250, ${pulse * 0.15})`;
        ctx.fillRect(x - bw * 0.6, y - bh * 2.5, bw * 1.2, bh * 2.5);
      }
      ctx.restore();
    };

    const drawCoin = (coin: StzCoin, w: number, h: number) => {
      if (coin.collected) return;
      const s = getScale(coin.z);
      const x = getLaneX(coin.lane, coin.z, w);
      const y = getScreenY(coin.z, h);
      const bob = Math.sin(coin.bobPhase + game.frame * 0.08) * 8 * s;
      const cy = y - 40 * s + bob;
      const r = 18 * s;

      ctx.save();
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 22 * s;
      const coinGrad = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.3, 0, x, cy, r);
      coinGrad.addColorStop(0, '#FCD34D');
      coinGrad.addColorStop(0.5, '#F59E0B');
      coinGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = coinGrad;
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2 * s;
      ctx.stroke();
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350F';
      ctx.font = `bold ${r * 1.1}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', x, cy + 1);
      ctx.restore();
    };

    const drawParticles = () => {
      for (const p of game.particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const checkCollision = (obs: Obstacle): boolean => {
      if (Math.abs(obs.lane - game.laneProgress) > 0.6) return false;
      if (obs.z > PLAYER_Z - 25 && obs.z < PLAYER_Z + 50) {
        if (obs.type === 'drone' && game.jumpY > 35) return false;
        if (obs.type === 'barrier' && game.jumpY > 18) return false;
        return true;
      }
      return false;
    };

    const checkCoinCollect = (coin: StzCoin): boolean => {
      if (coin.collected) return false;
      if (Math.abs(coin.lane - game.laneProgress) > 0.6) return false;
      return coin.z > PLAYER_Z - 30 && coin.z < PLAYER_Z + 55;
    };

    const spawnDeathParticles = () => {
      for (let i = 0; i < 55; i++) {
        game.particles.push({
          x: game.playerScreenX, y: game.playerScreenY - 50,
          vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14,
          life: 30 + Math.random() * 30, maxLife: 60,
          color: Math.random() > 0.5 ? '#EF4444' : skin.glowColor,
          size: 2 + Math.random() * 6,
        });
      }
    };

    let touchStartX = 0;
    let touchStartY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!game.alive) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') { if (game.targetLane > 0) game.targetLane--; }
      else if (e.key === 'ArrowRight' || e.key === 'd') { if (game.targetLane < LANE_COUNT - 1) game.targetLane++; }
      else if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !game.jumping) { game.jumping = true; game.jumpVel = 14; }
    };

    const handleTouchStart = (e: TouchEvent) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!game.alive) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { if (!game.jumping) { game.jumping = true; game.jumpVel = 14; } return; }
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -25 && game.targetLane > 0) game.targetLane--;
        else if (dx > 25 && game.targetLane < LANE_COUNT - 1) game.targetLane++;
      } else if (dy < -25 && !game.jumping) { game.jumping = true; game.jumpVel = 14; }
    };

    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

    const gameLoop = () => {
      if (stoppedRef.current || sessionId !== currentSession) return;
      const w = canvas.width;
      const h = canvas.height;

      if (game.alive) {
        game.frame++;
        game.speed = 5 + game.distance * 0.004;
        game.tunnelOffset = (game.tunnelOffset + game.speed * 3) % MAX_Z;
        game.distance += game.speed * 0.025;
        game.score += Math.floor(game.speed * 0.6);

        const laneSpeed = 0.15;
        if (game.laneProgress < game.targetLane) game.laneProgress = Math.min(game.targetLane, game.laneProgress + laneSpeed);
        else if (game.laneProgress > game.targetLane) game.laneProgress = Math.max(game.targetLane, game.laneProgress - laneSpeed);

        if (game.jumping) {
          game.jumpY += game.jumpVel;
          game.jumpVel -= 0.7;
          if (game.jumpY <= 0) { game.jumpY = 0; game.jumping = false; game.jumpVel = 0; }
        }

        if (game.graceFrames > 0) game.graceFrames--;
        else {
          obstacleTimer++;
          if (obstacleTimer > Math.max(26, 68 - game.distance * 0.12)) { spawnObstacle(); obstacleTimer = 0; }
        }

        coinTimer++;
        if (coinTimer > 36) { spawnCoin(); coinTimer = 0; }

        for (const obs of game.obstacles) obs.z -= game.speed * 4.5;
        for (const coin of game.stzCoins) coin.z -= game.speed * 4.5;
        game.obstacles = game.obstacles.filter(o => o.z > -200);
        game.stzCoins = game.stzCoins.filter(c => c.z > -200);

        if (game.graceFrames <= 0) {
          for (const obs of game.obstacles) {
            if (!obs.passed && checkCollision(obs)) {
              game.alive = false;
              game.flashTimer = 14;
              spawnDeathParticles();
              if (audioRef.current) { audioRef.current.playCrashSfx(); audioRef.current.stop(); }
              const fs = game.score, fc = game.coins, fd = Math.floor(game.distance);
              setFinalScore(fs); setFinalCoins(fc); setFinalDistance(fd);
              submitScore(fs, fc, fd);
              setTimeout(() => setShowDeathOverlay(true), 600);
              break;
            }
          }
        }

        for (const coin of game.stzCoins) {
          if (checkCoinCollect(coin)) {
            coin.collected = true;
            game.coins++;
            game.score += 50;
            if (audioRef.current) audioRef.current.playCoinSfx();
            for (let i = 0; i < 14; i++) {
              game.particles.push({
                x: game.playerScreenX, y: game.playerScreenY - 50,
                vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 7,
                life: 25, maxLife: 25, color: '#F59E0B', size: 3 + Math.random() * 2,
              });
            }
          }
        }

        for (const p of game.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; }
        game.particles = game.particles.filter(p => p.life > 0);
        setLiveScore(game.score); setLiveCoins(game.coins); setLiveDistance(Math.floor(game.distance));
      }

      if (game.flashTimer > 0) game.flashTimer--;

      drawEnvironment(w, h);

      const sortedObs = [...game.obstacles].sort((a, b) => b.z - a.z);
      const sortedCoins = [...game.stzCoins].sort((a, b) => b.z - a.z);

      for (const obs of sortedObs) if (obs.z > PLAYER_Z) drawObstacle(obs, w, h);
      for (const coin of sortedCoins) if (coin.z > PLAYER_Z) drawCoin(coin, w, h);

      if (game.alive || game.flashTimer > 0) drawPlayerSprite(w, h);

      for (const obs of sortedObs) if (obs.z <= PLAYER_Z) drawObstacle(obs, w, h);
      for (const coin of sortedCoins) if (coin.z <= PLAYER_Z) drawCoin(coin, w, h);
      drawParticles();

      if (game.flashTimer > 0 && game.flashTimer % 2 === 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${game.flashTimer / 14})`;
        ctx.fillRect(0, 0, w, h);
      }

      animRef.current = requestAnimationFrame(gameLoop);
    };

    animRef.current = requestAnimationFrame(gameLoop);

    return () => {
      stoppedRef.current = true;
      if (audioRef.current) audioRef.current.stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animRef.current);
    };
  }, [gameState, sessionId, selectedSkin, imagesLoaded]);

  const handleLogin = () => {
    if (!username.trim()) return;
    localStorage.setItem('stz_runner_username', username.trim());
    fetchLeaderboard();
    if (isFirstTime) {
      setTutorialTimer(10);
      setGameState('tutorial');
    } else {
      setGameState('prerun');
    }
  };

  const handleBack = () => {
    stoppedRef.current = true;
    cancelAnimationFrame(animRef.current);
    if (audioRef.current) audioRef.current.stop();
    setShowDeathOverlay(false);
    setGameState('prerun');
  };

  useEffect(() => {
    if (gameState !== 'tutorial') return;
    if (tutorialTimer <= 0) { setGameState('prerun'); return; }
    const timer = setInterval(() => {
      setTutorialTimer(prev => {
        if (prev <= 1) { clearInterval(timer); setGameState('prerun'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, tutorialTimer]);

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem('stz_runner_sound', String(newVal));
    if (audioRef.current) audioRef.current.toggle();
  };

  if (gameState === 'login') {
    return (
      <div className="min-h-screen bg-[#050010] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#EF4444] to-[#7C3AED] rounded-2xl flex items-center justify-center shadow-lg shadow-[#EF4444]/30">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-heading font-bold tracking-wider">
              <span className="text-[#00E5FF]">$STZ</span> <span className="text-white">RUNNER</span>
            </h1>
            <p className="text-gray-500 text-sm">3-Lane Cyberpunk Endless Runner</p>
          </div>
          <div className="space-y-3">
            <input type="text" placeholder="Enter your username..."
              value={username} onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-center text-lg focus:border-[#00E5FF] focus:outline-none"
              maxLength={20} />
            <button onClick={handleLogin} disabled={!username.trim()}
              className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-xl font-bold text-lg disabled:opacity-30">
              ENTER
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'tutorial') {
    const tips = [
      { icon: <ChevronLeft className="w-7 h-7" />, text: 'Swipe LEFT to dodge obstacles' },
      { icon: <ChevronRight className="w-7 h-7" />, text: 'Swipe RIGHT to change lanes' },
      { icon: <ChevronUp className="w-7 h-7" />, text: 'Swipe UP or TAP to jump' },
      { icon: <Sparkles className="w-7 h-7 text-[#F59E0B]" />, text: 'Collect $STZ coins for bonus points' },
    ];
    return (
      <div className="min-h-screen bg-[#050010] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex items-center justify-between px-2">
            <div className="text-xs text-gray-500 uppercase tracking-widest">How to Play</div>
            <div className="text-sm font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2.5 py-0.5 rounded-lg">{tutorialTimer}s</div>
          </div>
          <h2 className="text-2xl font-heading font-bold"><span className="text-[#00E5FF]">$STZ</span> RUNNER</h2>
          <div className="space-y-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-[#00E5FF] flex-shrink-0">{tip.icon}</div>
                <p className="text-sm text-left text-gray-300">{tip.text}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setGameState('prerun')} className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-xl font-bold text-base">
            SKIP & PLAY
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'prerun') {
    const skinLocked = (skin: SkinData) => !unlockedSkins.includes(skin.id);
    return (
      <div className="min-h-screen bg-[#050010] p-4">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setGameState('login')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-heading font-bold tracking-wider"><span className="text-[#00E5FF]">$STZ</span> RUNNER</h1>
            <button onClick={() => { fetchLeaderboard(); setGameState('leaderboard'); }} className="p-2 hover:bg-white/10 rounded-lg"><Trophy className="w-5 h-5 text-[#F59E0B]" /></button>
          </div>

          <div className="relative mb-4 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0a0020] to-[#050010] border border-white/5">
            <div className="flex justify-center py-6">
              {SKINS[selectedSkin] && (
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-3xl opacity-20" style={{ background: SKINS[selectedSkin].glowColor }} />
                  <img src={SKINS[selectedSkin].image} alt={SKINS[selectedSkin].name}
                    className="w-36 h-44 object-contain relative z-10 drop-shadow-2xl" style={{ mixBlendMode: 'screen' }} />
                </div>
              )}
            </div>
            <div className="text-center pb-4">
              <p className="font-bold text-sm">{SKINS[selectedSkin].name}</p>
              <p className="text-xs font-semibold" style={{ color: SKINS[selectedSkin].rarityColor }}>{SKINS[selectedSkin].rarity}</p>
            </div>
          </div>

          <button onClick={startGame} disabled={!imagesLoaded}
            className="w-full py-4 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-[#EF4444]/20 mb-4 active:scale-95 transition-transform disabled:opacity-50">
            {imagesLoaded ? <><Play className="w-6 h-6" fill="white" /> RUN</> : <><RotateCcw className="w-5 h-5 animate-spin" /> Loading...</>}
          </button>

          <div className="flex gap-1 mb-3 bg-[#111827] rounded-xl p-1">
            {(['skins', 'rewards', 'settings'] as const).map(tab => (
              <button key={tab} onClick={() => setPrerunTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize flex items-center justify-center gap-1.5 transition-all ${prerunTab === tab ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
                {tab === 'skins' && <Palette className="w-3.5 h-3.5" />}
                {tab === 'rewards' && <Gift className="w-3.5 h-3.5" />}
                {tab === 'settings' && <SettingsIcon className="w-3.5 h-3.5" />}
                {tab}
              </button>
            ))}
          </div>

          {prerunTab === 'skins' && (
            <div className="space-y-2">
              {SKINS.map((s, idx) => {
                const locked = skinLocked(s);
                return (
                  <button key={s.id}
                    onClick={() => { if (!locked) { setSelectedSkin(idx); localStorage.setItem('stz_runner_skin', idx.toString()); } }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedSkin === idx ? 'border-[#00E5FF]/50 bg-[#00E5FF]/5' : locked ? 'border-white/5 bg-white/3 opacity-60' : 'border-white/5 bg-white/5 hover:border-white/15'}`}>
                    <div className="relative w-12 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                      <img src={s.image} alt={s.name} className={`w-full h-full object-cover ${locked ? 'blur-sm brightness-50' : ''}`} style={!locked ? { mixBlendMode: 'screen' } : {}} />
                      {locked && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Lock className="w-4 h-4 text-gray-400" /></div>}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold">{s.name}</p>
                      <p className="text-[10px] font-semibold" style={{ color: s.rarityColor }}>{s.rarity}</p>
                      {locked && <p className="text-[10px] text-gray-500">Unlock at {s.unlockScore.toLocaleString()} pts</p>}
                    </div>
                    {selectedSkin === idx && !locked && <span className="text-[9px] text-[#00E5FF] border border-[#00E5FF]/30 px-2 py-0.5 rounded font-semibold">ACTIVE</span>}
                  </button>
                );
              })}
            </div>
          )}

          {prerunTab === 'rewards' && (
            <div className="space-y-2">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-3">
                <p className="text-xs text-gray-400 mb-1">Your Best Score</p>
                <p className="text-xl font-bold text-[#00E5FF] font-mono">{personalBestScore.toLocaleString()}</p>
              </div>
              {MILESTONE_REWARDS.map((m, i) => {
                const achieved = personalBestScore >= m.score;
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${achieved ? 'border-[#10B981]/30 bg-[#10B981]/5' : 'border-white/5 bg-white/5'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${achieved ? 'bg-[#10B981]/20' : 'bg-white/5'}`}>
                      {m.type === 'coin' && <Sparkles className={`w-4 h-4 ${achieved ? 'text-[#10B981]' : 'text-gray-500'}`} />}
                      {m.type === 'skin' && (achieved ? <Unlock className="w-4 h-4 text-[#10B981]" /> : <Lock className="w-4 h-4 text-gray-500" />)}
                      {m.type === 'badge' && <Crown className={`w-4 h-4 ${achieved ? 'text-[#F59E0B]' : 'text-gray-500'}`} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold">{m.label}</p>
                      <p className="text-[10px] text-gray-500">{m.reward}</p>
                    </div>
                    {achieved ? (
                      <span className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1"><Star className="w-3 h-3" /> Done</span>
                    ) : (
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 font-mono">{Math.min(100, Math.floor((personalBestScore / m.score) * 100))}%</span>
                        <div className="w-12 h-1 bg-white/10 rounded-full mt-0.5 overflow-hidden">
                          <div className="h-full bg-[#00E5FF] rounded-full" style={{ width: `${Math.min(100, (personalBestScore / m.score) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {prerunTab === 'settings' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-[#00E5FF]" />
                  <span className="text-sm">Music & SFX</span>
                </div>
                <button onClick={toggleSound}
                  className={`w-10 h-5 rounded-full transition-all ${soundEnabled ? 'bg-[#00E5FF]' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2"><Info className="w-4 h-4 text-gray-400" /><span className="text-sm">Controls</span></div>
                <span className="text-[10px] text-gray-500">Swipe / Tap</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-xs text-gray-400 mb-1">Player</p>
                <p className="text-sm font-semibold">{username}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-xs text-gray-400 mb-1">Best Score</p>
                <p className="text-sm font-semibold text-[#00E5FF] font-mono">{personalBestScore.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="text-center text-gray-600 text-[10px] mt-4 space-y-0.5">
            <p>← → Swipe or arrows to switch lanes</p>
            <p>↑ Swipe up / tap / space to jump</p>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <div className="min-h-screen bg-[#050010] p-4">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setGameState('prerun')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-xl font-heading font-bold">LEADERBOARD</h1>
            <button onClick={fetchLeaderboard} className="p-2 hover:bg-white/10 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
              <p className="text-lg font-bold text-[#00E5FF]">{stats.totalPlayers}</p><p className="text-[10px] text-gray-500">Players</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
              <p className="text-lg font-bold text-[#F59E0B]">{stats.highestScore.toLocaleString()}</p><p className="text-[10px] text-gray-500">Top Score</p>
            </div>
          </div>
          <div className="space-y-2">
            {leaderboard.length === 0 && (
              <div className="text-center py-8 text-gray-500"><Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" /><p className="text-sm">No scores yet. Be the first!</p></div>
            )}
            {leaderboard.map((entry, idx) => (
              <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-xl border ${entry.username === username ? 'border-[#00E5FF]/50 bg-[#00E5FF]/5' : 'border-white/5 bg-white/5'}`}>
                <div className="w-8 text-center font-bold">
                  {idx === 0 ? <Crown className="w-5 h-5 text-[#F59E0B] mx-auto" /> : idx === 1 ? <Medal className="w-5 h-5 text-gray-300 mx-auto" /> : idx === 2 ? <Medal className="w-5 h-5 text-amber-600 mx-auto" /> : <span className="text-gray-500 text-sm">#{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{entry.username}</p><p className="text-[10px] text-gray-500">{entry.gamesPlayed} games</p></div>
                <div className="text-right"><p className="font-bold text-sm text-[#00E5FF]">{entry.score.toLocaleString()}</p><p className="text-[10px] text-gray-500">{entry.coins} $STZ</p></div>
              </div>
            ))}
          </div>
          <button onClick={startGame} className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-xl font-bold">PLAY NOW</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="w-full h-full" style={{ touchAction: 'none' }} />
      <div className="absolute top-0 left-0 right-0 z-10 p-3 flex items-start justify-between pointer-events-none">
        <button onClick={handleBack} className="pointer-events-auto p-2 bg-black/60 backdrop-blur-sm rounded-xl border border-white/10"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex gap-1.5">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 px-2.5 py-1 text-center">
            <p className="text-[7px] text-gray-400 uppercase tracking-wider">Score</p>
            <p className="text-sm font-bold text-[#00E5FF] font-mono">{liveScore.toLocaleString()}</p>
          </div>
          <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 px-2.5 py-1 text-center">
            <p className="text-[7px] text-gray-400 uppercase tracking-wider">$STZ</p>
            <p className="text-sm font-bold text-[#F59E0B] font-mono">{liveCoins}</p>
          </div>
          <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 px-2.5 py-1 text-center">
            <p className="text-[7px] text-gray-400 uppercase tracking-wider">Dist</p>
            <p className="text-sm font-bold font-mono">{liveDistance}m</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center gap-3 pointer-events-none">
        <button onClick={() => { if (gameRef.current?.alive && gameRef.current.targetLane > 0) gameRef.current.targetLane--; }}
          className="pointer-events-auto w-16 h-16 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 flex items-center justify-center active:bg-white/20 active:scale-90 transition-all">
          <ChevronLeft className="w-8 h-8 text-white/70" />
        </button>
        <button onClick={() => { if (gameRef.current?.alive && !gameRef.current.jumping) { gameRef.current.jumping = true; gameRef.current.jumpVel = 14; } }}
          className="pointer-events-auto w-16 h-16 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 flex items-center justify-center active:bg-white/20 active:scale-90 transition-all">
          <ChevronUp className="w-8 h-8 text-white/70" />
        </button>
        <button onClick={() => { if (gameRef.current?.alive && gameRef.current.targetLane < LANE_COUNT - 1) gameRef.current.targetLane++; }}
          className="pointer-events-auto w-16 h-16 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 flex items-center justify-center active:bg-white/20 active:scale-90 transition-all">
          <ChevronRight className="w-8 h-8 text-white/70" />
        </button>
      </div>

      {showDeathOverlay && (
        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0E1A] border border-white/10 rounded-2xl p-6 w-full max-w-xs space-y-4 text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#EF4444] to-[#7C3AED] rounded-2xl flex items-center justify-center"><Target className="w-8 h-8 text-white" /></div>
            <h2 className="text-2xl font-heading font-bold">CRASHED!</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-xl p-2"><p className="text-[10px] text-gray-400">Score</p><p className="font-bold text-[#00E5FF]">{finalScore.toLocaleString()}</p></div>
              <div className="bg-white/5 rounded-xl p-2"><p className="text-[10px] text-gray-400">$STZ</p><p className="font-bold text-[#F59E0B]">{finalCoins}</p></div>
              <div className="bg-white/5 rounded-xl p-2"><p className="text-[10px] text-gray-400">Distance</p><p className="font-bold">{finalDistance}m</p></div>
            </div>
            {rank > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-[#F59E0B]" /><span>Rank #{rank}</span>
                <span className="text-gray-600">|</span><span className="text-gray-400">Best: {personalBest.toLocaleString()}</span>
              </div>
            )}
            <div className="space-y-2">
              <button onClick={startGame} className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-xl font-bold flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" /> RUN AGAIN
              </button>
              <button onClick={handleBack} className="w-full py-3 bg-white/5 border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10">
                <Home className="w-4 h-4" /> HOME
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
