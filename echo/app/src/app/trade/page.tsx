"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useApp } from "@/app/providers";
import { useRouter } from "next/navigation";
import {
  CURRENT_USER_ID,
  type Market,
  type Side,
  relativeTime,
  yesPct,
  volume,
} from "@/lib/mock";

// ══════════════════════════════════════════════════════════════════════
// LMSR Engine
// ══════════════════════════════════════════════════════════════════════
const LMSR = {
  cost(b: number, qYes: number, qNo: number): number {
    const maxQ = Math.max(qYes, qNo);
    return (
      b *
      (maxQ +
        Math.log(
          Math.exp((qYes - maxQ) / 1) + Math.exp((qNo - maxQ) / 1)
        ))
    );
  },
  price(
    b: number,
    qYes: number,
    qNo: number,
    side: "YES" | "NO"
  ): number {
    const expY = Math.exp(qYes / b);
    const expN = Math.exp(qNo / b);
    return side === "YES" ? expY / (expY + expN) : expN / (expY + expN);
  },
  costForShares(
    b: number,
    qYes: number,
    qNo: number,
    side: "YES" | "NO",
    shares: number
  ): number {
    const c0 = LMSR.cost(b, qYes, qNo);
    const newYes = side === "YES" ? qYes + shares : qYes;
    const newNo = side === "NO" ? qNo + shares : qNo;
    return LMSR.cost(b, newYes, newNo) - c0;
  },
  sharesToBuy(
    b: number,
    qYes: number,
    qNo: number,
    side: "YES" | "NO",
    spend: number
  ): number {
    let lo = 0,
      hi = spend / 0.001;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const cost = LMSR.costForShares(b, qYes, qNo, side, mid);
      if (cost < spend) lo = mid;
      else hi = mid;
    }
    return lo;
  },
};

// ══════════════════════════════════════════════════════════════════════
// Probability Ring SVG
// ══════════════════════════════════════════════════════════════════════
function ProbRing({
  yes,
  size = 180,
  label,
}: {
  yes: number;
  size?: number;
  label?: string;
}) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const yesLen = circ * (yes / 100);
  const noLen = circ - yesLen;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="prob-ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="yesGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14F195" />
            <stop offset="100%" stopColor="#9945FF" />
          </linearGradient>
          <linearGradient id="noGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6b85" />
            <stop offset="100%" stopColor="#ff3355" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#noGrad)"
          strokeWidth="10"
          strokeDasharray={`${noLen} ${yesLen}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#yesGrad)"
          strokeWidth="10"
          strokeDasharray={`${yesLen} ${noLen}`}
          strokeDashoffset={-noLen}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          filter="url(#glow)"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize="36"
          fontWeight="900"
          style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
        >
          {yes.toFixed(1)}%
        </text>
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.5)"
          fontSize="11"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          {label ?? "YES PROBABILITY"}
        </text>
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Solana TX Simulator animation
// ══════════════════════════════════════════════════════════════════════
function SolanaSimulator({
  active,
  side,
  amount,
  onDone,
}: {
  active: boolean;
  side: Side;
  amount: number;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const steps = [
    "Building transaction...",
    "Deriving PDAs...",
    "Serializing Borsh args...",
    "Signing with wallet...",
    `Sending to Solana devnet...`,
    "Awaiting confirmation...",
    "Confirmed! 1 block.",
  ];

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(timer);
        setTimeout(onDone, 600);
        setStep(steps.length - 1);
      } else {
        setStep(i);
      }
    }, 400);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  return (
    <div className="sol-sim">
      <div className="sol-sim-header">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="14" fill="url(#solGrad2)" />
          <defs>
            <linearGradient id="solGrad2" x1="0" y1="0" x2="28" y2="28">
              <stop offset="0%" stopColor="#14F195" />
              <stop offset="100%" stopColor="#9945FF" />
            </linearGradient>
          </defs>
          <path d="M8 17.5h8.5l3.5-3H11.5L8 17.5z" fill="#fff" />
          <path d="M8 10.5h8.5l3.5 3H11.5L8 10.5z" fill="#fff" />
          <path d="M8 14h12" stroke="#fff" strokeWidth="1.5" />
        </svg>
        <span>Solana Transaction</span>
      </div>
      <div className="sol-sim-steps">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`sol-sim-step ${i < step ? "done" : i === step ? "active" : ""}`}
          >
            <div className="sol-sim-dot">
              {i < step ? (
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#14F195" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
              ) : i === step ? (
                <div className="sol-sim-spinner" />
              ) : (
                <div className="sol-sim-empty" />
              )}
            </div>
            <span>{s}</span>
          </div>
        ))}
      </div>
      {step >= steps.length - 1 && (
        <div className="sol-sim-sig">
          <span className="sol-sim-sig-label">Signature</span>
          <span className="sol-sim-sig-val mono">
            {Array.from({ length: 44 }, () =>
              "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[
                Math.floor(Math.random() * 58)
              ]
            ).join("")}
          </span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════
export default function TradePage() {
  const router = useRouter();
  const {
    connected,
    markets,
    positions,
    balanceUsdc,
    placeBet,
    liveBets,
  } = useApp();

  const openMarkets = useMemo(
    () => markets.filter((m) => m.status === "OPEN"),
    [markets]
  );
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const selectedMarket = useMemo(
    () =>
      openMarkets.find((m) => m.id === selectedMarketId) ?? openMarkets[0],
    [openMarkets, selectedMarketId]
  );

  useEffect(() => {
    if (!selectedMarketId && openMarkets.length > 0)
      setSelectedMarketId(openMarkets[0].id);
  }, [openMarkets, selectedMarketId]);

  const { b, qYes, qNo } = useMemo(() => {
    if (!selectedMarket) return { b: 100, qYes: 50, qNo: 50 };
    const total = selectedMarket.yesPool + selectedMarket.noPool || 1;
    const scale = 100 / total;
    const qY = selectedMarket.yesPool * scale;
    const qN = selectedMarket.noPool * scale;
    const liq = Math.max(10, (qY + qN) * 0.5);
    return { b: liq, qYes: qY, qNo: qN };
  }, [selectedMarket]);

  // Order state
  const [side, setSide] = useState<Side>("YES");
  const [spendStr, setSpendStr] = useState("10");
  const [slippage, setSlippage] = useState(2);
  const [simulating, setSimulating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
  const [tradeTab, setTradeTab] = useState<"strategies" | "custom">("strategies");
  const spend = parseFloat(spendStr) || 0;

  const QUICK_AMOUNTS = [5, 10, 25, 50, 100];

  // ── Strategy definitions ──
  type Strategy = {
    id: string;
    name: string;
    icon: string;
    desc: string;
    detail: string;
    apply: (pctYes: number, bal: number) => { side: Side; amount: number; slippage: number };
    tag: string;
  };

  const strategies: Strategy[] = useMemo(() => [
    {
      id: "value",
      name: "Value Bet",
      icon: "💎",
      desc: "Bet on the underdog when odds look mispriced",
      detail: "Picks the less-likely side and invests 10% of your balance. Best when you think the crowd is wrong.",
      tag: "Beginner",
      apply: (pY: number, bal: number) => ({
        side: pY > 50 ? "NO" as Side : "YES" as Side,
        amount: Math.max(5, Math.floor(bal * 0.1)),
        slippage: 2,
      }),
    },
    {
      id: "momentum",
      name: "Ride the Wave",
      icon: "🌊",
      desc: "Follow the crowd — bet with the majority",
      detail: "Backs the leading side with a moderate 8% of balance. Good for markets with strong consensus.",
      tag: "Popular",
      apply: (pY: number, bal: number) => ({
        side: pY >= 50 ? "YES" as Side : "NO" as Side,
        amount: Math.max(5, Math.floor(bal * 0.08)),
        slippage: 1,
      }),
    },
    {
      id: "safe",
      name: "Safe Play",
      icon: "🛡️",
      desc: "Small bet, low risk — great for beginners",
      detail: "A conservative $5 bet on the leading side with tight 0.5% slippage. Perfect for learning the ropes.",
      tag: "Low Risk",
      apply: (pY: number) => ({
        side: pY >= 50 ? "YES" as Side : "NO" as Side,
        amount: 5,
        slippage: 0.5,
      }),
    },
    {
      id: "contrarian",
      name: "Contrarian",
      icon: "🔄",
      desc: "Bet against extreme odds for big upside",
      detail: "When one side is above 70%, this bets against it for a higher potential payout. High risk, high reward.",
      tag: "Advanced",
      apply: (pY: number, bal: number) => ({
        side: pY > 50 ? "NO" as Side : "YES" as Side,
        amount: Math.max(5, Math.floor(bal * 0.05)),
        slippage: 5,
      }),
    },
    {
      id: "conviction",
      name: "Max Conviction",
      icon: "🔥",
      desc: "Go all-in on your strongest pick",
      detail: "Uses 25% of your balance on whichever side you feel strongest about. For markets you've researched deeply.",
      tag: "High Risk",
      apply: (pY: number, bal: number) => ({
        side: pY >= 50 ? "YES" as Side : "NO" as Side,
        amount: Math.max(10, Math.floor(bal * 0.25)),
        slippage: 5,
      }),
    },
    {
      id: "scalp",
      name: "Quick Scalp",
      icon: "⚡",
      desc: "Tiny fast trade to profit from small moves",
      detail: "A $5 trade on the stronger side with minimal slippage. Get in, ride a small move, get out.",
      tag: "Fast",
      apply: (pY: number) => ({
        side: pY >= 50 ? "YES" as Side : "NO" as Side,
        amount: 5,
        slippage: 0.5,
      }),
    },
  ], []);

  const applyStrategy = useCallback((strat: Strategy) => {
    if (!selectedMarket) return;
    const pY = LMSR.price(b, qYes, qNo, "YES") * 100;
    const result = strat.apply(pY, balanceUsdc);
    setSide(result.side);
    setSpendStr(String(Math.min(result.amount, Math.floor(balanceUsdc))));
    setSlippage(result.slippage);
    setActiveStrategy(strat.id);
    setTradeTab("custom");
  }, [selectedMarket, b, qYes, qNo, balanceUsdc]);

  const quote = useMemo(() => {
    if (spend <= 0 || !selectedMarket) return null;
    const spotBefore = LMSR.price(b, qYes, qNo, side);
    const rawShares = LMSR.sharesToBuy(b, qYes, qNo, side, spend);
    if (rawShares <= 0) return null;
    const contracts = spend / spotBefore;
    const avgPrice = spotBefore;
    const newYes = side === "YES" ? qYes + rawShares : qYes;
    const newNo = side === "NO" ? qNo + rawShares : qNo;
    const spotAfter = LMSR.price(b, newYes, newNo, side);
    const impact =
      (Math.abs(spotAfter - spotBefore) / spotBefore) * 100;
    const newProbYes = LMSR.price(b, newYes, newNo, "YES") * 100;
    const lpFee = spend * 0.003;
    const potentialPayout = contracts * 1; // $1 per contract if correct
    const potentialProfit = potentialPayout - spend;
    const charityDonation = potentialProfit > 0 ? potentialProfit * 0.5 : 0;
    const yourProfit = potentialProfit > 0 ? potentialProfit * 0.5 : potentialProfit;
    const minContracts = contracts * (1 - slippage / 100);
    return {
      shares: contracts,
      avgPrice,
      spotBefore,
      spotAfter,
      impact,
      newProbYes,
      lpFee,
      minShares: minContracts,
      potentialPayout,
      potentialProfit,
      charityDonation,
      yourProfit,
    };
  }, [spend, b, qYes, qNo, side, slippage, selectedMarket]);

  // Position panel
  const myPositions = useMemo(
    () =>
      positions.filter(
        (p) =>
          p.userId === CURRENT_USER_ID &&
          markets.some((m) => m.id === p.marketId && m.status !== "SETTLED")
      ),
    [positions, markets]
  );

  // Live market trades
  const marketTrades = useMemo(
    () =>
      selectedMarket
        ? liveBets
            .filter((lb) => lb.marketId === selectedMarket.id)
            .slice(0, 8)
        : [],
    [liveBets, selectedMarket]
  );

  const handleTrade = useCallback(async () => {
    if (!selectedMarket || spend <= 0 || spend > balanceUsdc) return;
    setBetError(null);
    setSimulating(true);
  }, [selectedMarket, spend, balanceUsdc]);

  const handleSimDone = useCallback(async () => {
    if (!selectedMarket) return;
    const result = await placeBet(selectedMarket.id, side, spend);
    setSimulating(false);
    if (result.ok) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      setBetError(result.error ?? "Transaction failed");
    }
  }, [selectedMarket, side, spend, placeBet]);

  if (!connected) {
    return (
      <div className="shell">
        <div className="trade-hero-empty">
          <div className="trade-hero-empty-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="url(#solBg)" />
              <defs>
                <linearGradient id="solBg" x1="0" y1="0" x2="64" y2="64">
                  <stop offset="0%" stopColor="#14F195" />
                  <stop offset="100%" stopColor="#9945FF" />
                </linearGradient>
              </defs>
              <path d="M18 40h18l10-8H28L18 40z" fill="#fff" opacity="0.9" />
              <path d="M18 24h18l10 8H28L18 24z" fill="#fff" opacity="0.9" />
              <path d="M18 32h28" stroke="#fff" strokeWidth="3" opacity="0.9" />
            </svg>
          </div>
          <h1>Trade on Solana</h1>
          <p>
            Connect your wallet to trade outcome shares on Better's LMSR
            exchange, powered by the Solana blockchain.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => router.push("/login")}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (!selectedMarket) {
    return (
      <div className="shell">
        <div className="empty" style={{ marginTop: "3rem" }}>
          <strong>No open markets</strong>
          <p style={{ marginTop: "0.5rem" }}>
            There are no markets available for trading right now.
          </p>
        </div>
      </div>
    );
  }

  const spotYes = LMSR.price(b, qYes, qNo, "YES");
  const spotNo = LMSR.price(b, qYes, qNo, "NO");
  const pctYes = spotYes * 100;
  const pctNo = spotNo * 100;
  const vol = volume(selectedMarket);
  const timeLeft = relativeTime(selectedMarket.closesAt);

  return (
    <div className="shell trade-shell">
      {/* Header */}
      <div className="trade-header">
        <div className="trade-header-left">
          <div className="trade-sol-badge">
            <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="url(#solGradH)" />
              <defs>
                <linearGradient id="solGradH" x1="0" y1="0" x2="28" y2="28">
                  <stop offset="0%" stopColor="#14F195" />
                  <stop offset="100%" stopColor="#9945FF" />
                </linearGradient>
              </defs>
              <path d="M8 17.5h8.5l3.5-3H11.5L8 17.5z" fill="#fff" />
              <path d="M8 10.5h8.5l3.5 3H11.5L8 10.5z" fill="#fff" />
              <path d="M8 14h12" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <span>Solana Devnet</span>
          </div>
          <h1>Trade</h1>
        </div>
        <div className="trade-header-right">
          <div className="trade-balance-chip">
            <span className="trade-balance-label">Balance</span>
            <span className="trade-balance-val">
              ${balanceUsdc.toFixed(2)}
            </span>
            <span className="trade-balance-unit">USDC</span>
          </div>
        </div>
      </div>

      {/* Market selector */}
      <div className="trade-market-selector">
        {openMarkets.map((m) => (
          <button
            key={m.id}
            className={`trade-market-chip ${
              selectedMarketId === m.id ? "active" : ""
            }`}
            onClick={() => setSelectedMarketId(m.id)}
          >
            <span className="trade-market-chip-pct">
              {yesPct(m)}%
            </span>
            <span className="trade-market-chip-q">
              {m.question.length > 40
                ? m.question.slice(0, 40) + "..."
                : m.question}
            </span>
          </button>
        ))}
      </div>

      {/* Trade mode tabs */}
      <div className="trade-tabs">
        <button
          className={`trade-tab ${tradeTab === "strategies" ? "active" : ""}`}
          onClick={() => setTradeTab("strategies")}
        >
          <span className="trade-tab-icon">📋</span> Strategies
        </button>
        <button
          className={`trade-tab ${tradeTab === "custom" ? "active" : ""}`}
          onClick={() => { setTradeTab("custom"); setActiveStrategy(null); }}
        >
          <span className="trade-tab-icon">⚙️</span> Custom Trade
        </button>
      </div>

      {/* Strategies panel */}
      {tradeTab === "strategies" && (
        <div className="strat-panel">
          <div className="strat-header">
            <h2>Pick a Strategy</h2>
            <p>Choose a trading approach — we'll set up the trade for you.</p>
          </div>
          <div className="strat-grid">
            {strategies.map((s) => (
              <button
                key={s.id}
                className={`strat-card ${activeStrategy === s.id ? "active" : ""}`}
                onClick={() => applyStrategy(s)}
              >
                <div className="strat-card-top">
                  <span className="strat-card-icon">{s.icon}</span>
                  <span className={`strat-card-tag ${s.tag.toLowerCase().replace(/\s+/g, "-")}`}>{s.tag}</span>
                </div>
                <div className="strat-card-name">{s.name}</div>
                <div className="strat-card-desc">{s.desc}</div>
                <div className="strat-card-detail">{s.detail}</div>
                <div className="strat-card-action">
                  Apply Strategy →
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="trade-main-grid" style={tradeTab === "strategies" ? { display: "none" } : undefined}>
        {/* ═══ LEFT: Market Context ═══ */}
        <div className="trade-context">
          {/* Market Card */}
          <div className="trade-market-card">
            {selectedMarket.image && (
              <div className="trade-market-img">
                <img
                  src={selectedMarket.image}
                  alt=""
                />
                <div className="trade-market-img-overlay" />
              </div>
            )}
            <div className="trade-market-info">
              <h2 className="trade-market-q">
                {selectedMarket.question}
              </h2>
              <p className="trade-market-desc">
                {selectedMarket.description}
              </p>
              <div className="trade-market-meta">
                <span>Closes {timeLeft}</span>
                <span className="trade-meta-sep" />
                <span>{selectedMarket.participants} traders</span>
                <span className="trade-meta-sep" />
                <span>${vol.toFixed(0)} volume</span>
              </div>
            </div>
          </div>

          {/* Probability Ring */}
          <div className="trade-prob-section">
            <ProbRing yes={pctYes} size={200} />
            <div className="trade-prob-stats">
              <div className="trade-prob-stat yes">
                <div className="trade-prob-stat-val">
                  {pctYes.toFixed(1)}¢
                </div>
                <div className="trade-prob-stat-label">YES Price</div>
                <div className="trade-prob-stat-pool">
                  ${selectedMarket.yesPool.toFixed(0)} pool
                </div>
              </div>
              <div className="trade-prob-stat no">
                <div className="trade-prob-stat-val">
                  {pctNo.toFixed(1)}¢
                </div>
                <div className="trade-prob-stat-label">NO Price</div>
                <div className="trade-prob-stat-pool">
                  ${selectedMarket.noPool.toFixed(0)} pool
                </div>
              </div>
            </div>
          </div>

          {/* Live trades tape */}
          <div className="trade-tape-panel">
            <div className="trade-tape-header">
              <div className="live-badge sm">
                <div className="live-dot" />
                LIVE
              </div>
              <span>Recent Trades</span>
            </div>
            <div className="trade-tape-list">
              {marketTrades.length === 0 && (
                <div className="trade-tape-empty">
                  No recent trades on this market
                </div>
              )}
              {marketTrades.map((t) => (
                <div key={t.id} className="trade-tape-row">
                  <div
                    className="trade-tape-avatar"
                    style={{
                      background: t.color,
                    }}
                  >
                    {t.avatar}
                  </div>
                  <div className="trade-tape-info">
                    <span className="trade-tape-user">
                      @{t.username}
                    </span>
                    <span
                      className={`trade-tape-side ${t.side.toLowerCase()}`}
                    >
                      {t.side}
                    </span>
                  </div>
                  <div className="trade-tape-amt">
                    ${t.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Positions */}
          {myPositions.length > 0 && (
            <div className="trade-positions-panel">
              <h3>Your Positions</h3>
              <div className="trade-positions-list">
                {myPositions.slice(0, 6).map((p) => {
                  const m = markets.find((mk) => mk.id === p.marketId);
                  if (!m) return null;
                  const mB = Math.max(
                    20,
                    (m.yesPool + m.noPool) * 0.15
                  );
                  const markPrice = LMSR.price(
                    mB,
                    m.yesPool,
                    m.noPool,
                    p.side
                  );
                  const markValue = p.amount * markPrice;
                  const pnl = markValue - p.amount;
                  return (
                    <div
                      key={p.id}
                      className="trade-position-row"
                      onClick={() => router.push(`/market/${m.id}`)}
                    >
                      <div className="trade-position-main">
                        <div className="trade-position-q">
                          {m.question.length > 45
                            ? m.question.slice(0, 45) + "..."
                            : m.question}
                        </div>
                        <div className="trade-position-meta">
                          <span
                            className={`trade-position-side ${p.side.toLowerCase()}`}
                          >
                            {p.side}
                          </span>
                          <span>
                            ${p.amount.toFixed(2)} staked
                          </span>
                        </div>
                      </div>
                      <div className="trade-position-value">
                        <div className="trade-position-mark">
                          ${markValue.toFixed(2)}
                        </div>
                        <div
                          className={`trade-position-pnl ${
                            pnl >= 0 ? "up" : "down"
                          }`}
                        >
                          {pnl >= 0 ? "+" : ""}
                          {pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Trading Panel ═══ */}
        <div className="trade-panel-sticky">
          <div className="trade-panel">
            {/* Solana Program Badge */}
            <div className="trade-panel-program">
              <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="14" fill="url(#solGradP)" />
                <defs>
                  <linearGradient
                    id="solGradP"
                    x1="0"
                    y1="0"
                    x2="28"
                    y2="28"
                  >
                    <stop offset="0%" stopColor="#14F195" />
                    <stop offset="100%" stopColor="#9945FF" />
                  </linearGradient>
                </defs>
                <path
                  d="M8 17.5h8.5l3.5-3H11.5L8 17.5z"
                  fill="#fff"
                />
                <path
                  d="M8 10.5h8.5l3.5 3H11.5L8 10.5z"
                  fill="#fff"
                />
                <path
                  d="M8 14h12"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="mono" style={{ fontSize: "0.7rem" }}>
                better_protocol
              </span>
              <span className="trade-panel-network">devnet</span>
            </div>

            {/* Active strategy banner */}
            {activeStrategy && (
              <div className="strat-active-banner">
                <span className="strat-active-icon">
                  {strategies.find((s) => s.id === activeStrategy)?.icon}
                </span>
                <div className="strat-active-info">
                  <strong>{strategies.find((s) => s.id === activeStrategy)?.name}</strong>
                  <span>Strategy applied — adjust below if needed</span>
                </div>
                <button
                  className="strat-active-clear"
                  onClick={() => setActiveStrategy(null)}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Side selector */}
            <div className="trade-side-selector">
              <button
                className={`trade-side-btn yes ${
                  side === "YES" ? "active" : ""
                }`}
                onClick={() => setSide("YES")}
              >
                <span className="trade-side-label">YES</span>
                <span className="trade-side-price">
                  {pctYes.toFixed(1)}¢
                </span>
              </button>
              <button
                className={`trade-side-btn no ${
                  side === "NO" ? "active" : ""
                }`}
                onClick={() => setSide("NO")}
              >
                <span className="trade-side-label">NO</span>
                <span className="trade-side-price">
                  {pctNo.toFixed(1)}¢
                </span>
              </button>
            </div>

            {/* Amount */}
            <div className="trade-amount-section">
              <label className="trade-input-label">Amount (USDC)</label>
              <div className="trade-amount-input-wrap">
                <span className="trade-amount-prefix">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={spendStr}
                  onChange={(e) => setSpendStr(e.target.value)}
                  className="trade-amount-input"
                  placeholder="0.00"
                />
              </div>
              <div className="trade-quick-chips">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    className={`trade-quick-chip ${
                      spend === v ? "active" : ""
                    }`}
                    onClick={() => setSpendStr(String(v))}
                  >
                    ${v}
                  </button>
                ))}
                <button
                  className="trade-quick-chip max"
                  onClick={() =>
                    setSpendStr(Math.floor(balanceUsdc).toString())
                  }
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Quote */}
            {quote && !simulating && !showSuccess && (
              <div className="trade-quote">
                <div className="trade-quote-row highlight">
                  <span>Potential Payout</span>
                  <span className="trade-quote-payout">
                    ${quote.potentialPayout.toFixed(2)}
                  </span>
                </div>
                {quote.charityDonation > 0 && (
                  <div className="trade-charity-split">
                    <div className="trade-charity-row you">
                      <span>Your Profit (50%)</span>
                      <span className="num">${quote.yourProfit.toFixed(2)}</span>
                    </div>
                    <div className="trade-charity-row charity">
                      <span>🌱 Charity Donation (50%)</span>
                      <span className="num">${quote.charityDonation.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="trade-quote-row">
                  <span>Shares</span>
                  <span className="num">
                    {quote.shares.toFixed(2)}
                  </span>
                </div>
                <div className="trade-quote-row">
                  <span>Avg Price</span>
                  <span className="num">
                    {(quote.avgPrice * 100).toFixed(2)}¢
                  </span>
                </div>
                <div className="trade-quote-row">
                  <span>Price Impact</span>
                  <span
                    className={`num ${
                      quote.impact > 5 ? "accent" : ""
                    }`}
                  >
                    {quote.impact.toFixed(2)}%
                  </span>
                </div>
                <div className="trade-quote-row">
                  <span>LP Fee</span>
                  <span className="num">
                    ${quote.lpFee.toFixed(4)}
                  </span>
                </div>

                {/* Price impact bar */}
                <div className="trade-impact-bar">
                  <div
                    className="trade-impact-fill"
                    style={{
                      width: `${Math.min(100, quote.impact * 10)}%`,
                    }}
                  />
                </div>

                {/* Slippage */}
                <div className="trade-slippage">
                  <span>Slippage: {slippage}%</span>
                  <div className="trade-slippage-chips">
                    {[0.5, 1, 2, 5].map((v) => (
                      <button
                        key={v}
                        className={`trade-slip-chip ${
                          slippage === v ? "active" : ""
                        }`}
                        onClick={() => setSlippage(v)}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Simulator */}
            <SolanaSimulator
              active={simulating}
              side={side}
              amount={spend}
              onDone={handleSimDone}
            />

            {/* Success */}
            {showSuccess && (
              <div className="trade-success">
                <div className="trade-success-icon">&#x2713;</div>
                <div className="trade-success-text">
                  Trade Confirmed on Solana
                </div>
                <div className="trade-success-detail">
                  Bought {side} shares for ${spend.toFixed(2)} USDC
                </div>
                <div className="trade-charity-badge">
                  🌱 50% of profits go to charity if you win
                </div>
              </div>
            )}

            {/* Error */}
            {betError && (
              <div className="trade-error">
                {betError}
              </div>
            )}

            {/* Trade button */}
            {!simulating && !showSuccess && (
              <button
                className={`trade-submit-btn ${side.toLowerCase()}`}
                disabled={!quote || spend > balanceUsdc || spend <= 0}
                onClick={handleTrade}
              >
                {spend > balanceUsdc ? (
                  "Insufficient USDC Balance"
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 28 28"
                      fill="none"
                    >
                      <circle
                        cx="14"
                        cy="14"
                        r="14"
                        fill="rgba(255,255,255,0.2)"
                      />
                      <path
                        d="M8 17.5h8.5l3.5-3H11.5L8 17.5z"
                        fill="#fff"
                      />
                      <path
                        d="M8 10.5h8.5l3.5 3H11.5L8 10.5z"
                        fill="#fff"
                      />
                      <path
                        d="M8 14h12"
                        stroke="#fff"
                        strokeWidth="1.5"
                      />
                    </svg>
                    Buy {side} — ${spend.toFixed(2)} USDC
                  </>
                )}
              </button>
            )}

            {/* Solana instruction preview (collapsed) */}
            <details className="trade-ix-details">
              <summary>View Solana Instruction</summary>
              <div className="trade-ix-content">
                <div className="trade-ix-row">
                  <span>Program</span>
                  <span className="mono">ELThikt...ZyoD</span>
                </div>
                <div className="trade-ix-row">
                  <span>Instruction</span>
                  <span className="mono">swap_shares</span>
                </div>
                <div className="trade-ix-row">
                  <span>Side</span>
                  <span className="mono">
                    {side === "YES" ? "1" : "0"}
                  </span>
                </div>
                <div className="trade-ix-row">
                  <span>Amount</span>
                  <span className="mono">
                    {Math.floor(spend * 1e6)}
                  </span>
                </div>
                <div className="trade-ix-row">
                  <span>Min Shares</span>
                  <span className="mono">
                    {quote
                      ? Math.floor(quote.minShares * 1e6)
                      : 0}
                  </span>
                </div>
                <div className="trade-ix-accounts">
                  <div className="trade-ix-account">
                    amm_pool{" "}
                    <span className="faint">
                      PDA("amm_pool", market)
                    </span>
                  </div>
                  <div className="trade-ix-account">
                    share_mint{" "}
                    <span className="faint">
                      PDA("share_mint", market, "{side}")
                    </span>
                  </div>
                  <div className="trade-ix-account">
                    user_share_ata{" "}
                    <span className="faint">
                      ATA(wallet, share_mint)
                    </span>
                  </div>
                  <div className="trade-ix-account">
                    pool_usdc_vault{" "}
                    <span className="faint">
                      PDA("vault", amm_pool)
                    </span>
                  </div>
                </div>
              </div>
            </details>

            <div className="trade-sandbox-notice">
              <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="14" fill="url(#solGradN)" />
                <defs>
                  <linearGradient
                    id="solGradN"
                    x1="0"
                    y1="0"
                    x2="28"
                    y2="28"
                  >
                    <stop offset="0%" stopColor="#14F195" />
                    <stop offset="100%" stopColor="#9945FF" />
                  </linearGradient>
                </defs>
                <path
                  d="M8 17.5h8.5l3.5-3H11.5L8 17.5z"
                  fill="#fff"
                />
                <path
                  d="M8 10.5h8.5l3.5 3H11.5L8 10.5z"
                  fill="#fff"
                />
                <path
                  d="M8 14h12"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              </svg>
              Devnet sandbox · 50% of winning profits donated to charity
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
