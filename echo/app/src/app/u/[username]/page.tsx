"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/app/providers";
import {
  relativeTime,
  echoPercentile,
  subjects,
} from "@/lib/mock";
import { Avatar, StatusBadge } from "@/components/primitives";
import { MarketCard } from "@/components/MarketCard";

type Tab = "Portfolio" | "Live" | "Markets Created" | "Comments";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { me, isFollowing, toggleFollow, markets, users, positions, comments, activity, liveBets } = useApp();
  const [tab, setTab] = useState<Tab>("Portfolio");

  const user = users.find((u) => u.username === username);

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
  const userPositions = positions.filter((p) => p.userId === user.id);
  const userComments = comments.filter((c) => c.userId === user.id);
  const subjectRecord = subjects.find((s) => s.name === user.username || s.slug === username);

  const canSeePositions = isMe || (!user.privacy.hidePositions && !user.privacy.ghostMode);

  // Portfolio analytics: separate active/settled positions and compute P&L.
  const analytics = useMemo(() => {
    let staked = 0;
    let potential = 0;
    let realizedPnl = 0;
    let wins = 0;
    let losses = 0;
    const active: {
      posId: string; marketId: string; question: string; status: string; side: string;
      amount: number; currentPct: number; payout: number; potentialGain: number;
    }[] = [];
    const settled: {
      posId: string; marketId: string; question: string; side: string; amount: number;
      outcome: string | null; win: boolean; payout: number; pnl: number;
    }[] = [];

    for (const p of userPositions) {
      const m = markets.find((x) => x.id === p.marketId);
      if (!m) continue;
      const total = m.yesPool + m.noPool;
      const yesPct = total > 0 ? Math.round((m.yesPool / total) * 100) : 50;
      staked += p.amount;

      if (m.status === "SETTLED" && m.outcome) {
        const won = p.side === m.outcome;
        const winPool = m.outcome === "YES" ? m.yesPool : m.noPool;
        const payout = won && winPool > 0 ? (p.amount / winPool) * total : 0;
        const pnl = won ? payout - p.amount : -p.amount;
        realizedPnl += pnl;
        if (won) wins++; else losses++;
        settled.push({
          posId: p.id, marketId: m.id, question: m.question, side: p.side,
          amount: p.amount, outcome: m.outcome, win: won, payout, pnl,
        });
      } else {
        const sidePool = p.side === "YES" ? m.yesPool : m.noPool;
        const payout = sidePool > 0 ? (p.amount / sidePool) * total : p.amount;
        potential += payout;
        active.push({
          posId: p.id, marketId: m.id, question: m.question, status: m.status,
          side: p.side, amount: p.amount, currentPct: p.side === "YES" ? yesPct : 100 - yesPct,
          payout, potentialGain: payout - p.amount,
        });
      }
    }
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    return { staked, potential, realizedPnl, wins, losses, winRate, active, settled };
  }, [userPositions, markets]);

  // Live activity by this user, newest first (bot-engine bets + persisted activity log).
  const liveByUser = liveBets.filter((b) => b.userId === user.id);
  const userActivity = activity
    .filter((a) => a.userId === user.id)
    .slice(0, 30);

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div className="panel">
        <div className="between">
          <div className="row" style={{ gap: "1rem" }}>
            <Avatar emoji={user.avatar} color={user.color} size={64} src={user.picture} />
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

        <div className="between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
          <div className="stat-row">
            <div className="stat-cell">
              <div className="v">{user.followers.length.toLocaleString()}</div>
              <div className="l">Followers</div>
            </div>
            <div className="stat-cell">
              <div className="v">{user.following.length.toLocaleString()}</div>
              <div className="l">Following</div>
            </div>
            <div className="stat-cell">
              <div className="v">{analytics.winRate}%</div>
              <div className="l">Win rate ({analytics.wins}-{analytics.losses})</div>
            </div>
            <div className="stat-cell">
              <div className="v" style={{ color: analytics.realizedPnl >= 0 ? "var(--yes)" : "var(--no)" }}>
                {analytics.realizedPnl >= 0 ? "+" : ""}{analytics.realizedPnl.toFixed(0)}
              </div>
              <div className="l">Realized P&amp;L</div>
            </div>
            <div className="stat-cell">
              <div className="v num">${Math.round(user.totalVolumeBet).toLocaleString()}</div>
              <div className="l">Volume bet</div>
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
        {(["Portfolio", "Live", "Markets Created", "Comments"] as Tab[]).map((t) => (
          <button key={t} className={`subtab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t === "Live" && liveByUser.length > 0 && <span className="tab-pip"> · {liveByUser.length}</span>}
            {t === "Portfolio" && analytics.active.length > 0 && <span className="tab-pip"> · {analytics.active.length}</span>}
          </button>
        ))}
      </div>

      {tab === "Portfolio" && (
        !canSeePositions ? (
          <div className="empty">🔒 @{user.username} keeps their positions private.</div>
        ) : (
          <div className="stack" style={{ gap: "1rem" }}>
            <div className="panel port-summary">
              <div className="port-metric">
                <div className="port-metric-l">Staked in active markets</div>
                <div className="port-metric-v num">${analytics.staked.toFixed(0)}</div>
              </div>
              <div className="port-metric">
                <div className="port-metric-l">Potential payout</div>
                <div className="port-metric-v num" style={{ color: "var(--yes)" }}>${analytics.potential.toFixed(0)}</div>
              </div>
              <div className="port-metric">
                <div className="port-metric-l">Realized P&amp;L</div>
                <div className="port-metric-v num" style={{ color: analytics.realizedPnl >= 0 ? "var(--yes)" : "var(--no)" }}>
                  {analytics.realizedPnl >= 0 ? "+" : ""}${analytics.realizedPnl.toFixed(0)}
                </div>
              </div>
              <div className="port-metric">
                <div className="port-metric-l">All-time record</div>
                <div className="port-metric-v"><b>{analytics.wins}</b><span className="faint">-{analytics.losses}</span></div>
              </div>
            </div>

            {analytics.active.length === 0 && analytics.settled.length === 0 && (
              <div className="empty">No positions yet.</div>
            )}

            {analytics.active.length > 0 && (
              <>
                <h3 style={{ margin: "0.5rem 0 0.2rem" }}>Active positions</h3>
                {analytics.active.map((p) => (
                  <div key={p.posId} className="port-row">
                    <div className="port-row-main">
                      <div className="row" style={{ gap: "0.5rem" }}>
                        <StatusBadge status={p.status as "OPEN" | "RESOLVING" | "SETTLED" | "DISPUTED"} />
                        <Link href={`/market/${p.marketId}`} className="feed-title" style={{ fontSize: "0.95rem" }}>
                          {p.question}
                        </Link>
                      </div>
                      <div className="faint" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
                        Current odds: <b style={{ color: p.side === "YES" ? "var(--yes)" : "var(--no)" }}>{p.currentPct}%</b> {p.side}
                      </div>
                    </div>
                    <div className="port-row-side">
                      <span className={`pos-tag ${p.side.toLowerCase()}`}>{p.side} · ${p.amount}</span>
                      <div className="port-payout">
                        <span className="dim">payout</span> <b style={{ color: "var(--yes)" }}>${p.payout.toFixed(0)}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {analytics.settled.length > 0 && (
              <>
                <h3 style={{ margin: "1rem 0 0.2rem" }}>Settled</h3>
                {analytics.settled.map((p) => (
                  <div key={p.posId} className="port-row">
                    <div className="port-row-main">
                      <div className="row" style={{ gap: "0.5rem" }}>
                        <StatusBadge status="SETTLED" />
                        <Link href={`/market/${p.marketId}`} className="feed-title" style={{ fontSize: "0.95rem" }}>
                          {p.question}
                        </Link>
                      </div>
                      <div className="faint" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
                        Bet <b style={{ color: p.side === "YES" ? "var(--yes)" : "var(--no)" }}>{p.side}</b> · outcome{" "}
                        <b style={{ color: p.outcome === "YES" ? "var(--yes)" : "var(--no)" }}>{p.outcome}</b>
                      </div>
                    </div>
                    <div className="port-row-side">
                      <span className={`pos-tag ${p.win ? "yes" : "no"}`}>{p.win ? "WON" : "LOST"} · ${p.amount}</span>
                      <div className="port-payout">
                        <b style={{ color: p.pnl >= 0 ? "var(--yes)" : "var(--no)" }}>
                          {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(0)}
                        </b>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )
      )}

      {tab === "Live" && (
        <div className="panel">
          <div className="between" style={{ marginBottom: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Live trades from @{user.username}</h3>
            {liveByUser.length > 0 && (
              <span className="live-badge sm">
                <span className="live-dot" /> {liveByUser.length}
              </span>
            )}
          </div>
          {liveByUser.length === 0 && userActivity.length === 0 && (
            <div className="faint" style={{ padding: "0.5rem 0" }}>
              No recent activity from @{user.username}. When they trade, it&apos;ll stream in here.
            </div>
          )}
          {liveByUser.length > 0 && (
            <div className="trade-list" style={{ marginBottom: "0.75rem" }}>
              {liveByUser.map((b) => (
                <Link key={b.id} href={`/market/${b.marketId}`} className="trade-row" style={{ textDecoration: "none", color: "inherit" }}>
                  <Avatar emoji={b.avatar} color={b.color} size={26} src={user.picture} />
                  <div className="trade-main">
                    <div className="trade-line">
                      <span className="dim">bet </span>
                      <span className={`trade-side ${b.side.toLowerCase()}`}>{b.side}</span>
                      <span className="dim"> on </span>
                      <b>{b.marketQuestion.length > 48 ? b.marketQuestion.slice(0, 48) + "…" : b.marketQuestion}</b>
                    </div>
                    <div className="faint" style={{ fontSize: "0.74rem" }}>{relativeTime(b.createdAt)}</div>
                  </div>
                  <div className={`trade-amt ${b.side.toLowerCase()}`}>${b.amount}</div>
                </Link>
              ))}
            </div>
          )}
          {userActivity.length > 0 && (
            <>
              <div className="faint" style={{ fontSize: "0.78rem", margin: "0.6rem 0 0.4rem" }}>Recent history</div>
              <div className="trade-list">
                {userActivity.map((a) => {
                  const m = a.marketId ? markets.find((x) => x.id === a.marketId) : undefined;
                  if (a.type === "bet" && m) {
                    return (
                      <Link key={a.id} href={`/market/${m.id}`} className="trade-row" style={{ textDecoration: "none", color: "inherit" }}>
                        <Avatar emoji={user.avatar} color={user.color} size={22} src={user.picture} />
                        <div className="trade-main">
                          <div className="trade-line">
                            <span className="dim">bet </span>
                            <span className={`trade-side ${(a.side ?? "YES").toLowerCase()}`}>{a.side}</span>
                            <span className="dim"> on </span>
                            <b>{m.question.length > 48 ? m.question.slice(0, 48) + "…" : m.question}</b>
                          </div>
                          <div className="faint" style={{ fontSize: "0.74rem" }}>{relativeTime(a.createdAt)}</div>
                        </div>
                        <div className={`trade-amt ${(a.side ?? "YES").toLowerCase()}`}>${a.amount}</div>
                      </Link>
                    );
                  }
                  if (a.type === "new_market" && m) {
                    return (
                      <Link key={a.id} href={`/market/${m.id}`} className="trade-row" style={{ textDecoration: "none", color: "inherit" }}>
                        <span style={{ width: 22, textAlign: "center" }}>✨</span>
                        <div className="trade-main">
                          <div className="trade-line">
                            <span className="dim">created </span>
                            <b>{m.question.length > 48 ? m.question.slice(0, 48) + "…" : m.question}</b>
                          </div>
                          <div className="faint" style={{ fontSize: "0.74rem" }}>{relativeTime(a.createdAt)}</div>
                        </div>
                      </Link>
                    );
                  }
                  return null;
                })}
              </div>
            </>
          )}
        </div>
      )}

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

      {tab === "Comments" &&
        (userComments.length ? (
          <div className="stack">
            {userComments.map((c) => {
              const m = markets.find((x) => x.id === c.marketId);
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
    </div>
  );
}
