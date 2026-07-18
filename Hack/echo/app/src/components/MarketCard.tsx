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
import { StatusBadge } from "./primitives";
import { UserName } from "./UserName";
import { HeartIcon } from "./icons";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function MarketCard({ market }: { market: Market }) {
  const { isFollowingMarket, toggleFollowMarket } = useApp();
  const creator = userById(market.creatorId);
  const saved = isFollowingMarket(market.id);
  const [imgOk, setImgOk] = useState(true);
  const vis = categoryVisual(market.category);
  const yes = yesPct(market);
  const settled = market.status === "SETTLED";

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
        {creator && <UserName username={creator.username} className="mcard-creator" />}
        <div className="mcard-resolve">
          {settled ? "Resolved" : "Resolves"} {shortDate(settled && market.resolvedAt ? market.resolvedAt : market.closesAt)}
        </div>
        <div className="mcard-vol">
          <b>${volume(market).toFixed(2)}</b> USDC volume
        </div>
      </div>
    </div>
  );
}
