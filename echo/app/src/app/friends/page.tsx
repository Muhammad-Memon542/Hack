"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "../providers";
import {
  users,
  positions as seedPositions,
  comments as seedComments,
  marketById,
  userById,
  relativeTime,
  suggestedCreators,
  type User,
} from "@/lib/mock";
import { Avatar } from "@/components/primitives";
import { UserName } from "@/components/UserName";

type Tab = "Activity" | "Leaderboard" | "Bet Together";

export default function FriendsPage() {
  const { connected, connect, me, following, isFollowing, toggleFollow } = useApp();
  const [tab, setTab] = useState<Tab>("Activity");

  const friends = useMemo(() => following.map((id) => userById(id)).filter(Boolean) as User[], [following]);

  if (!connected) {
    return (
      <div>
        <div className="page-head">
          <h1>Friends</h1>
        </div>
        <div className="empty">
          <strong>Connect to see your friends.</strong>
          <div style={{ marginTop: "0.9rem" }}>
            <button className="btn btn-primary" onClick={connect}>
              👛 Connect wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Friends</h1>
          <div className="page-sub">The people you follow, and who you should.</div>
        </div>
      </div>

      <div className="subtabs">
        {(["Activity", "Leaderboard", "Bet Together"] as Tab[]).map((t) => (
          <button key={t} className={`subtab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Activity" && <ActivityTab friends={friends} />}
      {tab === "Leaderboard" && <FriendsLeaderboard friends={friends} me={me} />}
      {tab === "Bet Together" && <BetTogether />}

      <Recommendations
        me={me}
        friends={friends}
        isFollowing={isFollowing}
        toggleFollow={toggleFollow}
      />
    </div>
  );
}

function ActivityTab({ friends }: { friends: User[] }) {
  const friendIds = new Set(friends.map((f) => f.id));
  const events = [
    ...seedPositions
      .filter((p) => friendIds.has(p.userId))
      .map((p) => ({ kind: "bet" as const, at: p.createdAt, userId: p.userId, marketId: p.marketId, side: p.side, amount: p.amount })),
    ...seedComments
      .filter((c) => friendIds.has(c.userId) && !c.parentId)
      .map((c) => ({ kind: "comment" as const, at: c.createdAt, userId: c.userId, marketId: c.marketId, content: c.content })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (events.length === 0)
    return <div className="empty">No recent activity from people you follow.</div>;

  return (
    <div className="feed">
      {events.map((e, i) => {
        const u = userById(e.userId)!;
        const m = marketById(e.marketId);
        return (
          <div key={i} className="feed-card">
            <div className="feed-line">
              <Avatar emoji={u.avatar} color={u.color} size={24} />
              <UserName username={u.username} />
              {e.kind === "bet" ? (
                <>
                  bet{" "}
                  <b style={{ color: e.side === "YES" ? "var(--yes)" : "var(--no)" }}>{e.side}</b> ·{" "}
                  {e.amount} USDC
                </>
              ) : (
                <>commented</>
              )}
              <span className="spacer" />
              <span className="faint" style={{ fontSize: "0.78rem" }}>
                {relativeTime(e.at)}
              </span>
            </div>
            {m && (
              <Link href={`/market/${m.id}`} className="feed-title">
                {m.question}
              </Link>
            )}
            {e.kind === "comment" && (
              <div className="dim" style={{ fontSize: "0.88rem" }}>
                &ldquo;{e.content}&rdquo;
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FriendsLeaderboard({ friends, me }: { friends: User[]; me: User }) {
  const [metric, setMetric] = useState<"accuracy" | "pnl" | "volume">("accuracy");
  const [range, setRange] = useState<"All time" | "This month">("All time");
  const rows = [me, ...friends];

  const val = (u: User) =>
    metric === "accuracy" ? u.accuracy : metric === "volume" ? u.totalVolumeBet : u.totalVolumeBet * (u.accuracy - 0.5);
  const sorted = [...rows].sort((a, b) => val(b) - val(a));

  return (
    <div>
      <div className="between" style={{ marginBottom: "1rem" }}>
        <div className="pills">
          {(["accuracy", "pnl", "volume"] as const).map((m) => (
            <button key={m} className={`pill ${metric === m ? "active" : ""}`} onClick={() => setMetric(m)}>
              {m === "pnl" ? "PnL" : m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="pills">
          {(["All time", "This month"] as const).map((r) => (
            <button key={r} className={`pill ${range === r ? "active" : ""}`} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="board">
          <thead>
            <tr>
              <th>#</th>
              <th>Forecaster</th>
              <th className="right">Echo</th>
              <th className="right">
                {metric === "accuracy" ? "Accuracy" : metric === "volume" ? "Volume" : "PnL"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => (
              <tr key={u.id}>
                <td className={`rank ${i < 3 ? `t${i + 1}` : ""}`}>{i + 1}</td>
                <td>
                  <div className="row">
                    <Avatar emoji={u.avatar} color={u.color} size={26} />
                    <UserName username={u.username} />
                    {u.id === me.id && <span className="chip">you</span>}
                  </div>
                </td>
                <td className="right escore">{u.echoScore}</td>
                <td className="right num">
                  {metric === "accuracy"
                    ? `${Math.round(u.accuracy * 100)}%`
                    : metric === "volume"
                    ? `${u.totalVolumeBet} USDC`
                    : u.privacy.hidePnl
                    ? "hidden"
                    : `${Math.round(u.totalVolumeBet * (u.accuracy - 0.5))} USDC`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BetTogether() {
  const invites = [
    { id: "g1", title: "Will Amir land the backflip?", from: "park_ranger", status: "pending", members: 4 },
    { id: "g2", title: "Eastside final — group pool", from: "coach_dee", status: "accepted", members: 7 },
  ];
  return (
    <div className="stack">
      {invites.map((g) => (
        <div key={g.id} className="between" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-card)", padding: "1rem 1.15rem" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{g.title}</div>
            <div className="faint" style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
              Invited by <UserName username={g.from} /> · {g.members} members
            </div>
          </div>
          {g.status === "pending" ? (
            <div className="row">
              <button className="btn btn-sm btn-ghost">Decline</button>
              <button className="btn btn-sm btn-primary">Accept</button>
            </div>
          ) : (
            <span className="chip" style={{ color: "var(--yes)" }}>✓ Accepted</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Recommendations({
  me,
  friends,
  isFollowing,
  toggleFollow,
}: {
  me: User;
  friends: User[];
  isFollowing: (id: string) => boolean;
  toggleFollow: (id: string) => void;
}) {
  const recs = suggestedCreators(me.id, 3);
  const reasons = [
    "You both bet on 3 markets",
    `${Math.min(3, friends.length)} friends follow them`,
    "Active in Riverside",
  ];
  if (recs.length === 0) return null;
  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1rem", marginBottom: "0.8rem" }}>People you may know</h2>
      <div className="stack">
        {recs.map((u, i) => (
          <div key={u.id} className="between" style={{ background: "var(--card-2)", padding: "0.75rem 1rem", borderRadius: "var(--r-btn)" }}>
            <div className="row">
              <Avatar emoji={u.avatar} color={u.color} size={34} />
              <div>
                <UserName username={u.username} />
                <div className="faint" style={{ fontSize: "0.78rem" }}>
                  {reasons[i % reasons.length]}
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
  );
}
