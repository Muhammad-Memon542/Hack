"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  yesPct,
  volume,
  userById,
  categoryVisual,
  type Market,
} from "@/lib/mock";
import { useApp } from "@/app/providers";
import { StatusBadge, Avatar } from "./primitives";
import { UserName } from "./UserName";
import { HeartIcon } from "./icons";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function MarketCard({ market }: { market: Market }) {
  const { isFollowingMarket, toggleFollowMarket, me, positions, users, liveBets } = useApp();
  const creator = userById(market.creatorId);
  const saved = isFollowingMarket(market.id);
  const [imgOk, setImgOk] = useState(true);
  const vis = categoryVisual(market.category);
  const yes = yesPct(market);
  const settled = market.status === "SETTLED";

  // Social signal: which of the people you follow have positions on this?
  const followingSet = new Set(me.following);
  const friendBettors = new Set<string>();
  for (const p of positions) {
    if (p.marketId === market.id && followingSet.has(p.userId)) friendBettors.add(p.userId);
  }
  const friendAvatars = [...friendBettors]
    .slice(0, 3)
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as { id: string; avatar: string; color: string; picture?: string }[];
  const isHot = liveBets.some((b) => b.marketId === market.id);
  const madeByFriend = followingSet.has(market.creatorId);

  // Mouse-tracked 3D tilt.
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, on: false });
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 8, ry: px * 10, on: true });
  };
  const reset = () => setTilt({ rx: 0, ry: 0, on: false });

  return (
    <div
      className={`mcard mcard-3d ${tilt.on ? "tilting" : ""}`}
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
    >
      <Link href={`/market/${market.id}`} className="mcard-img" style={{ background: vis.grad }}>
        {!imgOk || !market.image ? (
          <span className="mcard-fallback">{vis.emoji}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={market.image} alt="" loading="lazy" onError={() => setImgOk(false)} />
        )}
        <StatusBadge status={market.status} />
        {isHot && (
          <span className="mcard-hot" title="Live trades happening now">
            <span className="live-dot" /> live
          </span>
        )}
        {madeByFriend && creator && (
          <span className="mcard-madeby">by @{creator.username}</span>
        )}
        <div className="mcard-bar">
          <div className="mcard-bar-fill" style={{ width: `${yes}%` }} />
        </div>
      </Link>

      <button
        className={`heart ${saved ? "on" : ""}`}
        aria-label={saved ? "unsave" : "save"}
        onClick={() => toggleFollowMarket(market.id)}
      >
        <HeartIcon filled={saved} />
      </button>

      <div className="mcard-body">
        <Link href={`/market/${market.id}`} className="mcard-q">
          <span>{market.question}</span>
          <span className="mcard-pct"><span className="star">★</span> {yes}%</span>
        </Link>
        {creator && (
          <div className="mcard-creator-row">
            <Link href={`/u/${creator.username}`} aria-label={`View @${creator.username}`}>
              <Avatar emoji={creator.avatar} color={creator.color} size={20} src={creator.picture} />
            </Link>
            <UserName username={creator.username} className="mcard-creator" />
          </div>
        )}
        <div className="mcard-resolve">
          {settled ? "Resolved" : "Resolves"} {shortDate(settled && market.resolvedAt ? market.resolvedAt : market.closesAt)}
        </div>
        <div className="mcard-footer">
          <div className="mcard-vol">
            <b>${volume(market).toFixed(2)}</b>
            <span className="dim"> vol</span>
          </div>
          {friendAvatars.length > 0 && (
            <div className="mcard-friends" title={`${friendBettors.size} friend${friendBettors.size === 1 ? "" : "s"} bet on this`}>
              <div className="mcard-friends-stack">
                {friendAvatars.map((u) => (
                  <Avatar key={u.id} emoji={u.avatar} color={u.color} size={18} src={u.picture} />
                ))}
              </div>
              <span className="mcard-friends-lbl">
                {friendBettors.size} friend{friendBettors.size === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
