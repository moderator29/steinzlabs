'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Database, BarChart3, Shield, Brain, Zap, Activity, Globe, Search, TrendingUp, Lock, Eye, Layers, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import ThemeToggle from '@/components/ThemeToggle';

// --- Particle Field Canvas ---
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 60 : 120;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string;
    }> = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.6 + 0.1,
        color: Math.random() > 0.5 ? '#7c3aed' : '#06b6d4',
      });
    }

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    let animId: number;
    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += dx * 0.00005;
          p.vy += dy * 0.00005;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });

      ctx.lineWidth = 0.5;
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.15;
            ctx.strokeStyle = '#7c3aed';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
      });

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ background: 'transparent' }}
    />
  );
}

// --- 3D Tilt Card ---
function Card3D({ children, className = '', glowColor = '#7c3aed' }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateY = (x / rect.width) * 15;
    const rotateX = -(y / rect.height) * 15;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
    card.style.boxShadow = `0 20px 60px ${glowColor}20, 0 0 0 1px ${glowColor}25`;
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform =
        'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      cardRef.current.style.boxShadow = '';
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.15s ease, box-shadow 0.15s ease', transformStyle: 'preserve-3d', willChange: 'transform' }}
      className={className}
    >
      {children}
    </div>
  );
}

function AnimatedCounter({ value, label }: { value: string; label: string }) {
  const match = value.match(/^([^0-9]*)(\d[\d,.]*)(.*)$/);
  const hasNumber = !!match;
  const prefix = match ? match[1] : '';
  const numericStr = match ? match[2].replace(/,/g, '') : '';
  const suffix = match ? match[3] : '';
  const target = hasNumber ? parseFloat(numericStr) : 0;
  const isAnimatable = hasNumber && !isNaN(target) && target > 0;
  const [display, setDisplay] = useState(isAnimatable ? `${prefix}0${suffix}` : value);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isAnimatable) {
      setDisplay(value);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1800;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = target * eased;
            if (numericStr.includes('.')) {
              setDisplay(`${prefix}${current.toFixed(1)}${suffix}`);
            } else {
              setDisplay(`${prefix}${Math.floor(current).toLocaleString()}${suffix}`);
            }
            if (progress < 1) requestAnimationFrame(animate);
            else setDisplay(value);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, isAnimatable, numericStr, target, prefix, suffix]);

  return (
    <div ref={ref} className="text-center p-4 rounded-xl border border-purple-500/10 bg-purple-500/5 hover:border-purple-500/30 transition-all duration-300 group"
      style={{ boxShadow: '0 0 20px rgba(124,58,237,0.05)' }}>
      <div className="text-2xl md:text-3xl font-heading font-bold text-white group-hover:text-purple-300 transition-colors">
        {display}
      </div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

const featureCategories = [
  {
    tag: "Intelligence",
    title: "On-chain data, decoded",
    description: "Real-time blockchain analytics across 12+ chains. Surface whale movements, track smart money flows, and discover alpha before the crowd.",
    features: [
      { icon: Database, label: "Multi-chain indexing" },
      { icon: Activity, label: "Real-time event feeds" },
      { icon: Eye, label: "Whale movement tracking" },
      { icon: Globe, label: "Cross-chain analytics" },
    ],
    accent: "#0A1EFF",
  },
  {
    tag: "Trading",
    title: "Execute with confidence",
    description: "Built-in swap aggregation, portfolio tracking, and trading DNA analysis. Understand your patterns, optimize your edge, and trade smarter.",
    features: [
      { icon: TrendingUp, label: "Portfolio P&L tracking" },
      { icon: BarChart3, label: "Trading DNA profiling" },
      { icon: Layers, label: "Multi-chain swaps" },
      { icon: Search, label: "Token discovery" },
    ],
    accent: "#7C3AED",
  },
  {
    tag: "Security",
    title: "Never get rugged again",
    description: "AI-powered contract analysis, rug detection, and risk scoring. Every token scanned, every wallet profiled, every risk surfaced before you commit.",
    features: [
      { icon: Shield, label: "AI risk scoring (0–100)" },
      { icon: Lock, label: "Contract audit verification" },
      { icon: Zap, label: "Rug pull detection" },
      { icon: Eye, label: "MEV protection alerts" },
    ],
    accent: "#10B981",
  },
  {
    tag: "AI Engine",
    title: "Your on-chain copilot",
    description: "VTX AI processes millions of signals to deliver actionable insights. Ask questions in plain English, get answers backed by real blockchain data.",
    features: [
      { icon: Brain, label: "Natural language queries" },
      { icon: Activity, label: "Signal aggregation" },
      { icon: Database, label: "Context-aware feed" },
      { icon: Zap, label: "Predictive analytics" },
    ],
    accent: "#F59E0B",
  },
];

const faqs = [
  {
    q: "What is STEINZ LABS?",
    a: "STEINZ LABS is a professional on-chain intelligence platform. We analyze blockchain data across Ethereum, Solana, BSC, Polygon, and 8+ other chains to surface actionable insights — whale moves, risk signals, and trading opportunities.",
  },
  {
    q: "How do I get started?",
    a: "Create a free account to access real-time feeds, basic analytics, and market overview. Upgrade to STEINZ Pro for unlimited whale tracking, DNA Analyzer, advanced portfolio analytics, and priority signals.",
  },
  {
    q: "Is my wallet data private?",
    a: "100%. We never store your private keys. When you connect your wallet, we only read public blockchain data. Your funds remain under your control at all times. Fully non-custodial.",
  },
  {
    q: "What chains do you support?",
    a: "Ethereum, Solana, BSC, Polygon, Arbitrum, Optimism, Avalanche, Base, Fantom, Bitcoin, and Tron. More chains added based on community demand.",
  },
  {
    q: "How accurate is the whale tracking?",
    a: "We track verified whale wallets (>$1M holdings) in real-time. Every signal links to the actual on-chain transaction — verify it yourself on Etherscan or Solscan.",
  },
  {
    q: "What's included in the free tier?",
    a: "Free tier includes real-time feeds and basic analytics. Upgrade to STEINZ Pro for unlimited whale tracking, DNA Analyzer, advanced portfolio analytics, and priority signals.",
  },
];

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const stats = [
    { value: "12+", label: "Chains" },
    { value: "1000000+", label: "Datasets Indexed" },
    { value: "24/7", label: "Live Monitoring" },
    { value: "100%", label: "Non-Custodial" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white overflow-x-hidden">
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-lg shadow-black/20' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SteinzLogo size={28} />
            <span className="text-sm font-heading font-bold tracking-tight">STEINZ LABS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/whitepaper" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block text-[13px] font-medium text-gray-300 hover:text-white px-3 py-2 transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="hidden sm:flex items-center bg-white text-black px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-gray-100 transition-all">
              Sign Up
            </Link>
            <div className="flex sm:hidden items-center gap-1">
              <Link href="/login" className="text-[13px] font-medium text-gray-300 hover:text-white px-2 py-1.5 transition-colors">
                Log In
              </Link>
              <Link href="/signup" className="bg-white text-black px-3 py-1.5 rounded-lg text-[12px] font-semibold hover:bg-gray-100 transition-all">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden min-h-screen flex flex-col justify-center">
        {/* Particle canvas */}
        <ParticleField />

        {/* Floating orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl animate-pulse"
            style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }}
          />
          <div
            className="absolute bottom-40 right-1/4 w-72 h-72 rounded-full blur-3xl animate-pulse"
            style={{ background: 'radial-gradient(circle, #06b6d4, transparent)', opacity: 0.08, animationDelay: '1s' }}
          />
          <div
            className="absolute top-1/2 right-10 w-48 h-48 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', opacity: 0.05 }}
          />
          <div
            className="absolute top-[30%] left-[5%] w-64 h-64 rounded-full blur-3xl animate-pulse"
            style={{ background: 'radial-gradient(circle, #06b6d4, transparent)', opacity: 0.06, animationDelay: '2s' }}
          />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-purple-500/20 rounded-full mb-8"
          >
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="text-[12px] text-gray-400 font-medium">Professional on-chain intelligence platform</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 leading-[1.08] tracking-tight"
          >
            The intelligence layer
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)' }}
            >
              for on-chain alpha
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed"
          >
            Track whales. Analyze wallets. Scan contracts. Act on real-time blockchain data before the crowd.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto mb-16"
          >
            <Link
              href="/login"
              className="flex-1 w-full px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 30px rgba(124,58,237,0.4)',
              }}
            >
              Launch App <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/whitepaper"
              className="flex-1 w-full px-6 py-3.5 rounded-xl font-semibold text-sm text-gray-300 border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-center"
            >
              Read Docs
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-2xl mx-auto mb-16"
          >
            {stats.map((stat) => (
              <AnimatedCounter key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </motion.div>

          {/* 3D Platform Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative mx-auto max-w-4xl"
            style={{ perspective: '1000px' }}
          >
            <div
              className="rounded-2xl overflow-hidden border border-purple-500/30"
              style={{
                transform: 'rotateX(12deg) rotateY(-4deg)',
                boxShadow: '0 40px 80px rgba(124,58,237,0.3), 0 0 0 1px rgba(124,58,237,0.1)',
                willChange: 'transform',
              }}
            >
              <div className="bg-gray-950 p-4">
                <div className="flex gap-2 mb-4 items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="text-xs text-gray-500 ml-2 font-mono">steinz.app/dashboard</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 h-32 bg-purple-900/40 rounded-lg border border-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400 text-sm font-mono">VTX Intelligence</span>
                  </div>
                  <div className="h-32 bg-cyan-900/30 rounded-lg border border-cyan-500/20 flex items-center justify-center">
                    <span className="text-cyan-400 text-xs font-mono">Live Feed</span>
                  </div>
                  <div className="h-20 bg-gray-800/60 rounded-lg border border-gray-700/40 flex items-center justify-center">
                    <span className="text-gray-500 text-xs font-mono">Whale Tracker</span>
                  </div>
                  <div className="h-20 bg-gray-800/60 rounded-lg border border-purple-700/40 flex items-center justify-center">
                    <span className="text-purple-500 text-xs font-mono">DNA Analyzer</span>
                  </div>
                  <div className="h-20 bg-gray-800/60 rounded-lg border border-cyan-700/40 flex items-center justify-center">
                    <span className="text-cyan-500 text-xs font-mono">Risk Score</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow reflection under the preview */}
            <div
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-12 blur-2xl rounded-full opacity-30"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
            />
          </motion.div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="features"
        ref={(el) => { sectionRefs.current['features'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-neon-blue text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">Platform</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Built for serious analysts
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              Four integrated modules working together to give you a complete picture of on-chain activity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featureCategories.map((category, i) => (
              <motion.div
                key={category.tag}
                initial={{ opacity: 0, y: 30 }}
                animate={visibleSections.has('features') ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card3D className="rounded-xl border border-purple-500/10 bg-gray-900/60 p-6 sm:p-8 hover:border-purple-500/25 transition-colors duration-300 group h-full"
                  style={{ boxShadow: `0 0 30px ${category.accent}08` } as React.CSSProperties}>
                  <div
                    className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-4 px-2.5 py-1 rounded-md inline-block"
                    style={{ color: category.accent, background: `${category.accent}15` }}
                  >
                    {category.tag}
                  </div>
                  <h3 className="text-lg font-heading font-bold mb-2 group-hover:text-white transition-colors">{category.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">{category.description}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {category.features.map((f) => {
                      const Icon = f.icon;
                      return (
                        <div key={f.label} className="flex items-center gap-2.5 text-[13px] text-gray-400">
                          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: category.accent }} />
                          <span>{f.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card3D>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="security"
        ref={(el) => { sectionRefs.current['security'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className={`max-w-4xl mx-auto transition-all duration-700 ${visibleSections.has('security') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 sm:p-12">
            <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
              <div className="flex-1">
                <p className="text-success text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">Security First</p>
                <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">
                  Your assets, your control
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Non-custodial by design. We read public blockchain data only — your private keys never leave your wallet. Every analysis runs on verified on-chain transactions.
                </p>
                <div className="space-y-4">
                  {[
                    { label: "Non-custodial architecture", desc: "We never have access to your funds" },
                    { label: "Read-only data access", desc: "Public blockchain data only, no write permissions" },
                    { label: "Verified on-chain sources", desc: "Every data point traceable to its transaction" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-[13px] text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "0", label: "Private keys stored" },
                    { value: "100%", label: "Non-custodial" },
                    { value: "12+", label: "Chains secured" },
                    { value: "24/7", label: "Monitoring" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center min-w-[120px]">
                      <div className="text-lg font-heading font-bold text-white">{s.value}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="pricing"
        ref={(el) => { sectionRefs.current['pricing'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className={`max-w-4xl mx-auto transition-all duration-700 ${visibleSections.has('pricing') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-12">
            <p className="text-neon-blue text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">Plans</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Unlock the full intelligence layer
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              Choose a plan that fits your needs — from free analytics to professional-grade intelligence tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                tier: "Free",
                price: "$0",
                desc: "Get started with core features",
                perks: ["Real-time context feed", "Basic token scanner", "Market overview", "VTX Agent (15 msgs/day)"],
                accent: "#6B7280",
                cta: "Start Free",
                link: "/signup",
              },
              {
                tier: "STEINZ Pro",
                price: "$19/mo",
                desc: "Full intelligence suite unlocked",
                perks: ["DNA Wallet Analyzer (AI)", "Unlimited whale tracking", "Advanced portfolio analytics", "Unlimited VTX Agent"],
                accent: "#0A1EFF",
                cta: "Coming Soon",
                featured: true,
                link: "#",
              },
              {
                tier: "Premium",
                price: "$99/mo",
                desc: "Maximum power for professionals",
                perks: ["Everything in Pro tier", "API access for developers", "Custom webhook alerts", "Priority support"],
                accent: "#F59E0B",
                cta: "Coming Soon",
                link: "#",
              },
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-xl border p-6 ${plan.featured ? 'border-neon-blue/30 bg-neon-blue/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}
              >
                {plan.featured && (
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neon-blue mb-3">Most Popular</div>
                )}
                <h3 className="text-lg font-heading font-bold mb-1" style={{ color: plan.accent }}>{plan.tier}</h3>
                <div className="text-xl font-bold mb-1">{plan.price}</div>
                <p className="text-gray-500 text-xs mb-4">{plan.desc}</p>
                <div className="space-y-2 mb-6">
                  {plan.perks.map((perk) => (
                    <div key={perk} className="flex items-center gap-2 text-[13px] text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: plan.accent }}></div>
                      {perk}
                    </div>
                  ))}
                </div>
                <Link href={plan.link}>
                  <button
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={plan.featured ? { backgroundColor: plan.accent, color: 'white' } : { border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF' }}
                    disabled={plan.cta === 'Coming Soon'}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="faq"
        ref={(el) => { sectionRefs.current['faq'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className={`max-w-2xl mx-auto transition-all duration-700 ${visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-12">
            <p className="text-neon-blue text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">FAQ</p>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`rounded-xl border transition-all duration-300 ${
                  openFAQ === index
                    ? 'border-neon-blue/20 bg-neon-blue/[0.02]'
                    : 'border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full px-5 py-4 flex justify-between items-center text-left"
                >
                  <span className="font-semibold text-sm pr-3">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFAQ === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section className="py-24 px-4 sm:px-6 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-blue/[0.03] rounded-full blur-[150px]"></div>
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Start your intelligence journey
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">
            Free to start. No credit card required. Sign in with email to unlock STEINZ LABS intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
            <Link href="/login" className="flex-1 w-full bg-neon-blue px-8 py-4 rounded-xl font-semibold text-sm text-white hover:bg-neon-blue-400 transition-all shadow-neon flex items-center justify-center gap-2">
              Launch App <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/whitepaper" className="flex-1">
              <button className="w-full px-8 py-4 rounded-xl font-semibold text-sm text-gray-300 border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2">
                Learn More
              </button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <SteinzLogo size={24} />
                <span className="text-sm font-heading font-bold">STEINZ LABS</span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">
                Professional on-chain intelligence platform.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-xs mb-3 text-gray-300 uppercase tracking-wider">Product</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></div>
                <div><Link href="/dashboard/dna-analyzer" className="hover:text-white transition-colors">DNA Analyzer</Link></div>
                <div><Link href="/dashboard/security" className="hover:text-white transition-colors">Security Scanner</Link></div>
                <div><Link href="/dashboard/vtx-ai" className="hover:text-white transition-colors">VTX AI</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-xs mb-3 text-gray-300 uppercase tracking-wider">Resources</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div><Link href="/whitepaper" className="hover:text-white transition-colors">Whitepaper</Link></div>
                <div><Link href="/whitepaper#architecture" className="hover:text-white transition-colors">Documentation</Link></div>
                <div><Link href="/dashboard/trading-suite" className="hover:text-white transition-colors">STEINZ Terminal</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-xs mb-3 text-gray-300 uppercase tracking-wider">Community</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div><a href="https://x.com/steinzlabs" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter / X</a></div>
                <div><span className="hover:text-white transition-colors cursor-pointer">Telegram</span></div>
                <div><span className="hover:text-white transition-colors cursor-pointer">Discord</span></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.06] pt-8">
            <div className="flex items-center gap-3">
              <p className="text-gray-600 text-[11px]">&copy; 2026 STEINZ LABS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
