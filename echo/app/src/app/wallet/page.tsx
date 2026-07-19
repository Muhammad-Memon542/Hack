"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useApp } from "@/app/providers";
import { useRouter } from "next/navigation";
import { CURRENT_USER_ID, type Market, type Position } from "@/lib/mock";

// ── Types ──────────────────────────────────────────────────────────
type TxType = "deposit" | "bet" | "payout" | "withdrawal" | "fee";
type DepositMethod = "bank" | "card" | "usdc";
type DepositPhase = "input" | "method" | "processing" | "settled";

interface WalletTx {
  id: string;
  type: TxType;
  description: string;
  amount: number; // positive = credit, negative = debit
  balance: number;
  ts: string;
  marketId?: string;
  method?: DepositMethod;
  idempotencyKey: string;
  ref: string;
  status: "settled" | "pending";
  timeline: { label: string; ts: string }[];
}

interface ResponsiblePlay {
  weeklyCap: number;
  perBetCap: number;
  coolOff: boolean;
}

const METHODS: Record<DepositMethod, { label: string; fee: string; feeNum: number; rewards: string; rewardsNum: number; net: string; eta: string; icon: string }> = {
  bank:  { label: "Bank Transfer", fee: "0%", feeNum: 0, rewards: "—", rewardsNum: 0, net: "0%", eta: "1–3 days", icon: "🏦" },
  card:  { label: "Debit / Credit Card", fee: "2.5%", feeNum: 0.025, rewards: "1% back", rewardsNum: 0.01, net: "1.5%", eta: "Instant", icon: "💳" },
  usdc:  { label: "USDC (on-chain)", fee: "1%", feeNum: 0.01, rewards: "—", rewardsNum: 0, net: "1%", eta: "~1 min", icon: "🪙" },
};

// ── Helpers ─────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtMoney = (n: number) => {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
};

function buildSeedTxs(bal: number, positions: Position[], markets: Market[]): WalletTx[] {
  const txs: WalletTx[] = [];
  let running = 0;
  const base = new Date("2026-07-12T09:00:00Z");

  // initial deposit
  running += 100;
  txs.push({
    id: uid(), type: "deposit", description: "Initial deposit via Bank Transfer",
    amount: 100, balance: running, ts: new Date(base.getTime()).toISOString(),
    method: "bank", idempotencyKey: `idem_${uid()}`, ref: `DEP-${uid().toUpperCase()}`,
    status: "settled",
    timeline: [
      { label: "Initiated", ts: new Date(base.getTime()).toISOString() },
      { label: "Processing", ts: new Date(base.getTime() + 3600_000).toISOString() },
      { label: "Settled", ts: new Date(base.getTime() + 86400_000).toISOString() },
    ],
  });

  // second deposit
  running += 50;
  txs.push({
    id: uid(), type: "deposit", description: "Card deposit",
    amount: 50, balance: running, ts: new Date(base.getTime() + 86400_000 * 2).toISOString(),
    method: "card", idempotencyKey: `idem_${uid()}`, ref: `DEP-${uid().toUpperCase()}`,
    status: "settled",
    timeline: [
      { label: "Initiated", ts: new Date(base.getTime() + 86400_000 * 2).toISOString() },
      { label: "Card charged", ts: new Date(base.getTime() + 86400_000 * 2 + 5000).toISOString() },
      { label: "Settled", ts: new Date(base.getTime() + 86400_000 * 2 + 10000).toISOString() },
    ],
  });

  // card fee
  running -= 1.25;
  txs.push({
    id: uid(), type: "fee", description: "Card processing fee (2.5%)",
    amount: -1.25, balance: running, ts: new Date(base.getTime() + 86400_000 * 2 + 10001).toISOString(),
    idempotencyKey: `idem_${uid()}`, ref: `FEE-${uid().toUpperCase()}`, status: "settled",
    timeline: [{ label: "Applied", ts: new Date(base.getTime() + 86400_000 * 2 + 10001).toISOString() }],
  });

  // bets from user positions
  const userPos = positions.filter(p => p.userId === CURRENT_USER_ID).slice(0, 5);
  userPos.forEach((p, i) => {
    const m = markets.find(mk => mk.id === p.marketId);
    running -= p.amount;
    txs.push({
      id: uid(), type: "bet",
      description: `${p.side} on "${m?.question?.slice(0, 50) ?? p.marketId}"`,
      amount: -p.amount, balance: running,
      ts: new Date(base.getTime() + 86400_000 * (3 + i)).toISOString(),
      marketId: p.marketId,
      idempotencyKey: `idem_${uid()}`, ref: `BET-${uid().toUpperCase()}`, status: "settled",
      timeline: [
        { label: "Placed", ts: new Date(base.getTime() + 86400_000 * (3 + i)).toISOString() },
        { label: "Confirmed", ts: new Date(base.getTime() + 86400_000 * (3 + i) + 2000).toISOString() },
      ],
    });
  });

  // a payout
  running += 18.4;
  txs.push({
    id: uid(), type: "payout", description: "Payout — settled market",
    amount: 18.4, balance: running, ts: new Date(base.getTime() + 86400_000 * 5).toISOString(),
    idempotencyKey: `idem_${uid()}`, ref: `PAY-${uid().toUpperCase()}`, status: "settled",
    timeline: [
      { label: "Market resolved", ts: new Date(base.getTime() + 86400_000 * 5).toISOString() },
      { label: "Payout credited", ts: new Date(base.getTime() + 86400_000 * 5 + 60000).toISOString() },
    ],
  });

  // reconcile balance to actual
  const diff = bal - running;
  if (Math.abs(diff) > 0.01) {
    running += diff;
    txs.push({
      id: uid(), type: diff > 0 ? "deposit" : "fee",
      description: diff > 0 ? "Balance reconciliation (credit)" : "Balance reconciliation (debit)",
      amount: diff, balance: running,
      ts: new Date(base.getTime() + 86400_000 * 6).toISOString(),
      idempotencyKey: `idem_${uid()}`, ref: `REC-${uid().toUpperCase()}`, status: "settled",
      timeline: [{ label: "Applied", ts: new Date(base.getTime() + 86400_000 * 6).toISOString() }],
    });
  }

  return txs;
}

// ── Main Component ─────────────────────────────────────────────────
export default function WalletPage() {
  const router = useRouter();
  const { connected, balanceUsdc, setBalanceUsdc, positions, markets, me, setDepositOpen } = useApp();

  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && positions.length >= 0) {
      setTxs(buildSeedTxs(balanceUsdc, positions, markets));
      setInitialized(true);
    }
  }, [initialized, balanceUsdc, positions, markets]);

  // Deposit flow
  const [depositPhase, setDepositPhase] = useState<DepositPhase>("input");
  const [depositAmt, setDepositAmt] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("bank");

  // Receipt drawer
  const [receiptTx, setReceiptTx] = useState<WalletTx | null>(null);

  // Statement filters
  const [filterType, setFilterType] = useState<TxType | "all">("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Responsible play
  const [rp, setRp] = useState<ResponsiblePlay>({ weeklyCap: 500, perBetCap: 100, coolOff: false });
  const [rpOpen, setRpOpen] = useState(false);

  const amt = parseFloat(depositAmt) || 0;

  // ── Exposure analyzer ──
  const myPositions = useMemo(() => positions.filter(p => p.userId === CURRENT_USER_ID), [positions]);
  const exposure = useMemo(() => {
    const byMarket: Record<string, { market: Market; totalStake: number; side: "YES" | "NO"; projectedPayout: number }> = {};
    myPositions.forEach(p => {
      const m = markets.find(mk => mk.id === p.marketId);
      if (!m || m.status === "SETTLED") return;
      if (!byMarket[p.marketId]) {
        byMarket[p.marketId] = { market: m, totalStake: 0, side: p.side, projectedPayout: 0 };
      }
      byMarket[p.marketId].totalStake += p.amount;
      const pool = p.side === "YES" ? m.yesPool : m.noPool;
      const total = m.yesPool + m.noPool;
      if (pool > 0) {
        byMarket[p.marketId].projectedPayout += (p.amount / pool) * total;
      }
    });
    const entries = Object.values(byMarket);
    const totalAtStake = entries.reduce((s, e) => s + e.totalStake, 0);
    const totalProjected = entries.reduce((s, e) => s + e.projectedPayout, 0);
    const maxConcentration = entries.length > 0
      ? Math.max(...entries.map(e => e.totalStake)) / (totalAtStake || 1) * 100
      : 0;
    return { entries, totalAtStake, totalProjected, maxConcentration };
  }, [myPositions, markets]);

  // ── Filtered & sorted txs ──
  const displayTxs = useMemo(() => {
    let list = filterType === "all" ? txs : txs.filter(t => t.type === filterType);
    list = [...list].sort((a, b) => {
      const da = new Date(a.ts).getTime(), db = new Date(b.ts).getTime();
      return sortDir === "desc" ? db - da : da - db;
    });
    return list;
  }, [txs, filterType, sortDir]);

  // ── CSV export ──
  const exportCSV = useCallback(() => {
    const header = "Date,Type,Description,Amount,Balance,Reference,Status\n";
    const rows = displayTxs.map(t =>
      `"${fmtDate(t.ts)}","${t.type}","${t.description.replace(/"/g, '""')}","${t.amount.toFixed(2)}","${t.balance.toFixed(2)}","${t.ref}","${t.status}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "echo-statement.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [displayTxs]);

  // ── Deposit execution (sandbox local state) ──
  const executeDeposit = useCallback(() => {
    if (amt <= 0) return;
    setDepositPhase("processing");
    const method = METHODS[depositMethod];
    const fee = amt * method.feeNum;
    const reward = amt * method.rewardsNum;
    const net = amt - fee + reward;

    setTimeout(() => {
      const newBal = balanceUsdc + net;
      setBalanceUsdc(newBal);

      const baseTxs: WalletTx[] = [];
      const now = new Date().toISOString();

      baseTxs.push({
        id: uid(), type: "deposit", description: `${method.label} deposit`,
        amount: amt, balance: balanceUsdc + amt,
        ts: now, method: depositMethod,
        idempotencyKey: `idem_${uid()}`, ref: `DEP-${uid().toUpperCase()}`, status: "settled",
        timeline: [
          { label: "Initiated", ts: now },
          { label: "Settled", ts: now },
        ],
      });

      if (fee > 0) {
        baseTxs.push({
          id: uid(), type: "fee", description: `${method.label} fee (${method.fee})`,
          amount: -fee, balance: balanceUsdc + amt - fee,
          ts: now, idempotencyKey: `idem_${uid()}`, ref: `FEE-${uid().toUpperCase()}`, status: "settled",
          timeline: [{ label: "Applied", ts: now }],
        });
      }

      if (reward > 0) {
        baseTxs.push({
          id: uid(), type: "payout", description: `Card rewards (${method.rewards})`,
          amount: reward, balance: newBal,
          ts: now, idempotencyKey: `idem_${uid()}`, ref: `RWD-${uid().toUpperCase()}`, status: "settled",
          timeline: [{ label: "Credited", ts: now }],
        });
      }

      setTxs(prev => [...baseTxs, ...prev]);
      setDepositPhase("settled");
    }, 2200);
  }, [amt, depositMethod, balanceUsdc]);

  if (!connected) {
    return (
      <div className="shell">
        <div className="empty" style={{ marginTop: "3rem" }}>
          <strong>Connect to view your wallet</strong>
          <p style={{ marginTop: "0.5rem" }}>Log in to manage your funds, view statements, and analyze exposure.</p>
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => router.push("/login")}>Log in</button>
        </div>
      </div>
    );
  }

  // Totals
  const totalCredits = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalDebits = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="shell">
      {/* ── Balance Hero ── */}
      <div className="w-hero">
        <div className="w-hero-main">
          <div className="w-hero-label">Available Balance</div>
          <div className="w-hero-bal">${balanceUsdc.toFixed(2)}</div>
          <div className="w-hero-reconcile">
            <span className="w-hero-credit">+${totalCredits.toFixed(2)} credits</span>
            <span className="w-hero-sep">−</span>
            <span className="w-hero-debit">${totalDebits.toFixed(2)} debits</span>
            <span className="w-hero-sep">=</span>
            <span className="w-hero-result">${balanceUsdc.toFixed(2)}</span>
          </div>
        </div>
        <div className="w-hero-actions">
          <button className="btn btn-primary" onClick={() => { setDepositPhase("input"); setDepositAmt(""); }}>
            + Add Funds
          </button>
          <button className="btn w-hero-btn" onClick={exportCSV}>↓ Export CSV</button>
        </div>
      </div>

      <div className="w-layout">
        {/* ── Left column ── */}
        <div className="w-main">
          {/* ── Deposit flow ── */}
          <div className="panel">
            <h2>Fund Your Account</h2>

            {depositPhase === "settled" ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Deposit Complete</div>
                <div className="dim" style={{ margin: "0.5rem 0" }}>
                  ${amt.toFixed(2)} via {METHODS[depositMethod].label}
                </div>
                <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "var(--yes)" }}>
                  New balance: ${balanceUsdc.toFixed(2)}
                </div>
                <button className="btn" style={{ marginTop: "1rem" }} onClick={() => { setDepositPhase("input"); setDepositAmt(""); }}>
                  Done
                </button>
              </div>
            ) : depositPhase === "processing" ? (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <div className="auth-spinner" />
                <div style={{ fontWeight: 700, marginTop: "0.5rem" }}>Processing deposit...</div>
                <div className="faint" style={{ fontSize: "0.85rem" }}>This may take a moment</div>
              </div>
            ) : (
              <>
                {/* Amount input */}
                <div className="field">
                  <label>Amount (USD)</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontWeight: 800, color: "var(--text-dim)" }}>$</span>
                    <input
                      type="number" min="1" step="0.01" placeholder="0.00"
                      value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                      style={{ paddingLeft: "1.6rem", fontSize: "1.3rem", fontWeight: 800 }}
                    />
                  </div>
                  <div className="w-quick-amts">
                    {[25, 50, 100, 250].map(v => (
                      <button key={v} className="btn btn-sm" onClick={() => setDepositAmt(String(v))}>${v}</button>
                    ))}
                  </div>
                </div>

                {/* Method selection */}
                <div style={{ marginTop: "0.5rem" }}>
                  <label>Payment Method</label>
                  <div className="w-methods">
                    {(Object.entries(METHODS) as [DepositMethod, typeof METHODS["bank"]][]).map(([key, m]) => (
                      <button
                        key={key}
                        className={`w-method ${depositMethod === key ? "active" : ""}`}
                        onClick={() => setDepositMethod(key)}
                      >
                        <div className="w-method-top">
                          <span className="w-method-icon">{m.icon}</span>
                          <span className="w-method-name">{m.label}</span>
                          {depositMethod === key && <span className="w-method-check">✓</span>}
                        </div>
                        <div className="w-method-details">
                          <div><span className="faint">Fee:</span> {m.fee}</div>
                          <div><span className="faint">Rewards:</span> {m.rewards}</div>
                          <div><span className="faint">Net cost:</span> {m.net}</div>
                          <div><span className="faint">ETA:</span> {m.eta}</div>
                        </div>
                        {amt > 0 && (
                          <div className="w-method-calc">
                            You receive: <strong>${(amt - amt * m.feeNum + amt * m.rewardsNum).toFixed(2)}</strong>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: "1rem", padding: "0.7rem" }}
                  disabled={amt <= 0}
                  onClick={executeDeposit}
                >
                  Deposit ${amt > 0 ? amt.toFixed(2) : "0.00"} via {METHODS[depositMethod].label}
                </button>
              </>
            )}
          </div>

          {/* ── Transaction Statement ── */}
          <div className="panel" style={{ marginTop: "1rem" }}>
            <div className="between" style={{ marginBottom: "0.9rem" }}>
              <h2 style={{ margin: 0 }}>Statement</h2>
              <div className="row" style={{ gap: "0.5rem" }}>
                <select className="select" value={filterType} onChange={e => setFilterType(e.target.value as TxType | "all")}>
                  <option value="all">All types</option>
                  <option value="deposit">Deposits</option>
                  <option value="bet">Bets</option>
                  <option value="payout">Payouts</option>
                  <option value="fee">Fees</option>
                  <option value="withdrawal">Withdrawals</option>
                </select>
                <button className="btn btn-sm" onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}>
                  {sortDir === "desc" ? "↓ Newest" : "↑ Oldest"}
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="board" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th className="right">Amount</th>
                    <th className="right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTxs.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-faint)", padding: "2rem" }}>No transactions yet</td></tr>
                  )}
                  {displayTxs.map(tx => (
                    <tr key={tx.id} style={{ cursor: "pointer" }} onClick={() => setReceiptTx(tx)}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}>{fmtDate(tx.ts)}</td>
                      <td>
                        <span className={`badge ${tx.type === "deposit" || tx.type === "payout" ? "OPEN" : tx.type === "bet" ? "RESOLVING" : "DISPUTED"}`}
                          style={{ fontSize: "0.62rem" }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.88rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</td>
                      <td className="right" style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: tx.amount >= 0 ? "var(--yes)" : "var(--no)" }}>
                        {fmtMoney(tx.amount)}
                      </td>
                      <td className="right num" style={{ fontWeight: 700 }}>${tx.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-side">
          {/* Exposure analyzer */}
          <div className="panel">
            <h3>Money at Work</h3>
            <div className="stat-row" style={{ marginBottom: "0.75rem" }}>
              <div className="stat-cell">
                <div className="v">${exposure.totalAtStake.toFixed(2)}</div>
                <div className="l">At Stake</div>
              </div>
              <div className="stat-cell">
                <div className="v" style={{ color: "var(--yes)" }}>${exposure.totalProjected.toFixed(2)}</div>
                <div className="l">Projected</div>
              </div>
            </div>

            {exposure.maxConcentration > 60 && (
              <div className="info-box warn" style={{ marginBottom: "0.75rem", fontSize: "0.82rem" }}>
                ⚠️ Concentration risk: {exposure.maxConcentration.toFixed(0)}% of your stake is in one market.
                Consider diversifying.
              </div>
            )}

            {exposure.entries.length === 0 ? (
              <div className="faint" style={{ fontSize: "0.88rem" }}>No open positions</div>
            ) : (
              <div className="stack" style={{ gap: "0.4rem" }}>
                {exposure.entries.slice(0, 6).map(e => (
                  <div key={e.market.id} className="w-exposure-row" onClick={() => router.push(`/market/${e.market.id}`)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.market.question.slice(0, 45)}{e.market.question.length > 45 ? "…" : ""}
                      </div>
                      <div className="faint" style={{ fontSize: "0.78rem" }}>{e.side} · ${e.totalStake.toFixed(2)} staked</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--yes)" }}>${e.projectedPayout.toFixed(2)}</div>
                      <div className="faint" style={{ fontSize: "0.72rem" }}>projected</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Responsible play */}
          <div className="panel">
            <div className="between" style={{ marginBottom: "0.7rem" }}>
              <h3 style={{ margin: 0 }}>Responsible Play</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setRpOpen(!rpOpen)}>
                {rpOpen ? "Close" : "Edit"}
              </button>
            </div>

            {rpOpen ? (
              <div className="stack">
                <div className="field" style={{ marginBottom: "0.5rem" }}>
                  <label>Weekly spending cap ($)</label>
                  <input type="number" min="0" value={rp.weeklyCap} onChange={e => setRp(p => ({ ...p, weeklyCap: Number(e.target.value) }))} />
                </div>
                <div className="field" style={{ marginBottom: "0.5rem" }}>
                  <label>Per-bet cap ($)</label>
                  <input type="number" min="0" value={rp.perBetCap} onChange={e => setRp(p => ({ ...p, perBetCap: Number(e.target.value) }))} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={rp.coolOff} onChange={e => setRp(p => ({ ...p, coolOff: e.target.checked }))}
                    style={{ width: "auto", accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: "0.88rem" }}>Cool-off mode (24h pause on betting)</span>
                </label>
                {rp.coolOff && (
                  <div className="info-box warn" style={{ fontSize: "0.82rem" }}>
                    🧊 Cool-off active. All bets are paused for 24 hours.
                  </div>
                )}
              </div>
            ) : (
              <div className="stack" style={{ gap: "0.35rem", fontSize: "0.88rem" }}>
                <div className="between"><span className="dim">Weekly cap</span><strong>${rp.weeklyCap}</strong></div>
                <div className="between"><span className="dim">Per-bet cap</span><strong>${rp.perBetCap}</strong></div>
                <div className="between"><span className="dim">Cool-off</span><strong>{rp.coolOff ? "🧊 Active" : "Off"}</strong></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Receipt Drawer (Modal) ── */}
      {receiptTx && (
        <div className="backdrop" onClick={() => setReceiptTx(null)}>
          <div className="modal narrow" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Transaction Receipt</h2>
              <button className="x-btn" onClick={() => setReceiptTx(null)}>✕</button>
            </div>

            <div className="between" style={{ marginBottom: "1rem" }}>
              <span className={`badge ${receiptTx.type === "deposit" || receiptTx.type === "payout" ? "OPEN" : "DISPUTED"}`}>
                {receiptTx.type}
              </span>
              <span className="badge SETTLED">{receiptTx.status}</span>
            </div>

            <div style={{ fontSize: "1.6rem", fontWeight: 800, textAlign: "center", marginBottom: "1rem",
              color: receiptTx.amount >= 0 ? "var(--yes)" : "var(--no)" }}>
              {fmtMoney(receiptTx.amount)}
            </div>

            <div className="stack" style={{ gap: "0.5rem", marginBottom: "1.25rem" }}>
              <div className="between" style={{ fontSize: "0.88rem" }}>
                <span className="dim">Description</span>
                <span style={{ fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{receiptTx.description}</span>
              </div>
              <div className="between" style={{ fontSize: "0.88rem" }}>
                <span className="dim">Date</span>
                <span className="num">{fmtDate(receiptTx.ts)}</span>
              </div>
              <div className="between" style={{ fontSize: "0.88rem" }}>
                <span className="dim">Reference</span>
                <span className="mono" style={{ fontSize: "0.8rem" }}>{receiptTx.ref}</span>
              </div>
              <div className="between" style={{ fontSize: "0.88rem" }}>
                <span className="dim">Idempotency Key</span>
                <span className="mono" style={{ fontSize: "0.8rem" }}>{receiptTx.idempotencyKey}</span>
              </div>
              <div className="between" style={{ fontSize: "0.88rem" }}>
                <span className="dim">Running Balance</span>
                <span className="num" style={{ fontWeight: 800 }}>${receiptTx.balance.toFixed(2)}</span>
              </div>
            </div>

            {/* Timeline */}
            <h3 style={{ marginBottom: "0.5rem" }}>Event Timeline</h3>
            <div className="w-timeline">
              {receiptTx.timeline.map((ev, i) => (
                <div key={i} className="w-timeline-item">
                  <div className={`w-timeline-dot ${i === receiptTx.timeline.length - 1 ? "final" : ""}`} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{ev.label}</div>
                    <div className="faint" style={{ fontSize: "0.78rem" }}>{fmtDate(ev.ts)}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-block" style={{ marginTop: "1.25rem" }} onClick={() => {
              const blob = new Blob([JSON.stringify(receiptTx, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `receipt-${receiptTx.ref}.json`; a.click();
              URL.revokeObjectURL(url);
            }}>
              ↓ Download Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
