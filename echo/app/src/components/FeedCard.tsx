"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  marketById,
  userById,
  subjectByWallet,
  relativeTime,
  type FeedItem,
} from "@/lib/mock";
import { useApp } from "@/app/providers";
import { Avatar } from "./primitives";
import { UserName } from "./UserName";

const KIND_LABEL: Record<string, string> = {
  new_market: "New market",
  friend_bet: "Friend bet",
  price_alert: "Price alert",
  resolution: "Resolution",
  comment: "Comment",
  yield_milestone: "Yield milestone",
};

export function FeedCard({ item }: { item: FeedItem }) {
  const router = useRouter();
  const { setCreateOpen, placeBet } = useApp();
  const market = item.marketId ? marketById(item.marketId) : undefined;
  const actor = item.actorId ? userById(item.actorId) : undefined;

  const go = (suffix = "") => market && router.push(`/market/${market.id}${suffix}`);

  return (
    <div className={`feed-card t-${item.type}`}>
      <div className="feed-line">
        {actor && <Avatar emoji={actor.avatar} color={actor.color} size={26} src={actor.picture} />}
        <span className="feed-kind">{KIND_LABEL[item.type]}</span>
        <span className="spacer" />
        <span className="faint" style={{ fontSize: "0.78rem" }}>
          {relativeTime(item.createdAt)}
        </span>
      </div>

      {item.type === "new_market" && market && actor && (
        <>
          <div className="feed-line">
            <UserName username={actor.username} /> created:
          </div>
          <Link href={`/market/${market.id}`} className="feed-title">
            {market.question}
          </Link>
          <div className="feed-actions">
            <button className="btn btn-sm btn-primary" onClick={() => go()}>
              Bet
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => go()}>
              View
            </button>
            <ShareBtn marketId={market.id} />
          </div>
        </>
      )}

      {item.type === "friend_bet" && market && actor && (
        <>
          <div className="feed-line">
            <UserName username={actor.username} /> bet{" "}
            <b style={{ color: item.data.side === "YES" ? "var(--yes)" : "var(--no)" }}>
              {String(item.data.side)}
            </b>{" "}
            on
          </div>
          <Link href={`/market/${market.id}`} className="feed-title">
            {market.question}
          </Link>
          <div className="feed-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => go("?highlight=friend")}>
              See reasoning
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={async () => {
                const res = await placeBet(market.id, item.data.side as "YES" | "NO", 10);
                if (res.ok) go();
                else alert(res.error === "insufficient balance" ? "Add funds to copy this bet." : res.error);
              }}
            >
              Copy bet
            </button>
          </div>
        </>
      )}

      {item.type === "price_alert" && market && (
        <>
          <div className="feed-line">
            Market shifted: YES {String(item.data.from)}% → <b className="accent">{String(item.data.to)}%</b>
          </div>
          <Link href={`/market/${market.id}`} className="feed-title">
            {market.question}
          </Link>
          <div className="feed-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => go()}>
              View
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => go()}>
              Bet
            </button>
          </div>
        </>
      )}

      {item.type === "resolution" && market && (
        <>
          <div className="feed-line">
            Resolved: <b style={{ color: item.data.outcome === "YES" ? "var(--yes)" : "var(--no)" }}>
              {String(item.data.outcome)}
            </b>{" "}
            — confirmed
          </div>
          <Link href={`/market/${market.id}`} className="feed-title">
            {market.question}
          </Link>
          <div className="feed-actions">
            {item.data.canClaim ? (
              <button className="btn btn-sm btn-primary" onClick={() => go("?claim=true")}>
                Claim winnings
              </button>
            ) : null}
            <button className="btn btn-sm btn-ghost" onClick={() => go()}>
              View
            </button>
          </div>
        </>
      )}

      {item.type === "comment" && market && actor && (
        <>
          <div className="feed-line">
            <UserName username={actor.username} /> commented on
          </div>
          <Link href={`/market/${market.id}`} className="feed-title">
            {market.question}
          </Link>
          <div className="dim" style={{ fontSize: "0.88rem" }}>
            &ldquo;{String(item.data.content)}&rdquo;
          </div>
          <div className="feed-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => go()}>
              View thread
            </button>
          </div>
        </>
      )}

      {item.type === "yield_milestone" && item.subjectWallet && (
        <>
          <div className="feed-line">
            <b>{String(item.data.name)}</b> earned {Number(item.data.amount).toFixed(0)} USDC from bets
            about them
          </div>
          <div className="feed-actions">
            <Link
              href={`/subject/${subjectByWallet(item.subjectWallet)?.slug ?? ""}`}
              className="btn btn-sm btn-ghost"
            >
              View subject
            </Link>
            <button className="btn btn-sm btn-primary" onClick={() => setCreateOpen(true)}>
              Create market
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ShareBtn({ marketId }: { marketId: string }) {
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/market/${marketId}?ref=u_you`);
    } catch {
      /* ignore */
    }
  };
  return (
    <button className="btn btn-sm btn-ghost" onClick={share}>
      Share
    </button>
  );
}
