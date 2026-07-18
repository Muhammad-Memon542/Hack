"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApp } from "@/app/providers";
import { buildFeed, suggestedCreators, echoPercentile } from "@/lib/mock";
import { FeedCard } from "@/components/FeedCard";
import { Avatar } from "@/components/primitives";

export default function ForYouPage() {
  const { connected, connect, me, following, toggleFollow, isFollowing, setCreateOpen } = useApp();

  const feed = useMemo(() => buildFeed(me.id), [me.id, following.length]);
  const suggestions = useMemo(() => suggestedCreators(me.id, 4), [following.length, me.id]);

  if (!connected) {
    return (
      <div style={{ maxWidth: 720, margin: "3rem auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
          Bet on the <span className="accent">people</span> around you.
        </h1>
        <p className="dim" style={{ fontSize: "1.1rem", margin: "1.2rem auto 0", maxWidth: "56ch" }}>
          Echo turns local gossip into liquid markets. Winners route a slice of their yield straight
          back to the person the bet is about — a closed-loop funding mechanism, settled on Solana.
        </p>
        <div className="row" style={{ justifyContent: "center", marginTop: "1.8rem" }}>
          <button className="btn btn-primary" onClick={connect}>Connect wallet</button>
          <Link href="/" className="btn btn-ghost">Browse markets</Link>
        </div>
      </div>
    );
  }

  if (following.length < 3) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>For You</h1>
            <div className="page-sub">Personalized from your friends and your neighborhood.</div>
          </div>
        </div>
        <div className="empty" style={{ textAlign: "left" }}>
          <div style={{ textAlign: "center", marginBottom: "1.4rem" }}>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)" }}>
              Follow 3 creators to personalize your feed
            </div>
            <div className="dim" style={{ marginTop: "0.3rem" }}>
              Following {following.length} of 3 · {3 - following.length} more to go
            </div>
          </div>
          <div className="stack">
            {suggestions.map((u) => (
              <div key={u.id} className="between" style={{ background: "var(--card)", padding: "0.8rem 1rem", borderRadius: "var(--r-btn)", border: "1px solid var(--border)" }}>
                <div className="row">
                  <Avatar emoji={u.avatar} color={u.color} size={38} src={u.picture} />
                  <div>
                    <Link href={`/u/${u.username}`} className="uname">@{u.username}</Link>
                    <div className="faint" style={{ fontSize: "0.8rem" }}>
                      Echo {u.echoScore} · {echoPercentile(u.echoScore)} · {Math.round(u.accuracy * 100)}% accuracy
                    </div>
                  </div>
                </div>
                <button
                  className={`btn btn-sm follow-btn ${isFollowing(u.id) ? "following" : "btn-primary"}`}
                  onClick={() => toggleFollow(u.id)}
                >
                  {isFollowing(u.id) ? "Following" : "+ Follow"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>For You</h1>
          <div className="page-sub">Ranked by friend activity, your location, and what you bet on.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ Create</button>
      </div>

      <div className="feed">
        {feed.map((item) => (
          <FeedCard key={item.id} item={item} />
        ))}
        {feed.length === 0 && <div className="empty">Nothing new right now. Follow more people or check back soon.</div>}
      </div>
    </div>
  );
}
