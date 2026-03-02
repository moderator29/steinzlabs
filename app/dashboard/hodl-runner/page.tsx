'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, Medal, Star, Play, ArrowLeft, Users, Gamepad2,
  Crown, Zap, Heart, Flame, Target, RotateCcw, Volume2, VolumeX,
  Home
} from 'lucide-react';

interface LeaderboardEntry {
  id: string; username: string; score: number; coins: number;
  distance: number; gamesPlayed: number; bestStreak: number; timestamp: number;
}

interface Obstacle {
  x: number; y: number; width: number; height: number; type: 'candle' | 'bear' | 'rug';
  color: string; passed: boolean;
}

interface Coin {
  x: number; y: number; radius: number; type: 'btc' | 'eth' | 'sol';
  value: number; collected: boolean; bobOffset: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number;
  maxLife: number; color: string; size: number;
}

interface StarBg {
  x: number; y: number; size: number; speed: number; brightness: number;
}

export default function HodlRunnerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'login' | 'playing' | 'gameover' | 'leaderboard'>('login');
  const [username, setUsername] = useState('');
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
    const saved = localStorage.getItem('hodl_runner_username');
    if (saved) setUsername(saved);
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/game-scores');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setStats({
          totalPlayers: data.totalPlayers || 0,
          totalGamesPlayed: data.totalGamesPlayed || 0,
          highestScore: data.highestScore || 0,
          topPlayer: data.topPlayer || 'N/A',
        });
      }
    } catch {}
  };

  const submitScore = async (score: number, coins: number, distance: number) => {
    try {
      const res = await fetch('/api/game-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score, coins, distance }),
      });
      if (res.ok) {
        const data = await res.json();
        setRank(data.rank);
        setPersonalBest(data.personalBest);
      }
    } catch {}
    fetchLeaderboard();
  };

  const startGame = () => {
    if (!username.trim()) return;
    localStorage.setItem('hodl_runner_username', username.trim());
    stoppedRef.current = true;
    setShowDeathOverlay(false);
    scoreSubmittedRef.current = false;
    setLiveScore(0);
    setLiveCoins(0);
    setLiveDistance(0);
    setSessionId(prev => prev + 1);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    stoppedRef.current = false;
    setShowDeathOverlay(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const GROUND_Y = H - 60;
    const PLAYER_W = 32;
    const PLAYER_H = 40;
    const GRACE_FRAMES = 120;

    const game = {
      player: { x: 60, y: GROUND_Y - PLAYER_H, vy: 0, jumping: false, doubleJump: false },
      obstacles: [] as Obstacle[],
      coins: [] as Coin[],
      particles: [] as Particle[],
      stars: [] as StarBg[],
      chartPoints: [] as number[],
      speed: 5,
      score: 0,
      coinCount: 0,
      distance: 0,
      frameCount: 0,
      alive: true,
      deathTimer: 0,
      shakeX: 0,
      shakeY: 0,
      groundOffset: 0,
      runCycle: 0,
    };

    for (let i = 0; i < 80; i++) {
      game.stars.push({
        x: Math.random() * W, y: Math.random() * (GROUND_Y - 20),
        size: Math.random() * 2 + 0.5, speed: Math.random() * 0.5 + 0.2,
        brightness: Math.random() * 0.5 + 0.3,
      });
    }

    for (let i = 0; i < W + 20; i += 3) {
      game.chartPoints.push(GROUND_Y - 10 + Math.sin(i * 0.02) * 8);
    }

    gameRef.current = game;

    const spawnObstacle = () => {
      const types: ('candle' | 'bear' | 'rug')[] = ['candle', 'candle', 'bear', 'rug'];
      const type = types[Math.floor(Math.random() * types.length)];
      let ob: Obstacle;
      if (type === 'candle') {
        const h = 30 + Math.random() * 35;
        ob = { x: W + 20, y: GROUND_Y - h, width: 14, height: h, type, color: '#EF4444', passed: false };
      } else if (type === 'bear') {
        ob = { x: W + 20, y: GROUND_Y - 28, width: 24, height: 28, type, color: '#EF4444', passed: false };
      } else {
        ob = { x: W + 20, y: GROUND_Y - 8, width: 50, height: 8, type, color: '#7C3AED', passed: false };
      }
      game.obstacles.push(ob);
    };

    const spawnCoin = () => {
      const types: ('btc' | 'eth' | 'sol')[] = ['btc', 'eth', 'sol'];
      const type = types[Math.floor(Math.random() * types.length)];
      const values = { btc: 50, eth: 30, sol: 20 };
      const y = GROUND_Y - 50 - Math.random() * 60;
      game.coins.push({ x: W + 20, y, radius: 10, type, value: values[type], collected: false, bobOffset: Math.random() * Math.PI * 2 });
    };

    const addParticles = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        game.particles.push({
          x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 - 2,
          life: 30 + Math.random() * 20, maxLife: 50, color, size: 2 + Math.random() * 3,
        });
      }
    };

    const jump = () => {
      if (!game.alive) return;
      if (!game.player.jumping) {
        game.player.vy = -12;
        game.player.jumping = true;
        addParticles(game.player.x, game.player.y + PLAYER_H, '#00E5FF', 5);
      } else if (!game.player.doubleJump) {
        game.player.vy = -10;
        game.player.doubleJump = true;
        addParticles(game.player.x, game.player.y + PLAYER_H, '#7C3AED', 5);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    const handleTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && t.clientY < 60) return;
      e.preventDefault();
      jump();
    };
    const handleClick = (e: MouseEvent) => {
      if (e.clientY < 60) return;
      if (game.alive) jump();
    };

    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('click', handleClick);

    const drawMechRunner = () => {
      const p = game.player;
      const px = p.x + game.shakeX;
      const py = p.y + game.shakeY;
      const cycle = game.runCycle;

      ctx.save();

      const legSwing = p.jumping ? 0 : Math.sin(cycle * 0.3) * 6;

      ctx.fillStyle = '#1a1f3a';
      ctx.beginPath();
      ctx.roundRect(px - 5 - legSwing, py + PLAYER_H - 12, 8, 12, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(px + 1 + legSwing, py + PLAYER_H - 12, 8, 12, 2);
      ctx.fill();

      ctx.fillStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(px - 4 - legSwing, py + PLAYER_H - 4, 6, 4, 1);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(px + 2 + legSwing, py + PLAYER_H - 4, 6, 4, 1);
      ctx.fill();
      ctx.shadowBlur = 0;

      const bodyGrad = ctx.createLinearGradient(px - 12, py + 8, px + 12, py + 8);
      bodyGrad.addColorStop(0, '#0d1333');
      bodyGrad.addColorStop(0.5, '#1a2555');
      bodyGrad.addColorStop(1, '#0d1333');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(px - 12, py + 8, 24, 22, 4);
      ctx.fill();

      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(px - 12, py + 8, 24, 22, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py + 18, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#060A12';
      ctx.beginPath();
      ctx.arc(px, py + 18, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00E5FF';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('W', px, py + 20);

      const armSwing = p.jumping ? -3 : Math.sin(cycle * 0.3 + Math.PI) * 5;

      ctx.fillStyle = '#1a2555';
      ctx.beginPath();
      ctx.roundRect(px - 16, py + 10 + armSwing, 5, 14, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(px + 11, py + 10 - armSwing, 5, 14, 2);
      ctx.fill();

      ctx.fillStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.roundRect(px - 16, py + 22 + armSwing, 5, 3, 1);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(px + 11, py + 22 - armSwing, 5, 3, 1);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#1a2555';
      ctx.beginPath();
      ctx.roundRect(px - 10, py + 2, 20, 8, [6, 6, 2, 2]);
      ctx.fill();

      const headGrad = ctx.createLinearGradient(px, py - 14, px, py + 6);
      headGrad.addColorStop(0, '#1a2555');
      headGrad.addColorStop(1, '#0d1333');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 14, 20, 18, 6);
      ctx.fill();

      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 0.8;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 14, 20, 18, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const visorGrad = ctx.createLinearGradient(px - 7, py - 8, px + 7, py - 4);
      visorGrad.addColorStop(0, '#00E5FF');
      visorGrad.addColorStop(0.5, '#7C3AED');
      visorGrad.addColorStop(1, '#00E5FF');
      ctx.fillStyle = visorGrad;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(px - 7, py - 9, 14, 6, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      const visorPulse = 0.7 + Math.sin(game.frameCount * 0.08) * 0.3;
      ctx.fillStyle = `rgba(0, 229, 255, ${visorPulse * 0.3})`;
      ctx.beginPath();
      ctx.roundRect(px - 7, py - 9, 14, 6, 3);
      ctx.fill();

      ctx.fillStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(px - 2, py - 16);
      ctx.lineTo(px + 2, py - 16);
      ctx.lineTo(px + 1, py - 13);
      ctx.lineTo(px - 1, py - 13);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (p.jumping) {
        const thrustIntensity = Math.abs(p.vy) / 12;
        const tGrad = ctx.createRadialGradient(px, py + PLAYER_H + 4, 0, px, py + PLAYER_H + 4, 12 * thrustIntensity);
        tGrad.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
        tGrad.addColorStop(0.4, 'rgba(124, 58, 237, 0.5)');
        tGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.moveTo(px - 8, py + PLAYER_H);
        ctx.lineTo(px, py + PLAYER_H + 14 * thrustIntensity + Math.random() * 4);
        ctx.lineTo(px + 8, py + PLAYER_H);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(px - 3, py + PLAYER_H);
        ctx.lineTo(px, py + PLAYER_H + 8 * thrustIntensity + Math.random() * 3);
        ctx.lineTo(px + 3, py + PLAYER_H);
        ctx.fill();
      } else {
        if (game.frameCount % 4 === 0) {
          game.particles.push({
            x: px - 3 - legSwing, y: py + PLAYER_H,
            vx: -1 - Math.random(), vy: -0.5,
            life: 8, maxLife: 8, color: '#00E5FF', size: 1.5,
          });
        }
      }

      ctx.restore();
    };

    const drawObstacle = (ob: Obstacle) => {
      const ox = ob.x + game.shakeX;
      const oy = ob.y + game.shakeY;

      if (ob.type === 'candle') {
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 6;
        ctx.fillRect(ox - 1, oy - 8, 2, 8);
        ctx.beginPath();
        ctx.roundRect(ox - ob.width / 2, oy, ob.width, ob.height, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fillRect(ox - ob.width / 2 + 2, oy + 3, 3, ob.height - 6);
      } else if (ob.type === 'bear') {
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(ox, oy + 10, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#060A12';
        ctx.beginPath();
        ctx.arc(ox - 4, oy + 7, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ox + 4, oy + 7, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#060A12';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ox, oy + 13, 3, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(ox - 9, oy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ox + 9, oy, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#7C3AED';
        ctx.shadowColor = '#7C3AED';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(ox - ob.width / 2, oy, ob.width, ob.height, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RUG', ox, oy + 6);
      }
    };

    const drawCoin = (coin: Coin) => {
      if (coin.collected) return;
      const bob = Math.sin(game.frameCount * 0.05 + coin.bobOffset) * 3;
      const cx = coin.x + game.shakeX;
      const cy = coin.y + bob + game.shakeY;
      const colors = { btc: '#F59E0B', eth: '#627EEA', sol: '#14F195' };
      const labels = { btc: '₿', eth: 'Ξ', sol: 'S' };
      ctx.save();
      ctx.shadowColor = colors[coin.type];
      ctx.shadowBlur = 10;
      ctx.fillStyle = colors[coin.type];
      ctx.beginPath();
      ctx.arc(cx, cy, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#060A12';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[coin.type], cx, cy + 1);
      ctx.restore();
    };

    const checkCollision = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    let hudUpdateTimer = 0;

    const gameLoop = () => {
      if (stoppedRef.current) return;

      ctx.clearRect(0, 0, W, H);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      if (game.distance < 500) {
        bgGrad.addColorStop(0, '#0a0e1a');
        bgGrad.addColorStop(1, '#060A12');
      } else if (game.distance < 1500) {
        bgGrad.addColorStop(0, '#0d1025');
        bgGrad.addColorStop(1, '#060A12');
      } else {
        bgGrad.addColorStop(0, '#110a25');
        bgGrad.addColorStop(1, '#060A12');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      game.stars.forEach(s => {
        s.x -= s.speed * (game.speed / 5);
        if (s.x < 0) { s.x = W; s.y = Math.random() * (GROUND_Y - 20); }
        const twinkle = 0.5 + Math.sin(game.frameCount * 0.03 + s.x) * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (game.distance > 800) {
        const moonX = W - 60;
        const moonY = 50;
        ctx.save();
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(200, 150, 50, 0.3)';
        ctx.beginPath();
        ctx.arc(moonX - 5, moonY - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(moonX + 6, moonY + 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      game.groundOffset = (game.groundOffset + game.speed) % 20;

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      game.chartPoints.forEach((y, i) => {
        ctx.lineTo(i * 3 - game.groundOffset, y);
      });
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 229, 255, 0.03)';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      game.chartPoints.forEach((y, i) => {
        ctx.lineTo(i * 3 - game.groundOffset, y);
      });
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();

      ctx.strokeStyle = 'rgba(26, 31, 46, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(W, GROUND_Y);
      ctx.stroke();

      if (game.alive) {
        game.player.vy += 0.6;
        game.player.y += game.player.vy;

        if (game.player.y >= GROUND_Y - PLAYER_H) {
          game.player.y = GROUND_Y - PLAYER_H;
          game.player.vy = 0;
          game.player.jumping = false;
          game.player.doubleJump = false;
        }

        game.frameCount++;
        game.distance++;
        game.runCycle++;
        game.score = Math.floor(game.distance / 5) + game.coinCount;
        game.speed = 5 + game.distance * 0.002;
        if (game.speed > 14) game.speed = 14;

        if (game.frameCount > GRACE_FRAMES) {
          if (game.frameCount % Math.max(40, 90 - Math.floor(game.distance / 20)) === 0) {
            spawnObstacle();
          }
        }
        if (game.frameCount % 70 === 0) {
          spawnCoin();
        }

        let died = false;
        game.obstacles.forEach(ob => {
          ob.x -= game.speed;

          if (!died && game.frameCount > GRACE_FRAMES) {
            const playerLeft = game.player.x - PLAYER_W / 2 + 6;
            const playerTop = game.player.y + 6;
            const playerW = PLAYER_W - 12;
            const playerH = PLAYER_H - 6;

            if (ob.type === 'rug') {
              if (checkCollision(playerLeft, playerTop, playerW, playerH, ob.x - ob.width / 2, ob.y - 2, ob.width, ob.height + 4)) {
                died = true;
              }
            } else if (ob.type === 'bear') {
              const dist = Math.hypot(game.player.x - ob.x, (game.player.y + PLAYER_H / 2) - (ob.y + 10));
              if (dist < 18) {
                died = true;
              }
            } else {
              if (checkCollision(playerLeft, playerTop, playerW, playerH, ob.x - ob.width / 2, ob.y, ob.width, ob.height)) {
                died = true;
              }
            }
          }
        });

        if (died) {
          game.alive = false;
          game.deathTimer = 0;
          addParticles(game.player.x, game.player.y + PLAYER_H / 2, '#EF4444', 20);
          addParticles(game.player.x, game.player.y + PLAYER_H / 2, '#F59E0B', 10);
          addParticles(game.player.x, game.player.y + PLAYER_H / 2, '#00E5FF', 8);
          game.shakeX = (Math.random() - 0.5) * 12;
          game.shakeY = (Math.random() - 0.5) * 12;
        }

        game.coins.forEach(coin => {
          if (coin.collected) return;
          coin.x -= game.speed;

          const dist = Math.hypot(game.player.x - coin.x, (game.player.y + PLAYER_H / 2) - coin.y);
          if (dist < PLAYER_W / 2 + coin.radius) {
            coin.collected = true;
            game.coinCount += coin.value;
            const colors = { btc: '#F59E0B', eth: '#627EEA', sol: '#14F195' };
            addParticles(coin.x, coin.y, colors[coin.type], 8);
          }
        });

        hudUpdateTimer++;
        if (hudUpdateTimer % 10 === 0) {
          setLiveScore(game.score);
          setLiveCoins(game.coinCount);
          setLiveDistance(Math.floor(game.distance));
        }
      } else {
        game.deathTimer++;
        const shake = Math.max(0, 10 - game.deathTimer * 0.4);
        game.shakeX = (Math.random() - 0.5) * shake;
        game.shakeY = (Math.random() - 0.5) * shake;

        game.obstacles.forEach(ob => {
          ob.x -= game.speed * Math.max(0, 1 - game.deathTimer * 0.03);
        });

        if (game.deathTimer === 40 && !scoreSubmittedRef.current) {
          scoreSubmittedRef.current = true;
          setFinalScore(game.score);
          setFinalCoins(game.coinCount);
          setFinalDistance(Math.floor(game.distance));
          setLiveScore(game.score);
          setLiveCoins(game.coinCount);
          setLiveDistance(Math.floor(game.distance));
          submitScore(game.score, game.coinCount, Math.floor(game.distance));
          setShowDeathOverlay(true);
        }
      }

      game.obstacles.forEach(ob => drawObstacle(ob));
      game.coins.forEach(coin => drawCoin(coin));

      game.obstacles = game.obstacles.filter(ob => ob.x > -60);
      game.coins = game.coins.filter(c => c.x > -20);

      game.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life--;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x + game.shakeX, p.y + game.shakeY, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      game.particles = game.particles.filter(p => p.life > 0);

      if (game.alive && game.player.jumping) {
        if (game.frameCount % 3 === 0) {
          game.particles.push({
            x: game.player.x, y: game.player.y + PLAYER_H,
            vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(),
            life: 15, maxLife: 15, color: '#00E5FF', size: 2,
          });
        }
      }

      drawMechRunner();

      if (game.shakeX !== 0 || game.shakeY !== 0) {
        game.shakeX *= 0.9;
        game.shakeY *= 0.9;
        if (Math.abs(game.shakeX) < 0.5) game.shakeX = 0;
        if (Math.abs(game.shakeY) < 0.5) game.shakeY = 0;
      }

      if (!game.alive) {
        const overlayAlpha = Math.min(0.4, game.deathTimer * 0.01);
        ctx.fillStyle = `rgba(239, 68, 68, ${overlayAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      animRef.current = requestAnimationFrame(gameLoop);
    };

    animRef.current = requestAnimationFrame(gameLoop);

    return () => {
      stoppedRef.current = true;
      window.removeEventListener('keydown', handleKey);
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animRef.current);
    };
  }, [gameState, sessionId]);

  useEffect(() => { fetchLeaderboard(); }, []);

  const getRankBadge = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-[#F59E0B]" />;
    if (i === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (i === 2) return <Medal className="w-4 h-4 text-[#CD7F32]" />;
    return <span className="text-[10px] text-gray-600 w-4 text-center font-mono">{i + 1}</span>;
  };

  if (gameState === 'playing') {
    return (
      <div className="fixed inset-0 z-50 bg-[#060A12]">
        <canvas ref={canvasRef} className="w-full h-full" style={{ touchAction: 'none' }} />

        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 pointer-events-none" style={{ zIndex: 10 }}>
          <button
            onClick={(e) => { e.stopPropagation(); stoppedRef.current = true; setGameState('login'); }}
            className="pointer-events-auto p-2 bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>

          <div className="flex items-center gap-3">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 px-3 py-1.5 flex items-center gap-2">
              <span className="text-[10px] text-white/50 font-medium">SCORE</span>
              <span className="text-sm font-bold text-white">{liveScore.toLocaleString()}</span>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-[#F59E0B]/20 px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-[10px] text-[#F59E0B]">W</span>
              <span className="text-sm font-bold text-[#F59E0B]">{liveCoins}</span>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-[#00E5FF]/20 px-3 py-1.5">
            <span className="text-sm font-bold text-[#00E5FF]">{liveDistance}m</span>
          </div>
        </div>

        {showDeathOverlay && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
            <div className="bg-[#0a0e1a]/95 backdrop-blur-md border border-[#EF4444]/30 rounded-3xl p-6 mx-4 max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="text-4xl mb-3">💀</div>
              <h2 className="text-xl font-bold mb-1 text-white">LIQUIDATED!</h2>
              <p className="text-xs text-gray-500 mb-4">The market got you, {username}.</p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-[#060A12] rounded-xl p-2.5">
                  <div className="text-[8px] text-gray-600 uppercase mb-0.5">Score</div>
                  <div className="text-base font-bold text-[#00E5FF]">{finalScore.toLocaleString()}</div>
                </div>
                <div className="bg-[#060A12] rounded-xl p-2.5">
                  <div className="text-[8px] text-gray-600 uppercase mb-0.5">Coins</div>
                  <div className="text-base font-bold text-[#F59E0B]">{finalCoins}</div>
                </div>
                <div className="bg-[#060A12] rounded-xl p-2.5">
                  <div className="text-[8px] text-gray-600 uppercase mb-0.5">Distance</div>
                  <div className="text-base font-bold text-[#10B981]">{finalDistance}m</div>
                </div>
              </div>

              {rank > 0 && (
                <div className="bg-[#060A12] rounded-xl p-2.5 mb-4 flex items-center justify-center gap-4">
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase">Rank</div>
                    <div className="text-sm font-bold text-[#F59E0B]">#{rank}</div>
                  </div>
                  <div className="w-px h-6 bg-[#1a1f2e]" />
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase">Best</div>
                    <div className="text-sm font-bold text-[#7C3AED]">{personalBest.toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Run Again
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); stoppedRef.current = true; setGameState('login'); }}
                  className="py-3 px-4 bg-[#0f1320] border border-[#1a1f2e] rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                >
                  <Home className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-24">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-6">
          <a href="/dashboard" className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </a>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-[#00E5FF]" />
              <h1 className="text-lg font-heading font-bold">HODL RUNNER</h1>
              <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">PLAY</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">Run. Jump. Collect. HODL to the moon.</p>
          </div>
        </div>

        {gameState === 'login' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#00E5FF]/5 to-[#7C3AED]/5 rounded-2xl border border-[#1a1f2e] p-6 text-center">
              <div className="w-24 h-24 mx-auto mb-4 relative">
                <div className="w-24 h-24 bg-gradient-to-br from-[#0d1333] to-[#1a2555] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00E5FF]/20 border border-[#00E5FF]/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#00E5FF]/10 to-transparent" />
                  <div className="relative">
                    <div className="w-10 h-12 relative">
                      <div className="absolute w-8 h-7 bg-gradient-to-b from-[#1a2555] to-[#0d1333] rounded-t-lg left-1 top-0 border border-[#00E5FF]/40" />
                      <div className="absolute w-6 h-2.5 bg-gradient-to-r from-[#00E5FF] via-[#7C3AED] to-[#00E5FF] rounded left-2 top-1.5 shadow-[0_0_8px_rgba(0,229,255,0.6)]" />
                      <div className="absolute w-10 h-8 bg-gradient-to-b from-[#1a2555] to-[#0d1333] rounded top-5 border border-[#00E5FF]/30" />
                      <div className="absolute w-3 h-3 bg-[#00E5FF]/30 rounded-full left-3.5 top-7 border border-[#00E5FF]/50 flex items-center justify-center">
                        <span className="text-[5px] text-[#00E5FF] font-bold">W</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-3 bg-[#00E5FF]/10 rounded-full blur-sm" />
              </div>
              <h2 className="text-xl font-heading font-bold mb-2">HODL RUNNER</h2>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto mb-1 leading-relaxed">
                Navigate your mech warrior through the volatile market. Jump over red candles and bears, dodge rug pulls, collect BTC, ETH, and SOL coins!
              </p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="text-center">
                  <div className="text-[8px] text-gray-600 uppercase">Controls</div>
                  <div className="text-[10px] text-[#00E5FF] font-semibold">Tap / Space</div>
                </div>
                <div className="w-px h-6 bg-[#1a1f2e]" />
                <div className="text-center">
                  <div className="text-[8px] text-gray-600 uppercase">Double Jump</div>
                  <div className="text-[10px] text-[#7C3AED] font-semibold">Tap Again</div>
                </div>
                <div className="w-px h-6 bg-[#1a1f2e]" />
                <div className="text-center">
                  <div className="text-[8px] text-gray-600 uppercase">Goal</div>
                  <div className="text-[10px] text-[#F59E0B] font-semibold">HODL</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1.5 font-medium">Enter Your Name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && username.trim()) startGame(); }}
                  placeholder="CryptoKing, DiamondHands, etc."
                  maxLength={20}
                  className="w-full bg-[#0f1320] border border-[#1a1f2e] rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-[#00E5FF]/50 placeholder:text-gray-700"
                  autoFocus
                />
              </div>

              <button
                onClick={startGame}
                disabled={!username.trim()}
                className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-4 rounded-2xl text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-[#00E5FF]/20"
              >
                <Play className="w-5 h-5" /> Start Running
              </button>

              <button
                onClick={() => { fetchLeaderboard(); setGameState('leaderboard'); }}
                className="w-full bg-[#0f1320] border border-[#1a1f2e] py-3.5 rounded-2xl text-sm font-semibold text-gray-400 hover:text-white hover:border-[#F59E0B]/30 transition-all flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4 text-[#F59E0B]" /> Leaderboard
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f1320] rounded-xl p-3 border border-[#1a1f2e] text-center">
                <div className="text-[8px] text-gray-600 uppercase mb-1">Total Players</div>
                <div className="text-base font-bold text-[#00E5FF]">{stats.totalPlayers}</div>
              </div>
              <div className="bg-[#0f1320] rounded-xl p-3 border border-[#1a1f2e] text-center">
                <div className="text-[8px] text-gray-600 uppercase mb-1">Highest Score</div>
                <div className="text-base font-bold text-[#F59E0B]">{stats.highestScore.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="text-[10px] font-bold mb-3 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-[#F59E0B]"/>Coin Values</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Bitcoin', symbol: '₿', value: '+50', color: '#F59E0B' },
                  { label: 'Ethereum', symbol: 'Ξ', value: '+30', color: '#627EEA' },
                  { label: 'Solana', symbol: 'S', value: '+20', color: '#14F195' },
                ].map(c => (
                  <div key={c.label} className="text-center">
                    <div className="w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center text-base font-bold" style={{ backgroundColor: c.color + '20', color: c.color }}>
                      {c.symbol}
                    </div>
                    <div className="text-[9px] text-gray-500">{c.label}</div>
                    <div className="text-[10px] font-bold" style={{ color: c.color }}>{c.value} pts</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="text-[10px] font-bold mb-3 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-[#EF4444]"/>Obstacles</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Red Candles', desc: 'Jump over', color: '#EF4444', icon: '📉' },
                  { label: 'Bears', desc: 'Jump over', color: '#EF4444', icon: '🐻' },
                  { label: 'Rug Pulls', desc: 'Jump over', color: '#7C3AED', icon: '🕳️' },
                ].map(o => (
                  <div key={o.label} className="text-center">
                    <div className="text-2xl mb-1">{o.icon}</div>
                    <div className="text-[9px] font-semibold" style={{ color: o.color }}>{o.label}</div>
                    <div className="text-[8px] text-gray-600">{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-[#EF4444]/5 to-[#F59E0B]/5 rounded-2xl border border-[#EF4444]/15 p-6 text-center">
              <div className="text-3xl mb-2">💀</div>
              <h2 className="text-xl font-heading font-bold mb-1">LIQUIDATED!</h2>
              <p className="text-[10px] text-gray-500 mb-4">The market got you, {username}.</p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-[#060A12] rounded-xl p-3">
                  <div className="text-[8px] text-gray-600 uppercase mb-1">Score</div>
                  <div className="text-lg font-bold text-[#00E5FF]">{finalScore.toLocaleString()}</div>
                </div>
                <div className="bg-[#060A12] rounded-xl p-3">
                  <div className="text-[8px] text-gray-600 uppercase mb-1">Coins</div>
                  <div className="text-lg font-bold text-[#F59E0B]">{finalCoins}</div>
                </div>
                <div className="bg-[#060A12] rounded-xl p-3">
                  <div className="text-[8px] text-gray-600 uppercase mb-1">Distance</div>
                  <div className="text-lg font-bold text-[#10B981]">{finalDistance}m</div>
                </div>
              </div>

              {rank > 0 && (
                <div className="bg-[#060A12] rounded-xl p-3 mb-4 flex items-center justify-center gap-3">
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase">Rank</div>
                    <div className="text-base font-bold text-[#F59E0B]">#{rank}</div>
                  </div>
                  <div className="w-px h-8 bg-[#1a1f2e]" />
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase">Personal Best</div>
                    <div className="text-base font-bold text-[#7C3AED]">{personalBest.toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={startGame}
                  className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-3.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
                <button
                  onClick={() => { fetchLeaderboard(); setGameState('leaderboard'); }}
                  className="bg-[#0f1320] border border-[#1a1f2e] py-3.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4 text-[#F59E0B]" /> Rankings
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'leaderboard' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-[#F59E0B]"/>Leaderboard</h2>
              <button onClick={() => setGameState('login')} className="text-[10px] text-[#00E5FF] font-semibold">Back to Game</button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0f1320] rounded-xl p-3 border border-[#1a1f2e] text-center">
                <div className="text-[8px] text-gray-600 uppercase mb-1">Players</div>
                <div className="text-base font-bold text-[#00E5FF]">{stats.totalPlayers}</div>
              </div>
              <div className="bg-[#0f1320] rounded-xl p-3 border border-[#1a1f2e] text-center">
                <div className="text-[8px] text-gray-600 uppercase mb-1">Games</div>
                <div className="text-base font-bold text-[#7C3AED]">{stats.totalGamesPlayed}</div>
              </div>
              <div className="bg-[#0f1320] rounded-xl p-3 border border-[#1a1f2e] text-center">
                <div className="text-[8px] text-gray-600 uppercase mb-1">Top Score</div>
                <div className="text-base font-bold text-[#F59E0B]">{stats.highestScore.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a1f2e] flex items-center justify-between">
                <span className="text-[10px] font-bold">Top 50 Players</span>
                <button onClick={fetchLeaderboard} className="text-[9px] text-gray-600 flex items-center gap-1"><RotateCcw className="w-2.5 h-2.5"/>Refresh</button>
              </div>
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center">
                  <Gamepad2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <div className="text-[11px] text-gray-600">No scores yet. Be the first!</div>
                </div>
              ) : (
                <div className="divide-y divide-[#1a1f2e]/50">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.id} className={`px-4 py-3 flex items-center gap-3 ${entry.username.toLowerCase() === username.toLowerCase() ? 'bg-[#00E5FF]/[0.03]' : ''}`}>
                      <div className="w-6 flex items-center justify-center">{getRankBadge(i)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold truncate">{entry.username}</span>
                          {entry.username.toLowerCase() === username.toLowerCase() && (
                            <span className="text-[7px] px-1 py-0.5 rounded bg-[#00E5FF]/10 text-[#00E5FF] font-bold">YOU</span>
                          )}
                        </div>
                        <div className="text-[8px] text-gray-600 mt-0.5">
                          {entry.gamesPlayed} games · {entry.bestStreak}m best
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-[#F59E0B]">{entry.score.toLocaleString()}</div>
                        <div className="text-[8px] text-gray-600">{entry.coins} coins</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              disabled={!username.trim()}
              className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> Play Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
