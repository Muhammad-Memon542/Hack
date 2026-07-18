"use client";

import type { MarketStatus, Side } from "@/lib/mock";

// ---------- Avatar ----------
export function Avatar({
  emoji,
  color,
  size = 34,
  src,
}: {
  emoji: string;
  color: string;
  size?: number;
  src?: string;
}) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
        />
      ) : (
        emoji
      )}
    </span>
  );
}

// ---------- Status badge (standardized: outline + dot; DISPUTED/SETTLED filled) ----------
export function StatusBadge({ status }: { status: MarketStatus }) {
  return (
    <span className={`badge ${status}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

// ---------- Odds / progress bar ----------
export function OddsBar({ yesPct }: { yesPct: number }) {
  const noPct = 100 - yesPct;
  return (
    <div className="odds">
      <div className="odds-track" role="progressbar" aria-valuenow={yesPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="odds-fill" style={{ width: `${yesPct}%` }} />
      </div>
      <div className="odds-legend">
        <span className="y">YES {yesPct}%</span>
        <span className="n">NO {noPct}%</span>
      </div>
    </div>
  );
}

// ---------- Position tag ----------
export function PositionTag({ side, amount }: { side: Side; amount: number }) {
  return (
    <span className={`pos-tag ${side.toLowerCase()}`}>
      bet {side}, {amount} USDC
    </span>
  );
}
