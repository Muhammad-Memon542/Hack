"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { userByName, marketsByCreator, echoPercentile, type User } from "@/lib/mock";
import { Avatar } from "./primitives";
import { useApp } from "@/app/providers";

// 5-minute cache of profile summaries, per spec.
interface CachedSummary {
  user: User;
  at: number;
}
const CACHE = new Map<string, CachedSummary>();
const CACHE_TTL = 5 * 60 * 1000;

function getSummary(username: string): User | undefined {
  const hit = CACHE.get(username);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.user;
  const user = userByName(username);
  if (user) CACHE.set(username, { user, at: Date.now() });
  return user;
}

// Renders "@username" that reveals a mini-profile hover card after 300ms.
export function UserName({ username, className }: { username: string; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = getSummary(username);
  const { isFollowing, toggleFollow, me } = useApp();

  const open = (e: React.MouseEvent) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 296);
    const y = rect.bottom + 8;
    timer.current = setTimeout(() => setPos({ x, y }), 300);
  };
  const scheduleClose = () => {
    if (timer.current) clearTimeout(timer.current);
    closeTimer.current = setTimeout(() => setPos(null), 180);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  if (!user) return <span className={className}>@{username}</span>;

  const recent = marketsByCreator(user.id).slice(0, 3);
  const following = isFollowing(user.id);
  const isMe = user.id === me.id;

  return (
    <span style={{ position: "relative" }}>
      <Link
        href={`/u/${username}`}
        className={`uname ${className ?? ""}`}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
      >
        @{username}
      </Link>
      {pos && (
        <div
          className="hovercard"
          style={{ left: pos.x, top: pos.y }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="row" style={{ gap: "0.6rem" }}>
            <Avatar emoji={user.avatar} color={user.color} size={40} />
            <div>
              <Link href={`/u/${username}`} className="uname" style={{ fontSize: "0.95rem" }}>
                @{user.username}
              </Link>
              <div className="faint" style={{ fontSize: "0.78rem" }}>
                {user.followers.length} followers
              </div>
            </div>
          </div>
          <div className="hc-stats">
            <div className="hc-stat">
              <div className="v escore">{user.echoScore}</div>
              <div className="l">Echo · {echoPercentile(user.echoScore)}</div>
            </div>
            <div className="hc-stat">
              <div className="v">{Math.round(user.accuracy * 100)}%</div>
              <div className="l">Accuracy</div>
            </div>
          </div>
          {recent.length > 0 && (
            <div className="stack" style={{ gap: "0.25rem", marginBottom: "0.7rem" }}>
              {recent.map((m) => (
                <Link
                  key={m.id}
                  href={`/market/${m.id}`}
                  className="faint"
                  style={{ fontSize: "0.8rem", lineHeight: 1.3 }}
                >
                  · {m.question.length > 46 ? m.question.slice(0, 46) + "…" : m.question}
                </Link>
              ))}
            </div>
          )}
          {!isMe && (
            <button
              className={`btn btn-sm btn-block follow-btn ${following ? "following" : ""}`}
              onClick={() => toggleFollow(user.id)}
            >
              {following ? "Following" : "+ Follow"}
            </button>
          )}
        </div>
      )}
    </span>
  );
}
