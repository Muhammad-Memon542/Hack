"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { yesPct, type Market } from "@/lib/mock";

// Deterministic PRNG so the initial series matches on server + first client render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const VIEW_W = 640;
const VIEW_H = 240;
const PAD = { l: 8, r: 46, t: 16, b: 24 };
const N = 34;
const clamp = (v: number) => Math.max(2, Math.min(98, v));

interface Point {
  t: number;
  yes: number;
}

export function OddsChart({ market }: { market: Market }) {
  const target = yesPct(market);

  // Seeded history that converges toward the current YES odds.
  const initial = useMemo<Point[]>(() => {
    const rnd = mulberry32(hash(market.id));
    const pts: Point[] = [];
    let v = 50;
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      const pull = (target - v) * 0.12;
      v = clamp(v + pull + (rnd() - 0.5) * 8);
      pts.push({ t: now - (N - 1 - i) * 60_000, yes: v });
    }
    pts[pts.length - 1].yes = target;
    return pts;
  }, [market.id, target]);

  const [series, setSeries] = useState<Point[]>(initial);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const live = market.status === "OPEN";

  // Keep the latest point synced to the real odds (e.g. after a bet lands).
  useEffect(() => {
    setSeries((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], yes: target };
      return next;
    });
  }, [target]);

  // Live random-walk tick for open markets.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1].yes;
        const v = clamp(last + (Math.random() - 0.5) * 5);
        const next = [...prev.slice(1), { t: Date.now(), yes: v }];
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [live]);

  const plotW = VIEW_W - PAD.l - PAD.r;
  const plotH = VIEW_H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / (series.length - 1)) * plotW;
  const y = (v: number) => PAD.t + (1 - v / 100) * plotH;

  const yesLine = series.map((p, i) => `${x(i)},${y(p.yes)}`).join(" ");
  const noLine = series.map((p, i) => `${x(i)},${y(100 - p.yes)}`).join(" ");
  const yesArea = `${PAD.l},${y(0)} ${yesLine} ${x(series.length - 1)},${y(0)}`;

  const curYes = Math.round(series[series.length - 1].yes);
  const curNo = 100 - curYes;

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xv = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const idx = Math.round(((xv - PAD.l) / plotW) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, idx)));
  };

  const hp = hover != null ? series[hover] : null;

  return (
    <div className="panel">
      <div className="between" style={{ marginBottom: "0.6rem" }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          Live odds
          {live && (
            <span className="live-pill">
              <span className="live-dot" /> LIVE
            </span>
          )}
        </h3>
        <div className="row" style={{ gap: "0.9rem" }}>
          <span style={{ color: "var(--yes)", fontWeight: 800 }}>YES {curYes}%</span>
          <span style={{ color: "var(--no)", fontWeight: 800 }}>NO {curNo}%</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="yesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--yes)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* midline at 50% */}
        <line x1={PAD.l} y1={y(50)} x2={PAD.l + plotW} y2={y(50)} stroke="var(--border-bright)" strokeWidth="1" strokeDasharray="4 4" />
        <text x={PAD.l + plotW + 6} y={y(50) + 4} fontSize="11" fill="var(--text-faint)">50%</text>

        {/* YES area + lines */}
        <polygon points={yesArea} fill="url(#yesFill)" />
        <polyline points={noLine} fill="none" stroke="var(--no)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={yesLine} fill="none" stroke="var(--yes)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

        {/* end markers + direct labels */}
        <circle cx={x(series.length - 1)} cy={y(curYes)} r="4.5" fill="var(--yes)" stroke="var(--card)" strokeWidth="2" />
        <circle cx={x(series.length - 1)} cy={y(curNo)} r="4.5" fill="var(--no)" stroke="var(--card)" strokeWidth="2" />

        {/* hover crosshair */}
        {hp && hover != null && (
          <g>
            <line x1={x(hover)} y1={PAD.t} x2={x(hover)} y2={PAD.t + plotH} stroke="var(--border-bright)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(hp.yes)} r="4" fill="var(--yes)" stroke="var(--card)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(100 - hp.yes)} r="4" fill="var(--no)" stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>

      <div className="between" style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginTop: "0.2rem" }}>
        <span>{hp ? relTime(hp.t) : "1h ago"}</span>
        <span>{hp ? `YES ${Math.round(hp.yes)}% · NO ${Math.round(100 - hp.yes)}%` : "now"}</span>
      </div>
    </div>
  );
}

function relTime(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
