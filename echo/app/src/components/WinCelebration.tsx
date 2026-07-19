"use client";

import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  shape: "rect" | "circle" | "star";
  opacity: number;
  life: number;
}

const COLORS = [
  "#22c55e", "#4ade80", "#86efac", // greens (YES)
  "#fbbf24", "#f59e0b", "#fcd34d", // golds
  "#a78bfa", "#818cf8",            // purples
  "#38bdf8", "#67e8f9",            // cyans
  "#fb923c",                        // orange
  "#f472b6",                        // pink
];

const DURATION = 4500;
const PARTICLE_COUNT = 120;

export function WinCelebration({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [bannerPhase, setBannerPhase] = useState<"enter" | "hold" | "exit" | "gone">("gone");
  const particles = useRef<Particle[]>([]);
  const startTime = useRef(0);
  const rafId = useRef(0);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    setBannerPhase("enter");

    const enterTimer = setTimeout(() => setBannerPhase("hold"), 600);
    const exitTimer = setTimeout(() => setBannerPhase("exit"), DURATION - 800);
    const goneTimer = setTimeout(() => {
      setBannerPhase("gone");
      setVisible(false);
    }, DURATION);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(goneTimer);
    };
  }, [active]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    startTime.current = performance.now();
    particles.current = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const side = Math.random() < 0.5;
      particles.current.push({
        x: side ? -20 : W + 20,
        y: H * 0.1 + Math.random() * H * 0.3,
        vx: (side ? 1 : -1) * (3 + Math.random() * 8),
        vy: -(4 + Math.random() * 8),
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 4 + Math.random() * 8,
        shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
        opacity: 1,
        life: 0.6 + Math.random() * 0.4,
      });
    }

    // Burst from center too
    for (let i = 0; i < 60; i++) {
      const angle = (Math.PI * 2 * i) / 60 + (Math.random() - 0.5) * 0.3;
      const speed = 4 + Math.random() * 10;
      particles.current.push({
        x: W / 2 + (Math.random() - 0.5) * 100,
        y: H * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 3 + Math.random() * 7,
        shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
        opacity: 1,
        life: 0.5 + Math.random() * 0.5,
      });
    }

    const gravity = 0.15;
    const drag = 0.985;

    function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const ax = cx + Math.cos(a) * r;
        const ay = cy + Math.sin(a) * r;
        const b = a + Math.PI / 5;
        const bx = cx + Math.cos(b) * r * 0.4;
        const by = cy + Math.sin(b) * r * 0.4;
        if (i === 0) ctx.moveTo(ax, ay);
        else ctx.lineTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();
    }

    function animate() {
      const elapsed = performance.now() - startTime.current;
      const progress = elapsed / DURATION;
      if (progress >= 1) {
        ctx.clearRect(0, 0, W, H);
        return;
      }

      ctx.clearRect(0, 0, W, H);

      for (const p of particles.current) {
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        const fadeStart = p.life;
        p.opacity = progress > fadeStart ? Math.max(0, 1 - (progress - fadeStart) / (1 - fadeStart)) : 1;
        if (p.opacity <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
        }
        ctx.restore();
      }

      rafId.current = requestAnimationFrame(animate);
    }

    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="win-celebration">
      <canvas ref={canvasRef} className="win-confetti-canvas" />
      <div className={`win-banner win-banner-${bannerPhase}`}>
        <div className="win-banner-glow" />
        <div className="win-banner-content">
          <div className="win-banner-icon">&#10003;</div>
          <div className="win-banner-text">
            <div className="win-banner-title">YES wins!</div>
            <div className="win-banner-sub">Market resolved &mdash; YES bettors take the pot</div>
          </div>
        </div>
      </div>
    </div>
  );
}
