'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, Medal, Star, Play, ArrowLeft, Users, Gamepad2,
  Crown, Zap, Heart, Flame, Target, RefreshCw, Volume2, VolumeX,
  Home, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, Lock
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
  locked: boolean;
}

const CHARACTERS: CharacterSkin[] = [
  { id: 'cyber-warrior', name: 'Cyber Warrior', rarity: 'Common', rarityColor: '#9CA3AF', bodyColor: '#1E40AF', accentColor: '#3B82F6', glowColor: '#60A5FA', helmetColor: '#1E3A5F', locked: false },
  { id: 'shadow-runner', name: 'Shadow Runner', rarity: 'Rare', rarityColor: '#3B82F6', bodyColor: '#1F2937', accentColor: '#6B7280', glowColor: '#9CA3AF', helmetColor: '#111827', locked: false },
  { id: 'gollden', name: 'Gollden', rarity: 'Epic', rarityColor: '#A855F7', bodyColor: '#92400E', accentColor: '#F59E0B', glowColor: '#FCD34D', helmetColor: '#78350F', locked: false },
  { id: 'golden-node', name: 'Golden Node', rarity: 'Epic', rarityColor: '#A855F7', bodyColor: '#7C2D12', accentColor: '#FB923C', glowColor: '#FDBA74', helmetColor: '#9A3412', locked: false },
  { id: 'inferno-guard', name: 'Inferno Guard', rarity: 'Rare+', rarityColor: '#EF4444', bodyColor: '#7F1D1D', accentColor: '#EF4444', glowColor: '#FCA5A5', helmetColor: '#991B1B', locked: false },
  { id: 'vertex-specter', name: 'Vertex Specter', rarity: 'Legendary', rarityColor: '#F59E0B', bodyColor: '#312E81', accentColor: '#8B5CF6', glowColor: '#C4B5FD', helmetColor: '#4C1D95', locked: false },
];

const LANE_COUNT = 3;
const LANE_WIDTH_RATIO = 0.22;

interface Obstacle {
  lane: number; z: number; type: 'laser' | 'drone' | 'floor';
  height: number; passed: boolean;
}

interface WgmCoin {
  lane: number; z: number; collected: boolean; bobPhase: number;
}

interface RunParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

export default function WGMRunnerPage() {
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
  const [loading, setLoading] = useState(false);
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
    const saved = localStorage.getItem('wgm_runner_username');
    if (saved) setUsername(saved);
    const savedChar = localStorage.getItem('wgm_runner_char');
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
    const GROUND_Y_RATIO = 0.78;
    const VANISHING_Y_RATIO = 0.32;
    const HORIZON_Y_RATIO = 0.3;

    const game = {
      playerLane: 1,
      targetLane: 1,
      playerX: 0,
      playerY: 0,
      jumping: false,
      jumpVel: 0,
      jumpY: 0,
      speed: 4,
      score: 0,
      coins: 0,
      distance: 0,
      obstacles: [] as Obstacle[],
      wgmCoins: [] as WgmCoin[],
      particles: [] as RunParticle[],
      frame: 0,
      graceFrames: 120,
      tunnelOffset: 0,
      alive: true,
      flashTimer: 0,
    };
    gameRef.current = game;

    const spawnObstacle = () => {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const types: ('laser' | 'drone' | 'floor')[] = ['laser', 'drone', 'floor'];
      const type = types[Math.floor(Math.random() * types.length)];
      game.obstacles.push({ lane, z: 1200, type, height: type === 'drone' ? 40 : 30, passed: false });
    };

    const spawnCoin = () => {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      game.wgmCoins.push({ lane, z: 1200, collected: false, bobPhase: Math.random() * Math.PI * 2 });
    };

    const getLaneX = (lane: number, z: number, w: number) => {
      const perspective = Math.max(0.05, 1 - z / 1200);
      const centerX = w / 2;
      const laneW = w * LANE_WIDTH_RATIO * perspective;
      const totalW = laneW * LANE_COUNT;
      const startX = centerX - totalW / 2;
      return startX + laneW * lane + laneW / 2;
    };

    const getScale = (z: number) => Math.max(0.1, 1 - z / 1200);

    let obstacleTimer = 0;
    let coinTimer = 0;

    const drawTunnel = (w: number, h: number) => {
      const vanishY = h * VANISHING_Y_RATIO;
      const groundY = h * GROUND_Y_RATIO;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0015');
      grad.addColorStop(0.3, '#0d0020');
      grad.addColorStop(1, '#050010');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 20; i++) {
        const depth = ((i * 60 + game.tunnelOffset) % 1200);
        const scale = getScale(depth);
        const y = vanishY + (groundY - vanishY) * (1 - scale);
        const alpha = scale * 0.15;
        const centerX = w / 2;
        const halfW = w * 0.5 * scale;

        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - halfW, y);
        ctx.lineTo(centerX + halfW, y);
        ctx.stroke();
      }

      for (let lane = 0; lane <= LANE_COUNT; lane++) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let z = 0; z < 1200; z += 20) {
          const scale = getScale(z);
          const y = vanishY + (groundY - vanishY) * (1 - scale);
          const centerX = w / 2;
          const laneW = w * LANE_WIDTH_RATIO * scale;
          const totalW = laneW * LANE_COUNT;
          const startX = centerX - totalW / 2;
          const x = startX + laneW * lane;
          if (z === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      const floorGrad = ctx.createLinearGradient(0, groundY, 0, h);
      floorGrad.addColorStop(0, 'rgba(0, 229, 255, 0.03)');
      floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, groundY, w, h - groundY);

      const neonColors = ['#00E5FF', '#7C3AED', '#EF4444', '#10B981'];
      for (let i = 0; i < 6; i++) {
        const depth = ((i * 200 + game.tunnelOffset * 1.5) % 1200);
        const scale = getScale(depth);
        const y = vanishY + (groundY - vanishY) * (1 - scale);
        const alpha = scale * 0.4;
        const halfW = w * 0.52 * scale;
        const color = neonColors[i % neonColors.length];

        ctx.strokeStyle = color.replace(')', `, ${alpha})`).replace('rgb', 'rgba').replace('#', '');
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;

        ctx.beginPath();
        ctx.moveTo(w / 2 - halfW - 10 * scale, y - 5 * scale);
        ctx.lineTo(w / 2 - halfW - 10 * scale, y + 15 * scale);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w / 2 + halfW + 10 * scale, y - 5 * scale);
        ctx.lineTo(w / 2 + halfW + 10 * scale, y + 15 * scale);
        ctx.stroke();

        ctx.globalAlpha = 1;
      }
    };

    const drawPlayer = (w: number, h: number) => {
      const groundY = h * GROUND_Y_RATIO;
      const vanishY = h * VANISHING_Y_RATIO;
      const playerZ = 50;
      const scale = getScale(playerZ);
      const x = getLaneX(game.playerLane, playerZ, w);
      const baseY = vanishY + (groundY - vanishY) * (1 - scale) - game.jumpY;
      const size = 28 * scale;

      game.playerX = x;
      game.playerY = baseY;

      ctx.save();
      ctx.shadowColor = character.glowColor;
      ctx.shadowBlur = 15;

      ctx.fillStyle = character.helmetColor;
      ctx.beginPath();
      ctx.ellipse(x, baseY - size * 2.2, size * 0.45, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = character.accentColor;
      ctx.fillRect(x - size * 0.15, baseY - size * 2.55, size * 0.3, size * 0.12);

      ctx.fillStyle = character.bodyColor;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.5, baseY - size * 1.7);
      ctx.lineTo(x + size * 0.5, baseY - size * 1.7);
      ctx.lineTo(x + size * 0.4, baseY - size * 0.5);
      ctx.lineTo(x - size * 0.4, baseY - size * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = character.accentColor;
      ctx.fillRect(x - size * 0.5, baseY - size * 1.7, size, size * 0.08);
      ctx.fillRect(x - size * 0.08, baseY - size * 1.6, size * 0.16, size * 1.0);

      const legOffset = Math.sin(game.frame * 0.15) * size * 0.15;
      ctx.fillStyle = character.bodyColor;
      ctx.fillRect(x - size * 0.3, baseY - size * 0.5, size * 0.22, size * 0.6 + legOffset);
      ctx.fillRect(x + size * 0.08, baseY - size * 0.5, size * 0.22, size * 0.6 - legOffset);

      ctx.fillStyle = character.accentColor;
      ctx.fillRect(x - size * 0.3, baseY + size * 0.05 + legOffset, size * 0.22, size * 0.06);
      ctx.fillRect(x + size * 0.08, baseY + size * 0.05 - legOffset, size * 0.22, size * 0.06);

      const armSwing = Math.sin(game.frame * 0.15) * size * 0.2;
      ctx.fillStyle = character.bodyColor;
      ctx.fillRect(x - size * 0.65, baseY - size * 1.5 + armSwing, size * 0.15, size * 0.6);
      ctx.fillRect(x + size * 0.5, baseY - size * 1.5 - armSwing, size * 0.15, size * 0.6);

      ctx.restore();
    };

    const drawObstacle = (obs: Obstacle, w: number, h: number) => {
      const groundY = h * GROUND_Y_RATIO;
      const vanishY = h * VANISHING_Y_RATIO;
      const scale = getScale(obs.z);
      const x = getLaneX(obs.lane, obs.z, w);
      const y = vanishY + (groundY - vanishY) * (1 - scale);
      const obsW = 40 * scale;
      const obsH = obs.height * scale;

      ctx.save();

      if (obs.type === 'laser') {
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 20 * scale;
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(x - obsW / 2, y - obsH - 5 * scale, obsW * 0.15, obsH + 5 * scale);
        ctx.fillRect(x + obsW / 2 - obsW * 0.15, y - obsH - 5 * scale, obsW * 0.15, obsH + 5 * scale);
        const laserAlpha = 0.6 + Math.sin(game.frame * 0.3) * 0.4;
        ctx.fillStyle = `rgba(239, 68, 68, ${laserAlpha})`;
        ctx.fillRect(x - obsW / 2, y - obsH * 0.6, obsW, obsH * 0.08);
        ctx.fillStyle = `rgba(252, 165, 165, ${laserAlpha * 0.5})`;
        ctx.fillRect(x - obsW / 2 - 2, y - obsH * 0.6 - 2, obsW + 4, obsH * 0.12);
      } else if (obs.type === 'drone') {
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 15 * scale;
        const droneY = y - obsH * 1.2;
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.ellipse(x, droneY, obsW * 0.35, obsH * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(x, droneY - obsH * 0.1, obsW * 0.08, 0, Math.PI * 2);
        ctx.fill();
        const propAngle = game.frame * 0.5;
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(x - obsW * 0.5 * Math.cos(propAngle), droneY - obsH * 0.3);
        ctx.lineTo(x + obsW * 0.5 * Math.cos(propAngle), droneY - obsH * 0.3);
        ctx.stroke();
      } else {
        ctx.shadowColor = '#7C3AED';
        ctx.shadowBlur = 10 * scale;
        ctx.fillStyle = 'rgba(124, 58, 237, 0.3)';
        ctx.fillRect(x - obsW / 2, y - obsH * 0.15, obsW, obsH * 0.15);
        const pulseAlpha = 0.3 + Math.sin(game.frame * 0.2) * 0.2;
        ctx.fillStyle = `rgba(124, 58, 237, ${pulseAlpha})`;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x - obsW / 2 + i * obsW * 0.35, y - obsH * 0.15, obsW * 0.25, obsH * 0.05);
        }
      }
      ctx.restore();
    };

    const drawCoin = (coin: WgmCoin, w: number, h: number) => {
      if (coin.collected) return;
      const groundY = h * GROUND_Y_RATIO;
      const vanishY = h * VANISHING_Y_RATIO;
      const scale = getScale(coin.z);
      const x = getLaneX(coin.lane, coin.z, w);
      const baseY = vanishY + (groundY - vanishY) * (1 - scale);
      const bob = Math.sin(coin.bobPhase + game.frame * 0.08) * 5 * scale;
      const y = baseY - 25 * scale + bob;
      const r = 10 * scale;

      ctx.save();
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12 * scale;

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FCD34D';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#92400E';
      ctx.font = `bold ${r * 1.1}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', x, y + 1);

      ctx.restore();
    };

    const drawParticles = () => {
      for (const p of game.particles) {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color.replace('1)', `${alpha})`);
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    };

    const checkCollision = (obs: Obstacle, w: number, h: number): boolean => {
      if (obs.lane !== game.playerLane) return false;
      const groundY = h * GROUND_Y_RATIO;
      const vanishY = h * VANISHING_Y_RATIO;
      const obsScale = getScale(obs.z);
      const obsY = vanishY + (groundY - vanishY) * (1 - obsScale);
      const playerScale = getScale(50);
      const playerBaseY = vanishY + (groundY - vanishY) * (1 - playerScale) - game.jumpY;

      if (obs.z > 30 && obs.z < 80) {
        if (obs.type === 'drone') {
          if (game.jumpY > 30) return false;
          return true;
        }
        if (obs.type === 'floor') {
          if (game.jumpY > 15) return false;
          return true;
        }
        if (obs.type === 'laser') {
          return true;
        }
      }
      return false;
    };

    const checkCoinCollect = (coin: WgmCoin): boolean => {
      if (coin.collected) return false;
      if (coin.lane !== game.playerLane) return false;
      return coin.z > 20 && coin.z < 90;
    };

    const spawnDeathParticles = () => {
      for (let i = 0; i < 30; i++) {
        game.particles.push({
          x: game.playerX,
          y: game.playerY - 20,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 40 + Math.random() * 20,
          maxLife: 60,
          color: `rgba(${Math.random() > 0.5 ? '239, 68, 68' : '255, 255, 255'}, 1)`,
          size: 2 + Math.random() * 4,
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
        game.jumpVel = 12;
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
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < 20 && absDy < 20) {
        if (!game.jumping) {
          game.jumping = true;
          game.jumpVel = 12;
        }
        return;
      }

      if (absDx > absDy) {
        if (dx < -30 && game.playerLane > 0) game.playerLane--;
        else if (dx > 30 && game.playerLane < LANE_COUNT - 1) game.playerLane++;
      } else {
        if (dy < -30 && !game.jumping) {
          game.jumping = true;
          game.jumpVel = 12;
        }
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
        game.speed = 4 + game.distance * 0.003;
        game.tunnelOffset = (game.tunnelOffset + game.speed * 2) % 1200;
        game.distance += game.speed * 0.02;
        game.score += Math.floor(game.speed * 0.5);

        if (game.jumping) {
          game.jumpY += game.jumpVel;
          game.jumpVel -= 0.6;
          if (game.jumpY <= 0) {
            game.jumpY = 0;
            game.jumping = false;
            game.jumpVel = 0;
          }
        }

        if (game.graceFrames > 0) {
          game.graceFrames--;
        } else {
          obstacleTimer++;
          if (obstacleTimer > Math.max(35, 80 - game.distance * 0.1)) {
            spawnObstacle();
            obstacleTimer = 0;
          }
        }

        coinTimer++;
        if (coinTimer > 45) {
          spawnCoin();
          coinTimer = 0;
        }

        for (const obs of game.obstacles) {
          obs.z -= game.speed * 3;
        }
        for (const coin of game.wgmCoins) {
          coin.z -= game.speed * 3;
        }

        game.obstacles = game.obstacles.filter(o => o.z > -100);
        game.wgmCoins = game.wgmCoins.filter(c => c.z > -100);

        if (game.graceFrames <= 0) {
          for (const obs of game.obstacles) {
            if (!obs.passed && checkCollision(obs, w, h)) {
              game.alive = false;
              game.flashTimer = 10;
              spawnDeathParticles();
              const fs = game.score;
              const fc = game.coins;
              const fd = Math.floor(game.distance);
              setFinalScore(fs);
              setFinalCoins(fc);
              setFinalDistance(fd);
              submitScore(fs, fc, fd);
              setTimeout(() => setShowDeathOverlay(true), 600);
              break;
            }
          }
        }

        for (const coin of game.wgmCoins) {
          if (checkCoinCollect(coin)) {
            coin.collected = true;
            game.coins++;
            game.score += 50;
            for (let i = 0; i < 8; i++) {
              game.particles.push({
                x: game.playerX, y: game.playerY - 30,
                vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4,
                life: 20, maxLife: 20,
                color: 'rgba(245, 158, 11, 1)', size: 3,
              });
            }
          }
        }

        for (const p of game.particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15;
          p.life--;
        }
        game.particles = game.particles.filter(p => p.life > 0);

        setLiveScore(game.score);
        setLiveCoins(game.coins);
        setLiveDistance(Math.floor(game.distance));
      }

      if (game.flashTimer > 0) {
        game.flashTimer--;
      }

      drawTunnel(w, h);

      for (const coin of game.wgmCoins) drawCoin(coin, w, h);
      for (const obs of game.obstacles) drawObstacle(obs, w, h);

      if (game.alive || game.flashTimer > 0) {
        drawPlayer(w, h);
      }

      drawParticles();

      if (game.flashTimer > 0 && game.flashTimer % 2 === 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${game.flashTimer / 10})`;
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
    localStorage.setItem('wgm_runner_username', username.trim());
    fetchLeaderboard();
    setGameState('charselect');
  };

  const handleSelectChar = (idx: number) => {
    if (CHARACTERS[idx].locked) return;
    setSelectedChar(idx);
    localStorage.setItem('wgm_runner_char', idx.toString());
  };

  const handleBack = () => {
    stoppedRef.current = true;
    cancelAnimationFrame(animRef.current);
    setShowDeathOverlay(false);
    setGameState('charselect');
  };

  if (gameState === 'login') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] rounded-2xl flex items-center justify-center">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-heading font-bold">WGM RUNNER</h1>
            <p className="text-gray-400 text-sm">3-Lane Cyberpunk Endless Runner</p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter your username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-center text-lg focus:border-[#7C3AED] focus:outline-none transition-colors"
              maxLength={20}
            />
            <button
              onClick={handleLogin}
              disabled={!username.trim()}
              className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] rounded-xl font-bold text-lg disabled:opacity-30 transition-opacity"
            >
              ENTER
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'charselect') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] p-4">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setGameState('login')} className="p-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-heading font-bold">SELECT CHARACTER</h1>
            <button onClick={() => { fetchLeaderboard(); setGameState('leaderboard'); }} className="p-2 hover:bg-white/10 rounded-lg">
              <Trophy className="w-5 h-5 text-[#F59E0B]" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {CHARACTERS.map((char, idx) => (
              <button
                key={char.id}
                onClick={() => handleSelectChar(idx)}
                className={`relative p-4 rounded-xl border transition-all text-left ${
                  selectedChar === idx
                    ? 'border-[#7C3AED] bg-[#7C3AED]/10 ring-1 ring-[#7C3AED]/50'
                    : char.locked
                    ? 'border-white/5 bg-white/2 opacity-50'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {char.locked && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                )}
                <div className="w-12 h-16 mx-auto mb-2 relative">
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${char.bodyColor}, ${char.accentColor})`,
                      boxShadow: `0 0 15px ${char.glowColor}40`,
                    }}
                  />
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full"
                    style={{ background: char.helmetColor, border: `2px solid ${char.accentColor}` }}
                  />
                  <div
                    className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full"
                    style={{ background: char.accentColor }}
                  />
                </div>
                <p className="text-xs font-bold text-center truncate">{char.name}</p>
                <p className="text-[10px] text-center font-semibold mt-0.5" style={{ color: char.rarityColor }}>{char.rarity}</p>
              </button>
            ))}
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-14 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${CHARACTERS[selectedChar].bodyColor}, ${CHARACTERS[selectedChar].accentColor})`,
                  boxShadow: `0 0 20px ${CHARACTERS[selectedChar].glowColor}40`,
                }}
              />
              <div>
                <p className="font-bold">{CHARACTERS[selectedChar].name}</p>
                <p className="text-xs" style={{ color: CHARACTERS[selectedChar].rarityColor }}>
                  {CHARACTERS[selectedChar].rarity}
                </p>
              </div>
            </div>
            <button
              onClick={startGame}
              className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] rounded-xl font-bold text-lg flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" fill="white" />
              START RUN
            </button>
          </div>

          <div className="text-center text-gray-500 text-xs space-y-1">
            <p>Swipe left/right to switch lanes</p>
            <p>Swipe up or tap to jump</p>
            <p>Collect $WGM coins for bonus points</p>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] p-4">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setGameState('charselect')} className="p-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-heading font-bold">LEADERBOARD</h1>
            <button onClick={fetchLeaderboard} className="p-2 hover:bg-white/10 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
              <p className="text-lg font-bold text-[#00E5FF]">{stats.totalPlayers}</p>
              <p className="text-[10px] text-gray-400">Players</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
              <p className="text-lg font-bold text-[#F59E0B]">{stats.highestScore.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">Top Score</p>
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
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  entry.username === username ? 'border-[#7C3AED]/50 bg-[#7C3AED]/10' : 'border-white/5 bg-white/5'
                }`}
              >
                <div className="w-8 text-center font-bold">
                  {idx === 0 ? <Crown className="w-5 h-5 text-[#F59E0B] mx-auto" /> :
                   idx === 1 ? <Medal className="w-5 h-5 text-gray-300 mx-auto" /> :
                   idx === 2 ? <Medal className="w-5 h-5 text-amber-600 mx-auto" /> :
                   <span className="text-gray-400 text-sm">#{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{entry.username}</p>
                  <p className="text-[10px] text-gray-400">{entry.gamesPlayed} games</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-[#00E5FF]">{entry.score.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{entry.coins} WGM</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startGame}
            className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] rounded-xl font-bold"
          >
            PLAY NOW
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="w-full h-full" style={{ touchAction: 'none' }} />

      <div className="absolute top-0 left-0 right-0 z-10 p-3 flex items-start justify-between pointer-events-none">
        <button
          onClick={handleBack}
          className="pointer-events-auto p-2 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-2">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">SCORE</p>
            <p className="text-sm font-bold text-[#00E5FF]">{liveScore.toLocaleString()}</p>
          </div>
          <div className="bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">$WGM</p>
            <p className="text-sm font-bold text-[#F59E0B]">{liveCoins}</p>
          </div>
          <div className="bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">DIST</p>
            <p className="text-sm font-bold">{liveDistance}m</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center gap-4 pointer-events-none">
        <button
          onClick={() => { if (gameRef.current?.alive && gameRef.current.playerLane > 0) gameRef.current.playerLane--; }}
          className="pointer-events-auto w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center justify-center active:bg-white/20"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
        <button
          onClick={() => {
            if (gameRef.current?.alive && !gameRef.current.jumping) {
              gameRef.current.jumping = true;
              gameRef.current.jumpVel = 12;
            }
          }}
          className="pointer-events-auto w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center justify-center active:bg-white/20"
        >
          <ChevronUp className="w-8 h-8" />
        </button>
        <button
          onClick={() => { if (gameRef.current?.alive && gameRef.current.playerLane < LANE_COUNT - 1) gameRef.current.playerLane++; }}
          className="pointer-events-auto w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center justify-center active:bg-white/20"
        >
          <ChevronRight className="w-8 h-8" />
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
                <p className="text-xs text-gray-400">Score</p>
                <p className="font-bold text-[#00E5FF]">{finalScore.toLocaleString()}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-xs text-gray-400">$WGM</p>
                <p className="font-bold text-[#F59E0B]">{finalCoins}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-xs text-gray-400">Distance</p>
                <p className="font-bold">{finalDistance}m</p>
              </div>
            </div>
            {rank > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-[#F59E0B]" />
                <span>Rank #{rank}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">Best: {personalBest.toLocaleString()}</span>
              </div>
            )}
            <div className="space-y-2">
              <button
                onClick={startGame}
                className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                RUN AGAIN
              </button>
              <button
                onClick={handleBack}
                className="w-full py-3 bg-white/5 border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10"
              >
                <Home className="w-4 h-4" />
                HOME
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
