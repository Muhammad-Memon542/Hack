"use client";

import { useState } from "react";
import { useApp } from "@/app/providers";
import { estimatedReturn, yesPct, type Market, type Side } from "@/lib/mock";
import { burstConfetti } from "@/lib/confetti";

export function BetPanel({ market }: { market: Market }) {
  const { connected, connect, placeBet, me, balanceUsdc, setDepositOpen, positions } = useApp();
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState("10");
  const [placed, setPlaced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const yes = yesPct(market);
  const amt = Number(amount) || 0;
  const est = estimatedReturn(market, side, amt);
  const myPositions = positions.filter((p) => p.marketId === market.id && p.userId === me.id);
  const insufficient = amt > balanceUsdc;

  const resolved = market.status === "SETTLED" || market.status === "DISPUTED";
  const closed = market.status !== "OPEN";

  if (!connected) {
    return (
      <div className="panel">
        <h3>Place a bet</h3>
        <div className="info-box" style={{ marginBottom: "0.9rem" }}>
          Connect your wallet to take a side on this market.
        </div>
        <button className="btn btn-primary btn-block" onClick={connect}>
          👛 Connect wallet
        </button>
      </div>
    );
  }

  if (resolved) {
    return (
      <div className="panel">
        <h3>Market {market.status === "DISPUTED" ? "disputed" : "settled"}</h3>
        {market.outcome && (
          <div className="info-box">
            Outcome: <b style={{ color: market.outcome === "YES" ? "var(--yes)" : "var(--no)" }}>{market.outcome}</b>
            {myPositions.some((p) => p.side === market.outcome) && (
              <div style={{ marginTop: "0.6rem" }}>
                <button className="btn btn-primary btn-block">Claim winnings</button>
              </div>
            )}
          </div>
        )}
        {market.status === "DISPUTED" && (
          <div className="info-box warn" style={{ marginTop: "0.6rem" }}>
            This resolution is under dispute. A designated oracle is reviewing the criteria before
            settlement.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>{closed ? "Trading closed" : "Place a bet"}</h3>

      <div className="side-toggle" style={{ marginBottom: "0.9rem" }}>
        <button
          className={`btn ${side === "YES" ? "selected-yes" : "btn-yes-outline"}`}
          onClick={() => setSide("YES")}
          disabled={closed}
        >
          YES
          <span className="odd">{yes}%</span>
        </button>
        <button
          className={`btn ${side === "NO" ? "selected-no" : "btn-no-outline"}`}
          onClick={() => setSide("NO")}
          disabled={closed}
        >
          NO
          <span className="odd">{100 - yes}%</span>
        </button>
      </div>

      <div className="field" style={{ marginBottom: "0.4rem" }}>
        <label>
          Amount (USDC)
          <span className="dim" style={{ float: "right", fontWeight: 600 }}>
            Balance: ${balanceUsdc.toFixed(2)}
          </span>
        </label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={closed}
        />
      </div>

      <div className="est">
        <span className="dim">Estimated return if {side}</span>
        <b className="num">{est.toFixed(2)} USDC</b>
      </div>

      {!closed && insufficient && amt > 0 && (
        <div className="info-box warn" style={{ margin: "0.6rem 0" }}>
          Not enough balance ({`$${balanceUsdc.toFixed(2)}`}).{" "}
          <button
            className="link-btn"
            onClick={() => setDepositOpen(true)}
            style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontWeight: 700 }}
          >
            Add funds
          </button>
        </div>
      )}

      <button
        className={`btn btn-block ${side === "YES" ? "btn-yes" : "btn-no"}`}
        disabled={closed || amt <= 0 || insufficient || submitting}
        onClick={async () => {
          setError(null);
          setSubmitting(true);
          const res = await placeBet(market.id, side, amt);
          setSubmitting(false);
          if (!res.ok) {
            setError(res.error === "insufficient balance" ? "Not enough balance." : res.error ?? "Bet failed");
            return;
          }
          burstConfetti({
            colors: side === "YES" ? ["#16a34a", "#4ade80", "#fbbf24"] : ["#ef4444", "#f0728a", "#fbbf24"],
          });
          setPlaced(`Bet ${amt} USDC on ${side}`);
          setTimeout(() => setPlaced(null), 2200);
        }}
      >
        {submitting ? "Placing…" : `Bet ${amt || 0} USDC on ${side}`}
      </button>

      {error && <div className="hint err" style={{ marginTop: "0.5rem" }}>{error}</div>}

      {myPositions.length > 0 && (
        <div className="info-box" style={{ marginTop: "0.9rem" }}>
          Your position:{" "}
          {myPositions.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <b style={{ color: p.side === "YES" ? "var(--yes)" : "var(--no)" }}>{p.side}</b> {p.amount} USDC
            </span>
          ))}
        </div>
      )}

      {placed && <div className="toast">✅ {placed}</div>}
    </div>
  );
}
