"use client";

import Link from "next/link";
import { useApp } from "@/app/providers";
import { relativeTime } from "@/lib/mock";
import { Avatar } from "./primitives";
import { UserName } from "./UserName";

/**
 * Per-market live trade feed. Streams the bot engine's bets on this market so
 * you can watch the book move — "@user bet $40 YES" appears the moment it lands.
 */
export function LiveTrades({ marketId }: { marketId: string }) {
  const { liveBets } = useApp();
  const trades = liveBets.filter((b) => b.marketId === marketId).slice(0, 8);

  return (
    <div className="panel">
      <div className="between" style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0 }}>Live trades</h3>
        <span className="live-badge sm">
          <span className="live-dot" /> LIVE
        </span>
      </div>
      {trades.length === 0 ? (
        <div className="faint" style={{ padding: "0.5rem 0" }}>
          Watching the tape… trades will stream in here.
        </div>
      ) : (
        <div className="trade-list">
          {trades.map((b) => (
            <div key={b.id} className="trade-row">
              <Link href={`/u/${b.username}`} className="trade-avatar" aria-label={`View @${b.username}`}>
                <Avatar emoji={b.avatar} color={b.color} size={26} />
              </Link>
              <div className="trade-main">
                <div className="trade-line">
                  <UserName username={b.username} />
                  <span className="dim"> bet </span>
                  <span className={`trade-side ${b.side.toLowerCase()}`}>{b.side}</span>
                </div>
                <div className="faint" style={{ fontSize: "0.74rem" }}>{relativeTime(b.createdAt)}</div>
              </div>
              <div className={`trade-amt ${b.side.toLowerCase()}`}>${b.amount}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
