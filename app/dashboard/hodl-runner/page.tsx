'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, Medal, Star, Play, ArrowLeft, Users, Gamepad2,
  Crown, Zap, Heart, Flame, Target, RefreshCw, Volume2, VolumeX
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
  const gameRef = useRef<any>(null);
  const animRef = useRef<number>(0);

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

  const startGame = useCallback(() => {
    if (!username.trim()) return;
    localStorage.setItem('hodl_runner_username', username.trim());
    setGameState('playing');

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
    const PLAYER_SIZE = 28;

    const game = {
      player: { x: 60, y: GROUND_Y - PLAYER_SIZE, vy: 0, jumping: false, doubleJump: false, ducking: false },
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
      shakeX: 0,
      shakeY: 0,
      groundOffset: 0,
      phase: 0,
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
        game.player.vy = -11;
        game.player.jumping = true;
        addParticles(game.player.x, game.player.y + PLAYER_SIZE, '#00E5FF', 5);
      } else if (!game.player.doubleJump) {
        game.player.vy = -9;
        game.player.doubleJump = true;
        addParticles(game.player.x, game.player.y + PLAYER_SIZE, '#7C3AED', 5);
      }
    };

    const handleKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); } };
    const handleTouch = (e: TouchEvent) => { e.preventDefault(); jump(); };
    const handleClick = () => { if (game.alive) jump(); };

    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('click', handleClick);

    const drawPlayer = () => {
      const p = game.player;
      const px = p.x + game.shakeX;
      const py = p.y + game.shakeY;

      ctx.save();

      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 12;
      const grad = ctx.createLinearGradient(px, py, px, py + PLAYER_SIZE);
      grad.addColorStop(0, '#00E5FF');
      grad.addColorStop(1, '#7C3AED');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(px - PLAYER_SIZE / 2, py, PLAYER_SIZE, PLAYER_SIZE, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#060A12';
      ctx.beginPath();
      ctx.roundRect(px - 8, py + 6, 6, 5, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 6, 6, 5, 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 5, py + 8, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 5, py + 8, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 4);
      ctx.lineTo(px + 3, py - 4);
      ctx.lineTo(px + 1, py + 2);
      ctx.lineTo(px - 1, py + 2);
      ctx.fill();

      if (p.jumping) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.beginPath();
        ctx.moveTo(px - 6, py + PLAYER_SIZE);
        ctx.lineTo(px, py + PLAYER_SIZE + 10 + Math.random() * 4);
        ctx.lineTo(px + 6, py + PLAYER_SIZE);
        ctx.fill();
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

    const gameLoop = () => {
      if (!game.alive) return;

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

      game.player.vy += 0.55;
      game.player.y += game.player.vy;

      if (game.player.y >= GROUND_Y - PLAYER_SIZE) {
        game.player.y = GROUND_Y - PLAYER_SIZE;
        game.player.vy = 0;
        game.player.jumping = false;
        game.player.doubleJump = false;
      }

      game.frameCount++;
      game.distance++;
      game.score = Math.floor(game.distance / 5) + game.coinCount;
      game.speed = 5 + game.distance * 0.002;
      if (game.speed > 14) game.speed = 14;

      if (game.frameCount % Math.max(40, 90 - Math.floor(game.distance / 20)) === 0) {
        spawnObstacle();
      }
      if (game.frameCount % 70 === 0) {
        spawnCoin();
      }

      game.obstacles.forEach(ob => {
        ob.x -= game.speed;
        drawObstacle(ob);

        const playerLeft = game.player.x - PLAYER_SIZE / 2 + 4;
        const playerTop = game.player.y + 4;
        const playerW = PLAYER_SIZE - 8;
        const playerH = PLAYER_SIZE - 4;

        if (ob.type === 'rug') {
          if (checkCollision(playerLeft, playerTop, playerW, playerH, ob.x - ob.width / 2, ob.y - 2, ob.width, ob.height + 4)) {
            game.alive = false;
          }
        } else if (ob.type === 'bear') {
          const dist = Math.hypot(game.player.x - ob.x, (game.player.y + PLAYER_SIZE / 2) - (ob.y + 10));
          if (dist < 16) {
            game.alive = false;
          }
        } else {
          if (checkCollision(playerLeft, playerTop, playerW, playerH, ob.x - ob.width / 2, ob.y, ob.width, ob.height)) {
            game.alive = false;
          }
        }
      });

      game.coins.forEach(coin => {
        if (coin.collected) return;
        coin.x -= game.speed;
        drawCoin(coin);

        const dist = Math.hypot(game.player.x - coin.x, (game.player.y + PLAYER_SIZE / 2) - coin.y);
        if (dist < PLAYER_SIZE / 2 + coin.radius) {
          coin.collected = true;
          game.coinCount += coin.value;
          const colors = { btc: '#F59E0B', eth: '#627EEA', sol: '#14F195' };
          addParticles(coin.x, coin.y, colors[coin.type], 8);
        }
      });

      game.obstacles = game.obstacles.filter(ob => ob.x > -60);
      game.coins = game.coins.filter(c => c.x > -20 || !c.collected);

      game.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life--;
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x + game.shakeX, p.y + game.shakeY, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      });
      game.particles = game.particles.filter(p => p.life > 0);

      if (game.player.jumping) {
        if (game.frameCount % 3 === 0) {
          game.particles.push({
            x: game.player.x, y: game.player.y + PLAYER_SIZE,
            vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(),
            life: 15, maxLife: 15, color: '#00E5FF', size: 2,
          });
        }
      }

      drawPlayer();

      if (game.shakeX !== 0 || game.shakeY !== 0) {
        game.shakeX *= 0.9;
        game.shakeY *= 0.9;
        if (Math.abs(game.shakeX) < 0.5) game.shakeX = 0;
        if (Math.abs(game.shakeY) < 0.5) game.shakeY = 0;
      }

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${game.score}`, 12, 24);

      ctx.fillStyle = '#F59E0B';
      ctx.font = '11px sans-serif';
      ctx.fillText(`Coins: ${game.coinCount}`, 12, 42);

      ctx.fillStyle = '#00E5FF';
      ctx.fillText(`${Math.floor(game.distance)}m`, 12, 58);

      const speedPct = Math.min(100, ((game.speed - 5) / 9) * 100);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(W - 80, 12, 68, 6, 3);
      ctx.fill();
      const speedGrad = ctx.createLinearGradient(W - 80, 0, W - 12, 0);
      speedGrad.addColorStop(0, '#10B981');
      speedGrad.addColorStop(1, '#EF4444');
      ctx.fillStyle = speedGrad;
      ctx.beginPath();
      ctx.roundRect(W - 80, 12, 68 * speedPct / 100, 6, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('SPEED', W - 12, 28);

      if (!game.alive) {
        game.shakeX = (Math.random() - 0.5) * 10;
        game.shakeY = (Math.random() - 0.5) * 10;

        addParticles(game.player.x, game.player.y + PLAYER_SIZE / 2, '#EF4444', 20);
        addParticles(game.player.x, game.player.y + PLAYER_SIZE / 2, '#F59E0B', 10);

        setTimeout(() => {
          setFinalScore(game.score);
          setFinalCoins(game.coinCount);
          setFinalDistance(Math.floor(game.distance));
          submitScore(game.score, game.coinCount, Math.floor(game.distance));
          setGameState('gameover');
        }, 600);

        let deathFrame = 0;
        const deathAnim = () => {
          if (deathFrame > 30) return;
          deathFrame++;
          ctx.clearRect(0, 0, W, H);
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, W, H);

          const shake = Math.max(0, 10 - deathFrame * 0.3);
          const sx = (Math.random() - 0.5) * shake;
          const sy = (Math.random() - 0.5) * shake;

          ctx.save();
          ctx.translate(sx, sy);

          game.stars.forEach(s => {
            ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness * 0.3})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
          });

          ctx.strokeStyle = 'rgba(26, 31, 46, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, GROUND_Y);
          ctx.lineTo(W, GROUND_Y);
          ctx.stroke();

          game.obstacles.forEach(ob => drawObstacle(ob));

          game.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life--;
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          });
          game.particles = game.particles.filter(p => p.life > 0);

          ctx.restore();

          const overlay = deathFrame / 30 * 0.4;
          ctx.fillStyle = `rgba(239, 68, 68, ${overlay})`;
          ctx.fillRect(0, 0, W, H);

          requestAnimationFrame(deathAnim);
        };
        deathAnim();
        return;
      }

      animRef.current = requestAnimationFrame(gameLoop);
    };

    animRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKey);
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animRef.current);
    };
  }, [gameState === 'playing']);

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
              <div className="w-20 h-20 mx-auto mb-4 relative">
                <div className="w-20 h-20 bg-gradient-to-br from-[#00E5FF] via-[#7C3AED] to-[#EF4444] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00E5FF]/20 animate-pulse">
                  <Zap className="w-10 h-10" />
                </div>
              </div>
              <h2 className="text-xl font-heading font-bold mb-2">HODL RUNNER</h2>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto mb-1 leading-relaxed">
                Navigate your crypto astronaut through the volatile market. Jump over red candles and bears, dodge rug pulls, collect BTC, ETH, and SOL coins!
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
                  <RefreshCw className="w-4 h-4" /> Play Again
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
                <button onClick={fetchLeaderboard} className="text-[9px] text-gray-600 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5"/>Refresh</button>
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
