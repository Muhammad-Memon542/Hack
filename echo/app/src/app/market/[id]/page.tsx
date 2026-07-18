"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useApp } from "@/app/providers";
import {
  formatDateTime,
  volume,
  yesPct,
  subjectByWallet,
  userById,
  type Market,
} from "@/lib/mock";
import { StatusBadge } from "@/components/primitives";
import { UserName } from "@/components/UserName";
import { BetPanel } from "@/components/BetPanel";
import { Discussion } from "@/components/Discussion";
import { OddsChart } from "@/components/OddsChart";

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { markets, isFollowingMarket, toggleFollowMarket } = useApp();
  const market = markets.find((m) => m.id === params.id);

  if (!market) {
    return (
      <div style={{ marginTop: "2rem" }}>
        <Link href="/markets" className="crumb">
          ← All markets
        </Link>
        <div className="empty" style={{ marginTop: "1rem" }}>
          <strong>Market not found.</strong>
          <div className="dim" style={{ marginTop: "0.4rem" }}>
            It may have been removed, or the link is out of date.
          </div>
        </div>
      </div>
    );
  }

  const creator = userById(market.creatorId);
  const subject = subjectByWallet(market.subjectWallet);
  const following = isFollowingMarket(market.id);
  const highlightFriend = search.get("highlight") === "friend";

  // Markets created this session aren't "indexed" yet — show the friendly box.
  const isIndexing = market.id.startsWith("m_new_");

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <Link href="/markets" className="crumb">
        ← All markets
      </Link>

      <h1 className="detail-title">{market.question}</h1>

      <div className="detail-meta">
        <StatusBadge status={market.status} />
        <span>by {creator ? <UserName username={creator.username} /> : "unknown"}</span>
        <span>·</span>
        <span>resolves {formatDateTime(market.closesAt)}</span>
        {market.subjectWallet && (
          <>
            <span>·</span>
            {subject && subject.verified ? (
              <span className="pyr">
                ⚡ yield routes to{" "}
                <Link href={`/subject/${subject.slug}`} className="uname">
                  {subject.name}
                </Link>
              </span>
            ) : (
              <span className="pyr unverified">⚡ yield routes to unverified wallet</span>
            )}
          </>
        )}
        <button
          className={`btn btn-sm follow-btn ${following ? "following" : ""}`}
          onClick={() => toggleFollowMarket(market.id)}
        >
          🔔 {following ? "Following" : "Follow"}
        </button>
      </div>

      {highlightFriend && (
        <div className="info-box" style={{ marginTop: "1rem", borderColor: "color-mix(in srgb, var(--yes) 35%, transparent)" }}>
          👋 A friend you follow just bet on this market.
        </div>
      )}

      <div className="two-col" style={{ marginTop: "1.25rem" }}>
        <div>
          <div className="panel">
            <h3>Odds</h3>
            <div className="pools">
              <div className="pool yes">
                <div className="pct">{yesPct(market)}%</div>
                <div className="lbl">YES · {market.yesPool.toFixed(2)} USDC</div>
              </div>
              <div className="pool no">
                <div className="pct">{100 - yesPct(market)}%</div>
                <div className="lbl">NO · {market.noPool.toFixed(2)} USDC</div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: "0.9rem" }}>
              <span className="dim">Total volume</span>
              <b className="num">{volume(market).toFixed(2)} USDC</b>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="dim">Participants</span>
              <b className="num">{market.participants}</b>
            </div>
          </div>

          <OddsChart market={market} />

          <div className="panel">
            <h3>Resolution criteria</h3>
            <p className="bio">{market.description}</p>
          </div>

          <OnChainStatus market={market} indexing={isIndexing} />

          <Discussion market={market} />
        </div>

        <div>
          <BetPanel market={market} />
        </div>
      </div>
    </div>
  );
}

function OnChainStatus({ market, indexing }: { market: Market; indexing: boolean }) {
  if (indexing) {
    return (
      <div className="panel">
        <h3>On-chain status</h3>
        <div className="info-box warn">
          This market is still being indexed. Check back in a few minutes, or{" "}
          <a
            href="https://explorer.solana.com/?cluster=devnet"
            target="_blank"
            rel="noreferrer"
            className="accent"
          >
            view on Solana Explorer
          </a>
          .
        </div>
      </div>
    );
  }
  return (
    <div className="panel">
      <h3>On-chain status</h3>
      <div className="info-box">
        ✓ Settled on Solana. Pools and payouts are enforced by the Echo program.{" "}
        <a
          href="https://explorer.solana.com/?cluster=devnet"
          target="_blank"
          rel="noreferrer"
          className="accent"
        >
          View on Solana Explorer
        </a>
        .
      </div>
    </div>
  );
}
