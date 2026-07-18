"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/app/providers";
import {
  userByName,
  marketsByCreator,
  positionsByUser,
  comments as seedComments,
  marketById,
  relativeTime,
  echoPercentile,
  subjects,
} from "@/lib/mock";
import { Avatar, StatusBadge } from "@/components/primitives";
import { MarketCard } from "@/components/MarketCard";
import { UserName } from "@/components/UserName";

type Tab = "Markets Created" | "Positions" | "Comments" | "Yield Received";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { me, isFollowing, toggleFollow, markets } = useApp();
  const [tab, setTab] = useState<Tab>("Markets Created");

  const user = userByName(username);
  if (!user) {
    return (
      <div className="empty" style={{ marginTop: "2rem" }}>
        <strong>@{username} not found.</strong>
      </div>
    );
  }

  const isMe = user.id === me.id;
  const following = isFollowing(user.id);
  const joinDate = new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const created = markets.filter((m) => m.creatorId === user.id);
  const userPositions = positionsByUser(user.id);
  const userComments = seedComments.filter((c) => c.userId === user.id);
  const subjectRecord = subjects.find((s) => s.name === user.username || s.slug === username);

  const canSeePositions = isMe || (!user.privacy.hidePositions && !user.privacy.ghostMode);

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div className="panel">
        <div className="between">
          <div className="row" style={{ gap: "1rem" }}>
            <Avatar emoji={user.avatar} color={user.color} size={64} />
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>@{user.username}</h1>
              <p className="bio" style={{ maxWidth: "48ch" }}>{user.bio}</p>
              <div className="faint" style={{ fontSize: "0.82rem", marginTop: "0.3rem" }}>
                📍 {user.location} · joined {joinDate}
              </div>
            </div>
          </div>
          {!isMe && (
            <button
              className={`btn follow-btn ${following ? "following" : "btn-primary"}`}
              onClick={() => toggleFollow(user.id)}
            >
              {following ? "Following" : "+ Follow"}
            </button>
          )}
        </div>

        <div className="divider" />

        <div className="between" style={{ alignItems: "flex-end" }}>
          <div className="stat-row">
            <div className="stat-cell">
              <div className="v">{user.followers.length}</div>
              <div className="l">Followers</div>
            </div>
            <div className="stat-cell">
              <div className="v">{user.following.length}</div>
              <div className="l">Following</div>
            </div>
            <div className="stat-cell">
              <div className="v">{Math.round(user.accuracy * 100)}%</div>
              <div className="l">Accuracy</div>
            </div>
            <div className="stat-cell">
              <div className="v num">{user.totalVolumeBet}</div>
              <div className="l">Volume bet</div>
            </div>
            <div className="stat-cell">
              <div className="v num">{user.totalVolumeCreated}</div>
              <div className="l">Volume created</div>
            </div>
            {subjectRecord && subjectRecord.totalYieldEarned > 0 && (
              <div className="stat-cell">
                <div className="v num">{subjectRecord.totalYieldEarned.toFixed(0)}</div>
                <div className="l">Yield earned</div>
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="escore" style={{ fontSize: "1.9rem" }}>
              {user.echoScore}
            </div>
            <div className="faint" style={{ fontSize: "0.8rem" }}>
              Echo Score · {echoPercentile(user.echoScore)}
            </div>
          </div>
        </div>
      </div>

      <div className="subtabs" style={{ marginTop: "1.25rem" }}>
        {(["Markets Created", "Positions", "Comments", "Yield Received"] as Tab[]).map((t) => (
          <button key={t} className={`subtab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Markets Created" &&
        (created.length ? (
          <div className="market-grid">
            {created.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        ) : (
          <div className="empty">No markets created yet.</div>
        ))}

      {tab === "Positions" &&
        (!canSeePositions ? (
          <div className="empty">🔒 @{user.username} keeps their positions private.</div>
        ) : userPositions.length ? (
          <div className="stack">
            {userPositions.map((p) => {
              const m = marketById(p.marketId);
              if (!m) return null;
              return (
                <div key={p.id} className="between" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-card)", padding: "0.9rem 1.1rem" }}>
                  <div>
                    <div className="row" style={{ gap: "0.5rem" }}>
                      <StatusBadge status={m.status} />
                      <Link href={`/market/${m.id}`} className="feed-title">
                        {m.question}
                      </Link>
                    </div>
                    <div className="faint" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
                      {relativeTime(p.createdAt)}
                    </div>
                  </div>
                  <span className={`pos-tag ${p.side.toLowerCase()}`}>
                    {p.side} · {p.amount} USDC
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">No positions yet.</div>
        ))}

      {tab === "Comments" &&
        (userComments.length ? (
          <div className="stack">
            {userComments.map((c) => {
              const m = marketById(c.marketId);
              return (
                <div key={c.id} className="feed-card">
                  <div className="comment-body">{c.content}</div>
                  {m && (
                    <Link href={`/market/${m.id}`} className="faint" style={{ fontSize: "0.82rem" }}>
                      on {m.question}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">No comments yet.</div>
        ))}

      {tab === "Yield Received" &&
        (subjectRecord && subjectRecord.totalYieldEarned > 0 ? (
          <div className="panel">
            <div className="between">
              <span className="dim">Total yield routed to this person as a subject</span>
              <b className="escore" style={{ fontSize: "1.3rem" }}>
                {subjectRecord.totalYieldEarned.toFixed(1)} USDC
              </b>
            </div>
            <div style={{ marginTop: "0.8rem" }}>
              <Link href={`/subject/${subjectRecord.slug}`} className="btn btn-sm btn-ghost">
                View subject page
              </Link>
            </div>
          </div>
        ) : (
          <div className="empty">No yield received — this user isn&apos;t a market subject.</div>
        ))}
    </div>
  );
}
