"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "../providers";
import { users, subjects, marketsByCreator, type User } from "@/lib/mock";
import { Avatar } from "@/components/primitives";
import { UserName } from "@/components/UserName";

type Category = "Top Forecasters" | "High Rollers" | "Market Makers" | "Yield Earners";
const CATEGORIES: Category[] = ["Top Forecasters", "High Rollers", "Market Makers", "Yield Earners"];

export default function LeaderboardPage() {
  const { me, following } = useApp();
  const [cat, setCat] = useState<Category>("Top Forecasters");
  const [scope, setScope] = useState<"Global" | "Friends">("Global");

  const pool = useMemo(() => {
    if (scope === "Friends") return users.filter((u) => following.includes(u.id) || u.id === me.id);
    return users;
  }, [scope, following, me.id]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <div className="page-sub">Who&apos;s calling it right around here.</div>
        </div>
        <div className="pills">
          {(["Global", "Friends"] as const).map((s) => (
            <button key={s} className={`pill ${scope === s ? "active" : ""}`} onClick={() => setScope(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="pills" style={{ marginBottom: "1.1rem" }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`pill ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {cat === "Yield Earners" ? <YieldTable /> : <UserTable pool={pool} cat={cat} meId={me.id} />}
      </div>
    </div>
  );
}

function UserTable({ pool, cat, meId }: { pool: User[]; cat: Category; meId: string }) {
  const metricVal = (u: User) => {
    if (cat === "High Rollers") return u.totalVolumeBet;
    if (cat === "Market Makers") return marketsByCreator(u.id).length;
    return u.accuracy; // Top Forecasters
  };
  const metricLabel = cat === "High Rollers" ? "Volume" : cat === "Market Makers" ? "Markets" : "Accuracy";
  const fmt = (u: User) =>
    cat === "High Rollers"
      ? `${u.totalVolumeBet} USDC`
      : cat === "Market Makers"
      ? `${marketsByCreator(u.id).length}`
      : `${Math.round(u.accuracy * 100)}%`;
  const trends = ["up", "up", "flat", "down"];
  const sorted = [...pool].sort((a, b) => metricVal(b) - metricVal(a));

  return (
    <table className="board">
      <thead>
        <tr>
          <th>#</th>
          <th>Forecaster</th>
          <th className="right">Echo Score</th>
          <th className="right">{metricLabel}</th>
          <th className="right">Trend</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((u, i) => {
          const trend = trends[i % trends.length];
          return (
            <tr key={u.id}>
              <td className={`rank ${i < 3 ? `t${i + 1}` : ""}`}>{i + 1}</td>
              <td>
                <div className="row">
                  <Avatar emoji={u.avatar} color={u.color} size={28} src={u.picture} />
                  <UserName username={u.username} />
                  {u.id === meId && <span className="chip">you</span>}
                </div>
              </td>
              <td className="right escore">{u.echoScore}</td>
              <td className="right num">{fmt(u)}</td>
              <td className={`right trend-${trend}`}>
                {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function YieldTable() {
  const sorted = [...subjects].sort((a, b) => b.totalYieldEarned - a.totalYieldEarned);
  return (
    <table className="board">
      <thead>
        <tr>
          <th>#</th>
          <th>Subject</th>
          <th className="right">Markets</th>
          <th className="right">Yield earned</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s, i) => (
          <tr key={s.wallet}>
            <td className={`rank ${i < 3 ? `t${i + 1}` : ""}`}>{i + 1}</td>
            <td>
              <div className="row">
                <Avatar emoji={s.avatar} color={s.color} size={28} />
                <Link href={`/subject/${s.slug}`} className="uname">
                  {s.name ?? "Unverified subject"}
                </Link>
                {s.verified && <span className="claimed">Claimed</span>}
              </div>
            </td>
            <td className="right num">{s.marketCount}</td>
            <td className="right escore">{s.totalYieldEarned.toFixed(1)} USDC</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
