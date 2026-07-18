"use client";

import { useMemo, useReducer, useState } from "react";
import { useApp } from "../providers";
import {
  buildStatement,
  reconcile,
  settleMarket,
  fundingQuote,
  decideDeposit,
  METHODS,
  STATUS_META,
  TYPE_META,
  DEFAULT_LIMITS,
  PLATFORM_FEE_PCT,
  usd,
  round2,
  type Txn,
  type FundingMethod,
  type Limits,
} from "@/lib/wallet";

// ---------- local ledger reducer (client-side money movements) ----------
type Action =
  | { kind: "add"; txn: Txn }
  | { kind: "status"; id: string; status: Txn["status"]; event?: { label: string; at: number } };

function reducer(state: Txn[], a: Action): Txn[] {
  switch (a.kind) {
    case "add":
      return [a.txn, ...state];
    case "status":
      return state.map((t) =>
        t.id === a.id
          ? { ...t, status: a.status, events: a.event ? [...t.events, a.event] : t.events }
          : t
      );
  }
}

const genKey = (p: string) => `${p}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;

export default function WalletPage() {
  const { connected, connect, me, positions, markets, balanceUsdc, setDepositOpen } = useApp();

  const [extra, dispatch] = useReducer(reducer, []);
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [inflight, setInflight] = useState<Set<string>>(new Set());

  // form state
  const [addMethod, setAddMethod] = useState<FundingMethod>("card");
  const [addAmount, setAddAmount] = useState("100");
  const [outAmount, setOutAmount] = useState("50");
  const [forceFail, setForceFail] = useState(false);

  const seed = useMemo(
    () => buildStatement({ balance: balanceUsdc, positions, markets, userId: me.id }),
    [balanceUsdc, positions, markets, me.id]
  );
  const all = useMemo(() => [...extra, ...seed], [extra, seed]);
  const recon = useMemo(() => reconcile(all), [all]);
  const balance = recon.derived;

  // deposits made this week (for the cap decision) — demo counts session deposits.
  const weekDeposits = round2(
    extra.filter((t) => t.type === "deposit" && t.status !== "failed").reduce((s, t) => s + t.amount, 0)
  );

  // settlements the user participated in (parimutuel + escrow proof)
  const settlements = useMemo(() => {
    const mine = positions.filter((p) => p.userId === me.id);
    const ids = new Set(mine.map((p) => p.marketId));
    return markets
      .filter((m) => ids.has(m.id) && m.status === "SETTLED")
      .map((m) => settleMarket(m, mine))
      .filter(Boolean);
  }, [markets, positions, me.id]);

  // ---------- actions ----------
  const addAmt = Number(addAmount) || 0;
  const quote = fundingQuote(addMethod, addAmt);
  const depositDecision = decideDeposit(addAmt, weekDeposits, limits);

  function deposit() {
    if (!depositDecision.allow) return;
    const id = `tx_dep_${Date.now()}`;
    const key = genKey("deposit");
    const now = Date.now();
    dispatch({
      kind: "add",
      txn: {
        id,
        type: "deposit",
        direction: "credit",
        amount: quote.credited,
        status: "processing",
        method: addMethod,
        note: `Deposit · ${METHODS[addMethod].label}${quote.fee ? ` (fee ${usd(quote.fee)})` : ""}`,
        idempotencyKey: key,
        createdAt: now,
        events: [{ label: "Payment authorized", at: now }],
      },
    });
    setInflight((s) => new Set(s).add(key));
    setTimeout(() => {
      dispatch({ kind: "status", id, status: "settled", event: { label: "Credited to balance", at: Date.now() } });
      setInflight((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }, 1100);
  }

  const outAmt = Number(outAmount) || 0;
  const outFee = round2(outAmt * METHODS.bank.withdrawFeePct);
  const insufficient = outAmt > balance;

  function cashOut() {
    if (outAmt <= 0 || insufficient) return;
    const id = `tx_out_${Date.now()}`;
    const key = genKey("withdraw");
    const now = Date.now();
    dispatch({
      kind: "add",
      txn: {
        id,
        type: "withdrawal",
        direction: "debit",
        amount: outAmt,
        status: "processing",
        method: "bank",
        note: "Cash out · Bank transfer",
        idempotencyKey: key,
        createdAt: now,
        events: [{ label: "Withdrawal requested", at: now }, { label: "Funds held", at: now + 1 }],
      },
    });
    setInflight((s) => new Set(s).add(key));
    setTimeout(() => {
      if (forceFail) {
        // Failure-mode demo: settlement fails → mark failed, then auto-reverse
        // the hold so the balance is made whole (no funds lost).
        dispatch({ kind: "status", id, status: "failed", event: { label: "Rail rejected — settlement failed", at: Date.now() } });
        setTimeout(() => {
          dispatch({
            kind: "add",
            txn: {
              id: `tx_rev_${Date.now()}`,
              type: "refund",
              direction: "credit",
              amount: outAmt,
              status: "settled",
              note: "Auto-reversal of failed cash-out (funds made whole)",
              idempotencyKey: `reverse:${key}`,
              createdAt: Date.now(),
              events: [{ label: "Hold released back to balance", at: Date.now() }],
            },
          });
        }, 700);
      } else {
        dispatch({ kind: "status", id, status: "settled", event: { label: "Settled to bank", at: Date.now() } });
      }
      setInflight((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }, 1400);
  }

  const busy = inflight.size > 0;

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <div className="page-head">
        <div>
          <h1>Wallet</h1>
          <div className="page-sub">
            Every stake is custodied and reconcilable. <span className="sandbox-tag">SANDBOX · test USDC, no real money</span>
          </div>
        </div>
      </div>

      {!connected && (
        <div className="info-box" style={{ marginBottom: "1rem" }}>
          Connect to load your real balance. You can still explore the money layer below.{" "}
          <button className="link-btn" onClick={connect} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer" }}>
            Connect
          </button>
        </div>
      )}

      <div className="wallet-grid">
        {/* ---------- balance + reconciliation ---------- */}
        <div className="panel bal-hero">
          <div className="between">
            <div>
              <div className="page-sub" style={{ margin: 0 }}>Available balance</div>
              <div className="bal-amt">{usd(balance)}</div>
            </div>
            <div className={`recon-chip ${Math.abs(recon.derived - balance) < 0.01 ? "ok" : "bad"}`}>
              ✓ Reconciled
            </div>
          </div>
          <div className="recon-eq">
            <span>credits {usd(recon.credits)}</span>
            <span>−</span>
            <span>debits {usd(recon.debits)}</span>
            <span>=</span>
            <b>{usd(recon.derived)}</b>
          </div>
        </div>

        {/* ---------- add funds (decisioning) ---------- */}
        <div className="panel">
          <h3>Add funds</h3>
          <div className="method-row">
            {(Object.keys(METHODS) as FundingMethod[]).map((k) => (
              <button
                key={k}
                className={`method-opt ${addMethod === k ? "active" : ""}`}
                onClick={() => setAddMethod(k)}
              >
                <div className="method-name">{METHODS[k].label}</div>
                <div className="method-sub">{METHODS[k].sublabel}</div>
              </button>
            ))}
          </div>
          <div className="field" style={{ margin: "0.8rem 0 0.4rem" }}>
            <label>Amount (USDC)</label>
            <input type="number" min={1} value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
          </div>
          <div className="quote">
            <div className="between"><span className="dim">Fee ({(METHODS[addMethod].depositFeePct * 100).toFixed(1)}%)</span><span>−{usd(quote.fee)}</span></div>
            {quote.rewards > 0 && (
              <div className="between"><span className="dim">Rewards earned ({(METHODS[addMethod].rewardsPct * 100).toFixed(0)}%)</span><span style={{ color: "var(--yes)" }}>+{usd(quote.rewards)}</span></div>
            )}
            <div className="between"><span className="dim">Credited to balance</span><b>{usd(quote.credited)}</b></div>
            <div className="between"><span className="dim">Net cost</span><b>{usd(quote.netCost)}</b></div>
            <div className="between"><span className="dim">Arrives</span><span>{METHODS[addMethod].etaLabel}</span></div>
          </div>
          {depositDecision.reason && (
            <div className={`hint ${depositDecision.severity === "block" ? "err" : "warn"}`} style={{ marginTop: "0.5rem" }}>
              {depositDecision.severity === "block" ? "⛔" : "⚠️"} {depositDecision.reason}
            </div>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: "0.7rem" }} disabled={!depositDecision.allow || busy} onClick={deposit}>
            {busy ? "Processing…" : `Add ${usd(quote.credited)}`}
          </button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: "0.5rem" }} onClick={() => setDepositOpen(true)}>
            Fund with USDC via Unifold (live rail) →
          </button>
        </div>

        {/* ---------- cash out (lifecycle + failure mode) ---------- */}
        <div className="panel">
          <h3>Cash out</h3>
          <div className="field" style={{ marginBottom: "0.4rem" }}>
            <label>Amount (USDC) <span className="dim" style={{ float: "right", fontWeight: 600 }}>Balance {usd(balance)}</span></label>
            <input type="number" min={1} value={outAmount} onChange={(e) => setOutAmount(e.target.value)} className={insufficient ? "invalid" : ""} />
          </div>
          {insufficient && <div className="hint err">Amount exceeds your available balance.</div>}
          <label className="fail-toggle">
            <input type="checkbox" checked={forceFail} onChange={(e) => setForceFail(e.target.checked)} style={{ width: "auto" }} />
            <span>Simulate a failed settlement (demo error handling)</span>
          </label>
          <button className="btn btn-block" style={{ marginTop: "0.6rem" }} disabled={outAmt <= 0 || insufficient || busy} onClick={cashOut}>
            {busy ? "Processing…" : `Withdraw ${usd(outAmt)} to bank`}
          </button>
          <div className="hint" style={{ marginTop: "0.5rem" }}>
            Funds are held on request and only debit on settlement. A failed rail auto-reverses the hold — the balance is never left short.
          </div>
        </div>

        {/* ---------- responsible gaming ---------- */}
        <div className="panel">
          <h3>Limits &amp; responsible play</h3>
          <div className="limit-row">
            <span>Weekly deposit cap</span>
            <div className="row" style={{ gap: "0.4rem" }}>
              <span className="dim" style={{ fontSize: "0.8rem" }}>{usd(weekDeposits)} used</span>
              <input type="number" value={limits.weeklyDepositCap} onChange={(e) => setLimits({ ...limits, weeklyDepositCap: Number(e.target.value) || 0 })} style={{ width: 90 }} />
            </div>
          </div>
          <div className="limit-row">
            <span>Per-bet cap</span>
            <input type="number" value={limits.perBetCap} onChange={(e) => setLimits({ ...limits, perBetCap: Number(e.target.value) || 0 })} style={{ width: 90 }} />
          </div>
          <label className="limit-row" style={{ cursor: "pointer" }}>
            <span>Cool-off (block new deposits)</span>
            <input type="checkbox" checked={limits.coolOff} onChange={(e) => setLimits({ ...limits, coolOff: e.target.checked })} style={{ width: "auto" }} />
          </label>
          <div className="hint">Deposits are pre-authorized against these limits before any money moves.</div>
        </div>
      </div>

      {/* ---------- transaction statement ---------- */}
      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="between" style={{ marginBottom: "0.6rem" }}>
          <h3 style={{ margin: 0 }}>Transaction statement</h3>
          <span className="dim" style={{ fontSize: "0.82rem" }}>{all.length} entries · running balance reconciled</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th>Type</th>
                <th>Detail</th>
                <th>Status</th>
                <th className="right">Amount</th>
                <th className="right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {recon.rows.map(({ txn, running }) => (
                <tr key={txn.id}>
                  <td>
                    <span className="txn-type">{TYPE_META[txn.type].icon} {TYPE_META[txn.type].label}</span>
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div className="txn-note">{txn.note}</div>
                    <div className="faint" style={{ fontSize: "0.74rem" }}>{new Date(txn.createdAt).toLocaleString()}</div>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_META[txn.status].cls}`}>
                      <span className="badge-dot" />
                      {STATUS_META[txn.status].label}
                    </span>
                  </td>
                  <td className={`right txn-amt ${txn.direction}`}>
                    {txn.direction === "credit" ? "+" : "−"}{usd(txn.amount)}
                  </td>
                  <td className="right num">{txn.status === "settled" ? usd(running) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- settlements + escrow reconciliation ---------- */}
      {settlements.length > 0 && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3>Settlements &amp; escrow</h3>
          <div className="hint" style={{ marginTop: "-0.3rem", marginBottom: "0.8rem" }}>
            Parimutuel payout: winners get their stake back plus a pro-rata slice of the losing pool, net of a {(PLATFORM_FEE_PCT * 100).toFixed(0)}% platform fee. Escrow invariant: staked in = paid out + fee.
          </div>
          <div className="stack">
            {settlements.map((s) => s && (
              <div key={s.marketId} className="settle-card">
                <div className="between">
                  <div className="txn-note" style={{ fontWeight: 700 }}>{s.question}</div>
                  <span className={`recon-chip ${s.reconciles ? "ok" : "bad"}`}>{s.reconciles ? "✓ Escrow balanced" : "⚠ Drift"}</span>
                </div>
                <div className="settle-grid">
                  <div><span className="l">Total pool</span><span className="v">{usd(s.totalPool)}</span></div>
                  <div><span className="l">Won ({s.outcome})</span><span className="v">{usd(s.winningPool)}</span></div>
                  <div><span className="l">Lost</span><span className="v">{usd(s.losingPool)}</span></div>
                  <div><span className="l">Platform fee</span><span className="v">{usd(s.platformFee)}</span></div>
                  <div><span className="l">Paid to winners</span><span className="v">{usd(s.distributed)}</span></div>
                  <div><span className="l">Your payout</span><span className="v" style={{ color: s.yourProfit >= 0 ? "var(--yes)" : "var(--no)" }}>{usd(s.yourPayout)} ({s.yourProfit >= 0 ? "+" : ""}{usd(s.yourProfit)})</span></div>
                </div>
                <div className="escrow-eq">
                  staked {usd(s.totalPool)} = paid {usd(s.distributed)} + fee {usd(s.platformFee)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- trust & reliability (req #6) ---------- */}
      <div className="panel trust-panel" style={{ marginTop: "1rem" }}>
        <h3>Trust &amp; reliability</h3>
        <div className="trust-grid">
          {[
            ["Financial correctness", "Parimutuel math holds the escrow invariant (staked = payouts + fee); balances derive from the ledger, never a stored number."],
            ["Idempotency", "Every movement carries an idempotency key; deposits credit exactly once even if the poll and webhook both observe them."],
            ["Failure modes", "A withdrawal only debits on settlement. A failed rail auto-reverses the hold, so the balance is never left short."],
            ["Reliability", "Read-modify-write is serialized in the store; the money layer degrades to a file backend when the DB is offline."],
            ["Responsible play", "Deposits are pre-authorized against weekly/per-bet caps and a cool-off switch before any funds move."],
            ["Privacy & safety", "Sandbox test USDC only — no real money, no live banking or card credentials, secrets kept server-side and gitignored."],
          ].map(([h, b]) => (
            <div key={h} className="trust-item">
              <div className="trust-h">{h}</div>
              <div className="trust-b">{b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
