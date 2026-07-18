"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/app/providers";
import { Avatar } from "./primitives";

/**
 * Global live trade tape — a fixed bottom bar streaming the bot-trading engine's
 * bets in real time ("@user bet $40 YES on …"). Each new trade slides in; the
 * row keeps the most recent ~12. Purely presentational; data comes from the
 * live poll in Providers.
 */
export function LiveTicker() {
  const { liveBets } = useApp();
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button className="live-reopen" onClick={() => setOpen(true)} aria-label="show live trades">
        🔴 LIVE
      </button>
    );
  }

  const recent = liveBets.slice(0, 12);

  return (
    <div className="live-ticker" role="log" aria-live="polite">
      <div className="live-badge">
        <span className="live-dot" /> LIVE
      </div>
      <div className="live-stream">
        {recent.length === 0 ? (
          <span className="live-empty">Waiting for trades…</span>
        ) : (
          recent.map((b) => (
            <Link key={b.id} href={`/market/${b.marketId}`} className="live-pill" title={b.marketQuestion}>
              <Avatar emoji={b.avatar} color={b.color} size={18} />
              <span className="live-user">@{b.username}</span>
              <span className={`live-side ${b.side.toLowerCase()}`}>{b.side}</span>
              <span className="live-amt">${b.amount}</span>
            </Link>
          ))
        )}
      </div>
      <button className="live-close" onClick={() => setOpen(false)} aria-label="hide live trades">
        ✕
      </button>
    </div>
  );
}
