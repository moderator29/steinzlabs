'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, Medal, Play, ArrowLeft,
  Crown, Zap, Target, RefreshCw,
  Home, RotateCcw, ChevronLeft, ChevronRight, ChevronUp
} from 'lucide-react';

interface LeaderboardEntry {
  id: string; username: string; score: number; coins: number;
  distance: number; gamesPlayed: number; bestStreak: number; timestamp: number;
  character: string;
}

interface CharacterSkin {
  id: string;
  name: string;
  rarity: string;
  rarityColor: string;
  bodyColor: string;
  accentColor: string;
  glowColor: string;
  helmetColor: string;
  visorColor: string;
  locked: boolean;
}

const CHARACTERS: CharacterSkin[] = [
  { id: 'cyber-warrior', name: 'Cyber Warrior', rarity: 'Common', rarityColor: '#9CA3AF', bodyColor: '#1a2744', accentColor: '#00E5FF', glowColor: '#00E5FF', helmetColor: '#0f1a2e', visorColor: '#00E5FF', locked: false },
  { id: 'shadow-runner', name: 'Shadow Runner', rarity: 'Rare', rarityColor: '#3B82F6', bodyColor: '#111827', accentColor: '#3B82F6', glowColor: '#60A5FA', helmetColor: '#0a0f1a', visorColor: '#60A5FA', locked: false },
  { id: 'gollden', name: 'Gollden', rarity: 'Epic', rarityColor: '#A855F7', bodyColor: '#5c3d0e', accentColor: '#F59E0B', glowColor: '#FCD34D', helmetColor: '#3d2706', visorColor: '#FCD34D', locked: false },
  { id: 'golden-node', name: 'Golden Node', rarity: 'Epic', rarityColor: '#A855F7', bodyColor: '#4a2a08', accentColor: '#FB923C', glowColor: '#FDBA74', helmetColor: '#3a1f05', visorColor: '#FDBA74', locked: false },
  { id: 'inferno-guard', name: 'Inferno Guard', rarity: 'Rare+', rarityColor: '#EF4444', bodyColor: '#450a0a', accentColor: '#EF4444', glowColor: '#FCA5A5', helmetColor: '#2d0606', visorColor: '#EF4444', locked: false },
  { id: 'vertex-specter', name: 'Vertex Specter', rarity: 'Legendary', rarityColor: '#F59E0B', bodyColor: '#1e1645', accentColor: '#8B5CF6', glowColor: '#C4B5FD', helmetColor: '#130e30', visorColor: '#A78BFA', locked: false },
];

const LANE_COUNT = 3;

interface Obstacle {
  lane: number; z: number; type: 'laser' | 'drone' | 'floor';
  passed: boolean;
}

interface StzCoin {
  lane: number; z: number; collected: boolean; bobPhase: number;
}

interface RunParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

export default function STZRunnerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'login' | 'charselect' | 'playing' | 'gameover' | 'leaderboard'>('login');
  const [username, setUsername] = useState('');
  const [selectedChar, setSelectedChar] = useState(0);
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
  const gameRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const stoppedRef = useRef(false);
  const scoreSubmittedRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('stz_runner_username');
    if (saved) setUsername(saved);
    const savedChar = localStorage.getItem('stz_runner_char');
    if (savedChar) setSelectedChar(parseInt(savedChar) || 0);
  }, []);

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
    try {
      const res = await fetch('/api/wgm-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score, coins, distance, character: CHARACTERS[selectedChar].id }),
      });
      const data = await res.json();
      setRank(data.rank);
      setPersonalBest(data.personalBest);
    } catch {}
  };

  const startGame = useCallback(() => {
    stoppedRef.current = false;
    scoreSubmittedRef.current = false;
    setShowDeathOverlay(false);
    setSessionId(prev => prev + 1);
    setGameState('playing');
  }, []);

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

    const character = CHARACTERS[selectedChar];
    const VP_Y = 0.22;
    const GROUND_Y = 0.82;
    const MAX_Z = 1500;
    const PLAYER_Z = 80;

    const game = {
      playerLane: 1,
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
    };
    gameRef.current = game;

    const getScale = (z: number) => {
      return Math.max(0.02, 1 - z / MAX_Z);
    };

    const getScreenY = (z: number, h: number) => {
      const vpY = h * VP_Y;
      const gndY = h * GROUND_Y;
      const s = getScale(z);
      return vpY + (gndY - vpY) * s;
    };

    const getLaneX = (lane: number, z: number, w: number) => {
      const s = getScale(z);
      const laneW = w * 0.20 * s;
      const totalW = laneW * LANE_COUNT;
      const cx = w / 2;
      return cx - totalW / 2 + laneW * lane + laneW / 2;
    };

    const spawnObstacle = () => {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const types: ('laser' | 'drone' | 'floor')[] = ['laser', 'drone', 'floor'];
      game.obstacles.push({ lane, z: MAX_Z, type: types[Math.floor(Math.random() * types.length)], passed: false });
    };

    const spawnCoin = () => {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      game.stzCoins.push({ lane, z: MAX_Z, collected: false, bobPhase: Math.random() * Math.PI * 2 });
    };

    let obstacleTimer = 0;
    let coinTimer = 0;

    const drawTunnel = (w: number, h: number) => {
      const vpY = h * VP_Y;
      const gndY = h * GROUND_Y;
      const cx = w / 2;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#050008');
      bg.addColorStop(0.3, '#0a0015');
      bg.addColorStop(0.7, '#080012');
      bg.addColorStop(1, '#020005');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 25; i++) {
        const depth = ((i * 60 + game.tunnelOffset) % MAX_Z);
        const s = getScale(depth);
        const y = getScreenY(depth, h);
        const halfW = w * 0.48 * s;
        const alpha = s * 0.12;

        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, y);
        ctx.lineTo(cx + halfW, y);
        ctx.stroke();
      }

      for (let lane = 0; lane <= LANE_COUNT; lane++) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
        ctx.lineWidth = 1;
        let first = true;
        for (let z = 0; z < MAX_Z; z += 30) {
          const s = getScale(z);
          const y = getScreenY(z, h);
          const laneW = w * 0.20 * s;
          const totalW = laneW * LANE_COUNT;
          const x = cx - totalW / 2 + laneW * lane;
          if (first) { ctx.moveTo(x, y); first = false; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 8; i++) {
          const depth = ((i * 180 + game.tunnelOffset * 1.3) % MAX_Z);
          const s = getScale(depth);
          const y = getScreenY(depth, h);
          const halfW = w * 0.50 * s;
          const x = cx + side * (halfW + 8 * s);
          const barH = 18 * s;
          const alpha = s * 0.5;

          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 10 * s;
          ctx.fillRect(x - 2 * s, y - barH / 2, 4 * s, barH);
          ctx.shadowBlur = 0;
        }
      }

      const floorG = ctx.createLinearGradient(0, gndY, 0, h);
      floorG.addColorStop(0, 'rgba(0, 229, 255, 0.02)');
      floorG.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = floorG;
      ctx.fillRect(0, gndY, w, h - gndY);
    };

    const drawMechWarrior = (x: number, baseY: number, s: number, char: CharacterSkin) => {
      const sz = 55 * s;
      const jy = game.jumpY * s;
      const y = baseY - jy;
      const legSwing = Math.sin(game.frame * 0.18) * sz * 0.08;

      ctx.save();
      ctx.shadowColor = char.glowColor;
      ctx.shadowBlur = 20 * s;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, baseY + 2, sz * 0.35, sz * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = char.bodyColor;
      ctx.fillRect(x - sz * 0.15, y - sz * 0.15 + legSwing, sz * 0.13, sz * 0.35);
      ctx.fillRect(x + sz * 0.02, y - sz * 0.15 - legSwing, sz * 0.13, sz * 0.35);
      ctx.fillStyle = char.accentColor;
      ctx.fillRect(x - sz * 0.16, y + sz * 0.15 + legSwing, sz * 0.15, sz * 0.04);
      ctx.fillRect(x + sz * 0.01, y + sz * 0.15 - legSwing, sz * 0.15, sz * 0.04);

      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      ctx.moveTo(x - sz * 0.30, y - sz * 0.50);
      ctx.lineTo(x + sz * 0.30, y - sz * 0.50);
      ctx.lineTo(x + sz * 0.22, y - sz * 0.10);
      ctx.lineTo(x - sz * 0.22, y - sz * 0.10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = char.accentColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x - sz * 0.30, y - sz * 0.50, sz * 0.60, sz * 0.04);
      ctx.globalAlpha = 1;

      ctx.fillStyle = char.accentColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x - sz * 0.04, y - sz * 0.48, sz * 0.08, sz * 0.30);
      ctx.globalAlpha = 1;

      ctx.shadowColor = char.glowColor;
      ctx.shadowBlur = 8 * s;
      ctx.fillStyle = char.accentColor;
      ctx.beginPath();
      ctx.arc(x, y - sz * 0.32, sz * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = char.bodyColor;
      ctx.fillRect(x - sz * 0.38, y - sz * 0.50, sz * 0.10, sz * 0.05);
      ctx.fillRect(x + sz * 0.28, y - sz * 0.50, sz * 0.10, sz * 0.05);
      ctx.fillStyle = char.accentColor;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x - sz * 0.38, y - sz * 0.46, sz * 0.10, sz * 0.02);
      ctx.fillRect(x + sz * 0.28, y - sz * 0.46, sz * 0.10, sz * 0.02);
      ctx.globalAlpha = 1;

      const armSwing = Math.sin(game.frame * 0.18) * sz * 0.06;
      ctx.fillStyle = char.bodyColor;
      ctx.fillRect(x - sz * 0.40, y - sz * 0.46 + armSwing, sz * 0.08, sz * 0.28);
      ctx.fillRect(x + sz * 0.32, y - sz * 0.46 - armSwing, sz * 0.08, sz * 0.28);
      ctx.fillStyle = char.accentColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x - sz * 0.41, y - sz * 0.30 + armSwing, sz * 0.10, sz * 0.03);
      ctx.fillRect(x + sz * 0.31, y - sz * 0.30 - armSwing, sz * 0.10, sz * 0.03);
      ctx.globalAlpha = 1;

      ctx.fillStyle = char.helmetColor;
      ctx.beginPath();
      ctx.ellipse(x, y - sz * 0.62, sz * 0.20, sz * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      ctx.moveTo(x - sz * 0.18, y - sz * 0.72);
      ctx.lineTo(x + sz * 0.18, y - sz * 0.72);
      ctx.lineTo(x + sz * 0.15, y - sz * 0.80);
      ctx.lineTo(x - sz * 0.15, y - sz * 0.80);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = char.visorColor;
      ctx.shadowBlur = 12 * s;
      const visorPulse = 0.7 + Math.sin(game.frame * 0.08) * 0.3;
      ctx.fillStyle = char.visorColor;
      ctx.globalAlpha = visorPulse;
      ctx.fillRect(x - sz * 0.14, y - sz * 0.66, sz * 0.28, sz * 0.05);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      ctx.fillStyle = char.accentColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x - sz * 0.02, y - sz * 0.78, sz * 0.04, sz * 0.10);
      ctx.globalAlpha = 1;

      ctx.restore();
    };

    const drawPlayer = (w: number, h: number) => {
      const s = getScale(PLAYER_Z);
      const x = getLaneX(game.playerLane, PLAYER_Z, w);
      const y = getScreenY(PLAYER_Z, h);
      game.playerScreenX = x;
      game.playerScreenY = y;
      drawMechWarrior(x, y, s, character);
    };

    const drawObstacle = (obs: Obstacle, w: number, h: number) => {
      const s = getScale(obs.z);
      const x = getLaneX(obs.lane, obs.z, w);
      const y = getScreenY(obs.z, h);
      const obsW = 50 * s;
      const obsH = 35 * s;

      ctx.save();
      if (obs.type === 'laser') {
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 15 * s;
        ctx.fillStyle = '#4a0e0e';
        ctx.fillRect(x - obsW / 2, y - obsH * 1.2, obsW * 0.12, obsH * 1.2);
        ctx.fillRect(x + obsW / 2 - obsW * 0.12, y - obsH * 1.2, obsW * 0.12, obsH * 1.2);
        const pulse = 0.5 + Math.sin(game.frame * 0.3) * 0.5;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.fillRect(x - obsW / 2, y - obsH * 0.5, obsW, obsH * 0.08);
        ctx.fillStyle = `rgba(252, 165, 165, ${pulse * 0.4})`;
        ctx.fillRect(x - obsW / 2 - 3, y - obsH * 0.5 - 3, obsW + 6, obsH * 0.14);
      } else if (obs.type === 'drone') {
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 12 * s;
        const dy = y - obsH * 1.5;
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.ellipse(x, dy, obsW * 0.3, obsH * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(x, dy - obsH * 0.08, obsW * 0.06, 0, Math.PI * 2);
        ctx.fill();
        const prop = game.frame * 0.6;
        ctx.strokeStyle = '#6B7280';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(x - obsW * 0.4 * Math.cos(prop), dy - obsH * 0.25);
        ctx.lineTo(x + obsW * 0.4 * Math.cos(prop), dy - obsH * 0.25);
        ctx.stroke();
      } else {
        ctx.shadowColor = '#7C3AED';
        ctx.shadowBlur = 8 * s;
        const pulse = 0.25 + Math.sin(game.frame * 0.2) * 0.15;
        ctx.fillStyle = `rgba(124, 58, 237, ${pulse})`;
        ctx.fillRect(x - obsW / 2, y - obsH * 0.10, obsW, obsH * 0.10);
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(x - obsW / 2 + i * obsW * 0.28, y - obsH * 0.10, obsW * 0.18, obsH * 0.04);
        }
      }
      ctx.restore();
    };

    const drawCoin = (coin: StzCoin, w: number, h: number) => {
      if (coin.collected) return;
      const s = getScale(coin.z);
      const x = getLaneX(coin.lane, coin.z, w);
      const y = getScreenY(coin.z, h);
      const bob = Math.sin(coin.bobPhase + game.frame * 0.08) * 6 * s;
      const cy = y - 28 * s + bob;
      const r = 12 * s;

      ctx.save();
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 14 * s;
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FCD34D';
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350F';
      ctx.font = `bold ${r * 1.2}px monospace`;
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
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    };

    const checkCollision = (obs: Obstacle): boolean => {
      if (obs.lane !== game.playerLane) return false;
      if (obs.z > PLAYER_Z - 20 && obs.z < PLAYER_Z + 40) {
        if (obs.type === 'drone' && game.jumpY > 35) return false;
        if (obs.type === 'floor' && game.jumpY > 18) return false;
        return true;
      }
      return false;
    };

    const checkCoinCollect = (coin: StzCoin): boolean => {
      if (coin.collected) return false;
      if (coin.lane !== game.playerLane) return false;
      return coin.z > PLAYER_Z - 25 && coin.z < PLAYER_Z + 50;
    };

    const spawnDeathParticles = () => {
      for (let i = 0; i < 40; i++) {
        game.particles.push({
          x: game.playerScreenX, y: game.playerScreenY - 30,
          vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
          life: 35 + Math.random() * 25, maxLife: 60,
          color: Math.random() > 0.5 ? '#EF4444' : '#FCA5A5',
          size: 2 + Math.random() * 5,
        });
      }
    };

    let touchStartX = 0;
    let touchStartY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!game.alive) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        if (game.playerLane > 0) game.playerLane--;
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (game.playerLane < LANE_COUNT - 1) game.playerLane++;
      } else if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !game.jumping) {
        game.jumping = true;
        game.jumpVel = 14;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!game.alive) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        if (!game.jumping) { game.jumping = true; game.jumpVel = 14; }
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -25 && game.playerLane > 0) game.playerLane--;
        else if (dx > 25 && game.playerLane < LANE_COUNT - 1) game.playerLane++;
      } else if (dy < -25 && !game.jumping) {
        game.jumping = true; game.jumpVel = 14;
      }
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
        game.tunnelOffset = (game.tunnelOffset + game.speed * 2.5) % MAX_Z;
        game.distance += game.speed * 0.025;
        game.score += Math.floor(game.speed * 0.6);

        if (game.jumping) {
          game.jumpY += game.jumpVel;
          game.jumpVel -= 0.7;
          if (game.jumpY <= 0) { game.jumpY = 0; game.jumping = false; game.jumpVel = 0; }
        }

        if (game.graceFrames > 0) { game.graceFrames--; }
        else {
          obstacleTimer++;
          if (obstacleTimer > Math.max(30, 75 - game.distance * 0.12)) {
            spawnObstacle();
            obstacleTimer = 0;
          }
        }

        coinTimer++;
        if (coinTimer > 40) { spawnCoin(); coinTimer = 0; }

        for (const obs of game.obstacles) obs.z -= game.speed * 4;
        for (const coin of game.stzCoins) coin.z -= game.speed * 4;

        game.obstacles = game.obstacles.filter(o => o.z > -200);
        game.stzCoins = game.stzCoins.filter(c => c.z > -200);

        if (game.graceFrames <= 0) {
          for (const obs of game.obstacles) {
            if (!obs.passed && checkCollision(obs)) {
              game.alive = false;
              game.flashTimer = 12;
              spawnDeathParticles();
              const fs = game.score, fc = game.coins, fd = Math.floor(game.distance);
              setFinalScore(fs); setFinalCoins(fc); setFinalDistance(fd);
              submitScore(fs, fc, fd);
              setTimeout(() => setShowDeathOverlay(true), 500);
              break;
            }
          }
        }

        for (const coin of game.stzCoins) {
          if (checkCoinCollect(coin)) {
            coin.collected = true;
            game.coins++;
            game.score += 50;
            for (let i = 0; i < 10; i++) {
              game.particles.push({
                x: game.playerScreenX, y: game.playerScreenY - 35,
                vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5,
                life: 22, maxLife: 22, color: '#F59E0B', size: 3,
              });
            }
          }
        }

        for (const p of game.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; }
        game.particles = game.particles.filter(p => p.life > 0);

        setLiveScore(game.score); setLiveCoins(game.coins); setLiveDistance(Math.floor(game.distance));
      }

      if (game.flashTimer > 0) game.flashTimer--;

      drawTunnel(w, h);

      const sortedObs = [...game.obstacles].sort((a, b) => b.z - a.z);
      const sortedCoins = [...game.stzCoins].sort((a, b) => b.z - a.z);

      for (const obs of sortedObs) if (obs.z > PLAYER_Z) drawObstacle(obs, w, h);
      for (const coin of sortedCoins) if (coin.z > PLAYER_Z) drawCoin(coin, w, h);

      if (game.alive || game.flashTimer > 0) drawPlayer(w, h);

      for (const obs of sortedObs) if (obs.z <= PLAYER_Z) drawObstacle(obs, w, h);
      for (const coin of sortedCoins) if (coin.z <= PLAYER_Z) drawCoin(coin, w, h);

      drawParticles();

      if (game.flashTimer > 0 && game.flashTimer % 2 === 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${game.flashTimer / 12})`;
        ctx.fillRect(0, 0, w, h);
      }

      animRef.current = requestAnimationFrame(gameLoop);
    };

    animRef.current = requestAnimationFrame(gameLoop);

    return () => {
      stoppedRef.current = true;
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animRef.current);
    };
  }, [gameState, sessionId, selectedChar]);

  const handleLogin = () => {
    if (!username.trim()) return;
    localStorage.setItem('stz_runner_username', username.trim());
    fetchLeaderboard();
    setGameState('charselect');
  };

  const handleBack = () => {
    stoppedRef.current = true;
    cancelAnimationFrame(animRef.current);
    setShowDeathOverlay(false);
    setGameState('charselect');
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
              <span className="text-[#00E5FF]">STZ</span> <span className="text-white">RUNNER</span>
            </h1>
            <p className="text-gray-500 text-sm">3-Lane Cyberpunk Endless Runner</p>
          </div>
          <div className="space-y-3">
            <input
              type="text" placeholder="Enter your username..."
              value={username} onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-center text-lg focus:border-[#00E5FF] focus:outline-none"
              maxLength={20}
            />
            <button onClick={handleLogin} disabled={!username.trim()}
              className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-xl font-bold text-lg disabled:opacity-30">
              ENTER
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'charselect') {
    return (
      <div className="min-h-screen bg-[#050010] p-4">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setGameState('login')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-xl font-heading font-bold tracking-wider">
              <span className="text-[#00E5FF]">STZ</span> RUNNER
            </h1>
            <button onClick={() => { fetchLeaderboard(); setGameState('leaderboard'); }} className="p-2 hover:bg-white/10 rounded-lg">
              <Trophy className="w-5 h-5 text-[#F59E0B]" />
            </button>
          </div>

          <p className="text-center text-gray-500 text-xs uppercase tracking-widest">Select Character</p>

          <div className="grid grid-cols-3 gap-2">
            {CHARACTERS.map((char, idx) => (
              <button key={char.id} onClick={() => { if (!char.locked) { setSelectedChar(idx); localStorage.setItem('stz_runner_char', idx.toString()); } }}
                className={`relative p-3 rounded-xl border transition-all ${
                  selectedChar === idx ? 'border-[#00E5FF] bg-[#00E5FF]/5 ring-1 ring-[#00E5FF]/30' : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}>
                <div className="w-12 h-16 mx-auto mb-2 relative flex items-end justify-center">
                  <div className="w-10 h-14 rounded-md relative overflow-hidden"
                    style={{ background: `linear-gradient(180deg, ${char.helmetColor}, ${char.bodyColor})`, boxShadow: `0 0 12px ${char.glowColor}30` }}>
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-4 rounded-full" style={{ background: char.helmetColor, border: `1px solid ${char.accentColor}40` }} />
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full" style={{ background: char.visorColor, boxShadow: `0 0 6px ${char.visorColor}` }} />
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: char.accentColor, boxShadow: `0 0 4px ${char.accentColor}` }} />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-6 rounded-t-sm" style={{ background: char.bodyColor, borderTop: `1px solid ${char.accentColor}30` }} />
                  </div>
                  <div className="absolute -bottom-0.5 w-8 h-1 rounded-full" style={{ background: `radial-gradient(ellipse, ${char.glowColor}40, transparent)` }} />
                </div>
                <p className="text-[10px] font-bold text-center truncate">{char.name}</p>
                <p className="text-[9px] text-center font-semibold" style={{ color: char.rarityColor }}>{char.rarity}</p>
              </button>
            ))}
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-14 rounded-lg" style={{ background: `linear-gradient(180deg, ${CHARACTERS[selectedChar].helmetColor}, ${CHARACTERS[selectedChar].bodyColor})`, boxShadow: `0 0 15px ${CHARACTERS[selectedChar].glowColor}30` }} />
              <div>
                <p className="font-bold text-sm">{CHARACTERS[selectedChar].name}</p>
                <p className="text-xs" style={{ color: CHARACTERS[selectedChar].rarityColor }}>{CHARACTERS[selectedChar].rarity}</p>
              </div>
              <span className="ml-auto text-[10px] text-[#00E5FF] border border-[#00E5FF]/30 px-2 py-0.5 rounded">SELECTED</span>
            </div>
            <button onClick={startGame}
              className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-[#EF4444]/20">
              <Play className="w-5 h-5" fill="white" /> RUN
            </button>
          </div>

          <div className="text-center text-gray-600 text-[10px] space-y-0.5">
            <p>← → Swipe or arrows to switch lanes</p>
            <p>↑ Swipe up / tap / space to jump</p>
            <p>Collect $STZ coins for bonus points</p>
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
            <button onClick={() => setGameState('charselect')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-xl font-heading font-bold">LEADERBOARD</h1>
            <button onClick={fetchLeaderboard} className="p-2 hover:bg-white/10 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
              <p className="text-lg font-bold text-[#00E5FF]">{stats.totalPlayers}</p>
              <p className="text-[10px] text-gray-500">Players</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
              <p className="text-lg font-bold text-[#F59E0B]">{stats.highestScore.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Top Score</p>
            </div>
          </div>
          <div className="space-y-2">
            {leaderboard.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No scores yet. Be the first!</p>
              </div>
            )}
            {leaderboard.map((entry, idx) => (
              <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-lg border ${entry.username === username ? 'border-[#00E5FF]/50 bg-[#00E5FF]/5' : 'border-white/5 bg-white/5'}`}>
                <div className="w-8 text-center font-bold">
                  {idx === 0 ? <Crown className="w-5 h-5 text-[#F59E0B] mx-auto" /> :
                   idx === 1 ? <Medal className="w-5 h-5 text-gray-300 mx-auto" /> :
                   idx === 2 ? <Medal className="w-5 h-5 text-amber-600 mx-auto" /> :
                   <span className="text-gray-500 text-sm">#{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{entry.username}</p>
                  <p className="text-[10px] text-gray-500">{entry.gamesPlayed} games</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-[#00E5FF]">{entry.score.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">{entry.coins} STZ</p>
                </div>
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
        <button onClick={handleBack} className="pointer-events-auto p-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 px-2.5 py-1 text-center">
            <p className="text-[8px] text-gray-400 uppercase tracking-wider">Score</p>
            <p className="text-sm font-bold text-[#00E5FF] font-mono">{liveScore.toLocaleString()}</p>
          </div>
          <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 px-2.5 py-1 text-center">
            <p className="text-[8px] text-gray-400 uppercase tracking-wider">$STZ</p>
            <p className="text-sm font-bold text-[#F59E0B] font-mono">{liveCoins}</p>
          </div>
          <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 px-2.5 py-1 text-center">
            <p className="text-[8px] text-gray-400 uppercase tracking-wider">Dist</p>
            <p className="text-sm font-bold font-mono">{liveDistance}m</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center gap-3 pointer-events-none">
        <button onClick={() => { if (gameRef.current?.alive && gameRef.current.playerLane > 0) gameRef.current.playerLane--; }}
          className="pointer-events-auto w-16 h-16 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 flex items-center justify-center active:bg-white/20 active:scale-95 transition-all">
          <ChevronLeft className="w-8 h-8 text-white/70" />
        </button>
        <button onClick={() => { if (gameRef.current?.alive && !gameRef.current.jumping) { gameRef.current.jumping = true; gameRef.current.jumpVel = 14; } }}
          className="pointer-events-auto w-16 h-16 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 flex items-center justify-center active:bg-white/20 active:scale-95 transition-all">
          <ChevronUp className="w-8 h-8 text-white/70" />
        </button>
        <button onClick={() => { if (gameRef.current?.alive && gameRef.current.playerLane < LANE_COUNT - 1) gameRef.current.playerLane++; }}
          className="pointer-events-auto w-16 h-16 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 flex items-center justify-center active:bg-white/20 active:scale-95 transition-all">
          <ChevronRight className="w-8 h-8 text-white/70" />
        </button>
      </div>

      {showDeathOverlay && (
        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0E1A] border border-white/10 rounded-2xl p-6 w-full max-w-xs space-y-4 text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#EF4444] to-[#7C3AED] rounded-2xl flex items-center justify-center">
              <Target className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-heading font-bold">CRASHED!</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-[10px] text-gray-400">Score</p>
                <p className="font-bold text-[#00E5FF]">{finalScore.toLocaleString()}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-[10px] text-gray-400">$STZ</p>
                <p className="font-bold text-[#F59E0B]">{finalCoins}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-[10px] text-gray-400">Distance</p>
                <p className="font-bold">{finalDistance}m</p>
              </div>
            </div>
            {rank > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-[#F59E0B]" />
                <span>Rank #{rank}</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">Best: {personalBest.toLocaleString()}</span>
              </div>
            )}
            <div className="space-y-2">
              <button onClick={startGame}
                className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#7C3AED] rounded-xl font-bold flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" /> RUN AGAIN
              </button>
              <button onClick={handleBack}
                className="w-full py-3 bg-white/5 border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10">
                <Home className="w-4 h-4" /> HOME
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
