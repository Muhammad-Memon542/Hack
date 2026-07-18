"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { yesPct, volume, type Market } from "@/lib/mock";

// Deterministic PRNG so the seeded history matches on server + first client render.
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

const VIEW_W = 680;
const VIEW_H = 210;
const PAD = { l: 10, r: 44, t: 18, b: 22 };
const N = 40;
const clamp = (v: number) => Math.max(2, Math.min(98, v));

interface Point {
  t: number;
  yes: number;
}

// Catmull-Rom → cubic bezier for a smooth, organic curve.
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function OddsChart({ market }: { market: Market }) {
  const target = yesPct(market);
  const live = market.status === "OPEN";

  const initial = useMemo<Point[]>(() => {
    const rnd = mulberry32(hash(market.id));
    const pts: Point[] = [];
    let v = 50;
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      v = clamp(v + (target - v) * 0.1 + (rnd() - 0.5) * 9);
      pts.push({ t: now - (N - 1 - i) * 60_000, yes: v });
    }
    pts[pts.length - 1].yes = target;
    return pts;
  }, [market.id, target]);

  const [series, setSeries] = useState<Point[]>(initial);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track the real odds (updates when bot trades move the market).
  useEffect(() => {
    setSeries((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], yes: target };
      return next;
    });
  }, [target]);

  // Live tick: drift the tail, pulled toward the true current odds.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1].yes;
        const v = clamp(last + (target - last) * 0.25 + (Math.random() - 0.5) * 4);
        return [...prev.slice(1), { t: Date.now(), yes: v }];
      });
    }, 2000);
    return () => clearInterval(id);
  }, [live, target]);

  const plotW = VIEW_W - PAD.l - PAD.r;
  const plotH = VIEW_H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / (series.length - 1)) * plotW;
  const y = (v: number) => PAD.t + (1 - v / 100) * plotH;

  const pts = series.map((p, i) => [x(i), y(p.yes)] as [number, number]);
  const line = smoothPath(pts);
  const area = `${line} L ${x(series.length - 1)},${y(0)} L ${PAD.l},${y(0)} Z`;

  // NO is the mirror of YES (they sum to 100). Plot it as its own red line.
  const ptsNo = series.map((p, i) => [x(i), y(100 - p.yes)] as [number, number]);
  const lineNo = smoothPath(ptsNo);

  const cur = Math.round(series[series.length - 1].yes);
  const no = 100 - cur;
  const first = Math.round(series[0].yes);
  const delta = cur - first;
  const vals = series.map((p) => p.yes);
  const hi = Math.round(Math.max(...vals));
  const lo = Math.round(Math.min(...vals));

  const endX = x(series.length - 1);
  const endY = y(cur);

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xv = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const idx = Math.round(((xv - PAD.l) / plotW) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, idx)));
  };

  const hp = hover != null ? series[hover] : null;

  return (
    <div className="panel oddsx">
      <div className="oddsx-head">
        <div className="oddsx-title">
          <h3 style={{ margin: 0 }}>Live odds</h3>
          {live && (
            <span className="live-badge sm">
              <span className="live-dot" /> LIVE
            </span>
          )}
        </div>
        <div className="oddsx-big">
          <span className="oddsx-yes">{cur}%</span>
          <span className="oddsx-yeslbl">YES</span>
          <span className="oddsx-yes" style={{ color: "var(--no)", marginLeft: "0.9rem" }}>{no}%</span>
          <span className="oddsx-yeslbl" style={{ color: "var(--no)" }}>NO</span>
          <span className={`oddsx-delta ${delta >= 0 ? "up" : "down"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        className="oddsx-svg"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="oxArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--yes)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="oxLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="oxLineNo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
          <filter id="oxGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* gridlines + y labels */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line
              x1={PAD.l}
              y1={y(g)}
              x2={PAD.l + plotW}
              y2={y(g)}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={g === 50 ? "5 5" : "0"}
              opacity={g === 50 ? 0.9 : 0.5}
            />
            <text x={PAD.l + plotW + 8} y={y(g) + 4} fontSize="11" fill="var(--text-faint)">
              {g}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#oxArea)" />
        {/* NO line (mirror of YES) */}
        <path
          d={lineNo}
          fill="none"
          stroke="url(#oxLineNo)"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* YES line */}
        <path
          d={line}
          fill="none"
          stroke="url(#oxLine)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#oxGlow)"
        />

        {/* hover crosshair + tooltip (both sides) */}
        {hp && hover != null && (
          <g>
            <line x1={x(hover)} y1={PAD.t} x2={x(hover)} y2={PAD.t + plotH} stroke="var(--border-bright)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(100 - hp.yes)} r="4" fill="var(--no)" stroke="var(--card)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(hp.yes)} r="4.5" fill="var(--yes)" stroke="var(--card)" strokeWidth="2" />
          </g>
        )}

        {/* live end markers with pulse */}
        {live && <circle className="oddsx-pulse" cx={endX} cy={endY} r="6" fill="var(--yes)" />}
        <circle cx={endX} cy={y(no)} r="4" fill="var(--no)" stroke="var(--card)" strokeWidth="2" />
        <circle cx={endX} cy={endY} r="4.5" fill="var(--yes)" stroke="var(--card)" strokeWidth="2" />
      </svg>

      <div className="oddsx-stats">
        <div className="oddsx-stat">
          <span className="oddsx-stat-v">${Math.round(volume(market)).toLocaleString()}</span>
          <span className="oddsx-stat-l">Volume</span>
        </div>
        <div className="oddsx-stat">
          <span className="oddsx-stat-v">{market.participants.toLocaleString()}</span>
          <span className="oddsx-stat-l">Traders</span>
        </div>
        <div className="oddsx-stat">
          <span className="oddsx-stat-v" style={{ color: "var(--yes)" }}>{hi}%</span>
          <span className="oddsx-stat-l">Session high</span>
        </div>
        <div className="oddsx-stat">
          <span className="oddsx-stat-v" style={{ color: "var(--no)" }}>{lo}%</span>
          <span className="oddsx-stat-l">Session low</span>
        </div>
        <div className="oddsx-stat oddsx-stat-hint">
          {hp ? (
            <>
              <span className="oddsx-stat-v">
                <span style={{ color: "var(--yes)" }}>{Math.round(hp.yes)}%</span>
                {" · "}
                <span style={{ color: "var(--no)" }}>{Math.round(100 - hp.yes)}%</span>
              </span>
              <span className="oddsx-stat-l">YES · NO {relTime(hp.t)}</span>
            </>
          ) : (
            <>
              <span className="oddsx-stat-v">
                <span style={{ color: "var(--yes)" }}>{cur}%</span>
                {" · "}
                <span style={{ color: "var(--no)" }}>{no}%</span>
              </span>
              <span className="oddsx-stat-l">YES · NO now</span>
            </>
          )}
        </div>
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
