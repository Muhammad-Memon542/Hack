"use client";

import Link from "next/link";
import { useApp } from "@/app/providers";
import { Avatar } from "./primitives";

/**
 * Instagram-story-style horizontal strip of who's actively trading right now.
 * Pulls from the live-bet stream, de-duplicates by user, and shows up to ~14
 * pulsing avatars with the bet side coloring the ring. Tap one to jump to
 * their trade's market. Purely social signal — gives the home page a "live
 * pulse" the moment you land on it.
 */
export function NowTradingStrip() {
  const { liveBets } = useApp();

  // Latest bet per user, newest first.
  const seen = new Set<string>();
  const cards: typeof liveBets = [];
  for (const b of liveBets) {
    if (seen.has(b.userId)) continue;
    seen.add(b.userId);
    cards.push(b);
    if (cards.length >= 14) break;
  }
  if (cards.length === 0) return null;

  return (
    <div className="nowstrip">
      <div className="nowstrip-head">
        <span className="live-badge">
          <span className="live-dot" /> LIVE
        </span>
        <span className="nowstrip-title">Trading right now</span>
      </div>
      <div className="nowstrip-row">
        {cards.map((b) => (
          <Link
            key={b.id}
            href={`/u/${b.username}`}
            className="nowstrip-card"
            title={`View @${b.username} — bet on: ${b.marketQuestion}`}
          >
            <div className={`nowstrip-ring ${b.side.toLowerCase()}`}>
              <Avatar emoji={b.avatar} color={b.color} size={54} />
              <span className={`nowstrip-side ${b.side.toLowerCase()}`}>{b.side === "YES" ? "▲" : "▼"}</span>
            </div>
            <span className="nowstrip-name">@{b.username}</span>
            <span className="nowstrip-amt">${b.amount}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
