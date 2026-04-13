'use client';

// SteinzLogo — animated node constellation logo
// Pure SVG + CSS keyframes, no external libs, works at any size

interface SteinzLogoProps {
  size?: number;       // default 36
  animated?: boolean;  // default true — set false for navbar
  className?: string;
}

// Node positions (viewBox 0 0 100 100):
//   Center: 50,50 | Top: 50,14 | Top-right: 82,32 | Bottom-right: 82,68
//   Bottom: 50,86 | Bottom-left: 18,68 | Top-left: 18,32

const OUTER_NODES = [
  { cx: 50, cy: 14, delay: '0s',    pulseDelay: '0s' },
  { cx: 82, cy: 32, delay: '0.5s',  pulseDelay: '0.4s' },
  { cx: 82, cy: 68, delay: '1s',    pulseDelay: '0.8s' },
  { cx: 50, cy: 86, delay: '1.5s',  pulseDelay: '1.2s' },
  { cx: 18, cy: 68, delay: '2s',    pulseDelay: '1.6s' },
  { cx: 18, cy: 32, delay: '2.5s',  pulseDelay: '2s' },
];

const SPOKES = OUTER_NODES.map((n, i) => ({
  x1: 50, y1: 50, x2: n.cx, y2: n.cy, delay: n.delay,
}));

const RING = [
  [50,14, 82,32],[82,32, 82,68],[82,68, 50,86],
  [50,86, 18,68],[18,68, 18,32],[18,32, 50,14],
];

const CROSS = [
  [50,14, 82,68],[82,32, 18,68],
  [82,68, 18,32],[50,14, 18,68],
];

export default function SteinzLogo({ size = 36, animated = true, className }: SteinzLogoProps) {
  const uid = `sl${size}${animated ? 1 : 0}`;

  const css = `
    @keyframes steinz-float {
      0%,100%{transform:translateY(0px)}50%{transform:translateY(-8px)}
    }
    @keyframes steinz-node-pulse {
      0%,100%{opacity:.55}50%{opacity:1}
    }
    @keyframes steinz-center-pulse {
      0%,100%{opacity:.6}50%{opacity:1}
    }
    @keyframes steinz-data {
      0%{stroke-dashoffset:40;opacity:0}
      8%{opacity:1}
      85%{opacity:.9}
      100%{stroke-dashoffset:0;opacity:0}
    }
  `;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible', flexShrink: 0 }}
    >
      <defs>
        <style>{css}</style>

        <radialGradient id={`${uid}-og`} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#4d80ff" />
          <stop offset="100%" stopColor="#0d1f88" />
        </radialGradient>
        <radialGradient id={`${uid}-cg`} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#6a9fff" />
          <stop offset="100%" stopColor="#1836cc" />
        </radialGradient>

        <filter id={`${uid}-gf`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feFlood floodColor="#1a3acc" floodOpacity="0.45" result="c" />
          <feComposite in="c" in2="b" operator="in" result="g" />
          <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g
        filter={`url(#${uid}-gf)`}
        style={animated ? { animation: 'steinz-float 4s ease-in-out infinite' } : undefined}
      >
        {/* Cross-link lines */}
        {CROSS.map(([x1,y1,x2,y2], i) => (
          <line key={`cr${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#0c1a66" strokeWidth="0.6" strokeOpacity="0.17" />
        ))}

        {/* Ring lines */}
        {RING.map(([x1,y1,x2,y2], i) => (
          <line key={`rn${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#1530aa" strokeWidth="0.85" strokeOpacity="0.38" />
        ))}

        {/* Static spoke lines */}
        {SPOKES.map((s, i) => (
          <line key={`sp${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="#2a55ee" strokeWidth="0.9" strokeOpacity="0.55" />
        ))}

        {/* Animated data-travel pulses on spokes */}
        {animated && SPOKES.map((s, i) => (
          <line key={`dt${i}`}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="#a8c8ff" strokeWidth="1.6"
            strokeDasharray="40" strokeDashoffset="40"
            style={{ animation: `steinz-data 3s ease-in-out infinite`, animationDelay: s.delay }}
          />
        ))}

        {/* Outer nodes */}
        {OUTER_NODES.map((n, i) => (
          <g key={`on${i}`}
            style={animated ? {
              animation: 'steinz-node-pulse 2.4s ease-in-out infinite',
              animationDelay: n.pulseDelay,
            } : undefined}>
            <circle cx={n.cx} cy={n.cy} r="5.5"
              fill={`url(#${uid}-og)`} stroke="rgba(77,128,255,0.45)" strokeWidth="0.8" />
            <circle cx={n.cx} cy={n.cy} r="2.2" fill="#a8c8ff" opacity="0.72" />
          </g>
        ))}

        {/* Center node */}
        <g style={animated ? { animation: 'steinz-center-pulse 1.8s ease-in-out infinite' } : undefined}>
          <circle cx="50" cy="50" r="9"
            fill={`url(#${uid}-cg)`} stroke="rgba(106,159,255,0.5)" strokeWidth="1" />
          <circle cx="50" cy="50" r="4" fill="#a0c8ff" opacity="0.82" />
          <circle cx="50" cy="50" r="1.6" fill="#ffffff" opacity="0.96" />
        </g>
      </g>
    </svg>
  );
}
