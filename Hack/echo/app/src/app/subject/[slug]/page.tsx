"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/app/providers";
import { subjectBySlug, truncateWallet } from "@/lib/mock";
import { Avatar } from "@/components/primitives";
import { MarketCard } from "@/components/MarketCard";

export default function SubjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { markets, isFollowingSubject, toggleFollowSubject, connected } = useApp();
  const [claimed, setClaimed] = useState(false);
  const [optedOut, setOptedOut] = useState(false);

  const subject = subjectBySlug(slug);
  if (!subject) {
    return (
      <div className="empty" style={{ marginTop: "2rem" }}>
        <strong>Subject not found.</strong>
      </div>
    );
  }

  const subjectMarkets = markets.filter((m) => m.subjectWallet === subject.wallet);
  const settled = subjectMarkets.filter((m) => m.status === "SETTLED");
  const following = isFollowingSubject(subject.wallet);
  const isVerified = subject.verified || claimed;

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div className="panel">
        <div className="between">
          <div className="row" style={{ gap: "1rem" }}>
            <Avatar emoji={subject.avatar} color={subject.color} size={64} />
            <div>
              <div className="row" style={{ gap: "0.6rem" }}>
                <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                  {subject.name ?? "Unverified subject"}
                </h1>
                {isVerified && <span className="claimed">Claimed profile</span>}
              </div>
              {isVerified ? (
                <p className="bio" style={{ maxWidth: "48ch" }}>{subject.bio}</p>
              ) : (
                <p className="faint" style={{ fontSize: "0.85rem" }}>
                  {truncateWallet(subject.wallet)} · no one has claimed this profile yet
                </p>
              )}
              {isVerified && subject.socials && (
                <div className="row" style={{ marginTop: "0.4rem", gap: "0.6rem" }}>
                  {subject.socials.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="accent" style={{ fontSize: "0.82rem" }}>
                      {s.label} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            className={`btn follow-btn ${following ? "following" : ""}`}
            onClick={() => toggleFollowSubject(subject.wallet)}
          >
            🔔 {following ? "Following" : "Follow subject"}
          </button>
        </div>

        <div className="divider" />

        <div className="stat-row">
          <div className="stat-cell">
            <div className="v">{subjectMarkets.length}</div>
            <div className="l">Total markets</div>
          </div>
          <div className="stat-cell">
            <div className="v num">{subject.totalYieldEarned.toFixed(1)}</div>
            <div className="l">Yield earned (USDC)</div>
          </div>
          <div className="stat-cell">
            <div className="v">{settled.length > 0 ? `${Math.round(subject.aboutAccuracy * 100)}%` : "—"}</div>
            <div className="l">Prediction accuracy</div>
          </div>
        </div>

        <div className="divider" />

        {isVerified ? (
          optedOut ? (
            <div className="info-box warn">
              You&apos;ve opted out. No new markets can be created about this wallet. Existing markets
              remain live until they resolve.
            </div>
          ) : (
            <div className="between">
              <span className="faint" style={{ fontSize: "0.85rem" }}>
                This is a claimed profile.
              </span>
              <button className="btn btn-sm btn-no-outline" onClick={() => setOptedOut(true)}>
                Remove me from future markets
              </button>
            </div>
          )
        ) : (
          <div className="between">
            <span className="dim" style={{ fontSize: "0.9rem" }}>
              Is this you? Claim the profile to add a bio, receive yield, and control future markets.
            </span>
            <button
              className="btn btn-sm btn-primary"
              disabled={!connected}
              onClick={() => setClaimed(true)}
              title={connected ? "" : "Connect your wallet first"}
            >
              Claim this profile
            </button>
          </div>
        )}
      </div>

      <div className="page-head">
        <h2 style={{ fontSize: "1.1rem" }}>Markets about {subject.name ?? "this wallet"}</h2>
      </div>
      {subjectMarkets.length ? (
        <div className="market-grid">
          {subjectMarkets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      ) : (
        <div className="empty">No markets about this subject yet.</div>
      )}
    </div>
  );
}
