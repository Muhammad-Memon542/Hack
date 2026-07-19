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

const LMSR = {
  cost(b: number, qYes: number, qNo: number): number {
    const maxQ = Math.max(qYes, qNo);
    return b * (maxQ + Math.log(Math.exp((qYes - maxQ) / 1) + Math.exp((qNo - maxQ) / 1)));
  },
  price(b: number, qYes: number, qNo: number, side: "YES" | "NO"): number {
    const expY = Math.exp(qYes / b);
    const expN = Math.exp(qNo / b);
    return side === "YES" ? expY / (expY + expN) : expN / (expY + expN);
  },
  costForShares(b: number, qYes: number, qNo: number, side: "YES" | "NO", shares: number): number {
    const c0 = LMSR.cost(b, qYes, qNo);
    const newYes = side === "YES" ? qYes + shares : qYes;
    const newNo = side === "NO" ? qNo + shares : qNo;
    return LMSR.cost(b, newYes, newNo) - c0;
  },
  sharesToBuy(b: number, qYes: number, qNo: number, side: "YES" | "NO", spend: number): number {
    let lo = 0, hi = spend / 0.001;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (LMSR.costForShares(b, qYes, qNo, side, mid) < spend) lo = mid;
      else hi = mid;
    }
    return lo;
  },
};

// ── Probability ring (compact, light theme) ──
function ProbRing({ yes, size = 80 }: { yes: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const yesLen = circ * (yes / 100);
  const noLen = circ - yesLen;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#16a34a" strokeWidth="6"
        strokeDasharray={`${yesLen} ${noLen}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central"
        fill="#111" fontSize="18" fontWeight="800">{yes.toFixed(1)}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="central"
        fill="#6b7280" fontSize="9" fontWeight="700">YES</text>
    </svg>
  );
}

// ── Market depth chart (SVG) ──
function DepthChart({ b, qYes, qNo }: { b: number; qYes: number; qNo: number }) {
  const W = 320, H = 160, PAD = 32;
  const points = 50;
  const maxSpend = 100;
  const yesLine: [number, number][] = [];
  const noLine: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const spend = (i / points) * maxSpend;
    const x = PAD + ((W - PAD * 2) * i) / points;
    const sharesY = spend > 0 ? LMSR.sharesToBuy(b, qYes, qNo, "YES", spend) : 0;
    const sharesN = spend > 0 ? LMSR.sharesToBuy(b, qYes, qNo, "NO", spend) : 0;
    const newYes = qYes + sharesY;
    const newNo = qNo + sharesN;
    const pY = LMSR.price(b, newYes, qNo, "YES") * 100;
    const pN = LMSR.price(b, qYes, newNo, "NO") * 100;
    const yPY = H - PAD - ((pY / 100) * (H - PAD * 2));
    const yPN = H - PAD - ((pN / 100) * (H - PAD * 2));
    yesLine.push([x, yPY]);
    noLine.push([x, yPN]);
  }

  const toPath = (pts: [number, number][]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  const curPY = LMSR.price(b, qYes, qNo, "YES") * 100;
  const curY = H - PAD - ((curPY / 100) * (H - PAD * 2));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="td-depth-svg">
      {[0, 25, 50, 75, 100].map((v) => {
        const y = H - PAD - ((v / 100) * (H - PAD * 2));
        return (
          <g key={v}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={PAD - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{v}%</text>
          </g>
        );
      })}
      {[0, 25, 50, 75, 100].map((v, i) => {
        const x = PAD + ((W - PAD * 2) * i) / 4;
        return (
          <text key={v} x={x} y={H - PAD + 14} textAnchor="middle" fontSize="8" fill="#9ca3af">
            ${v}
          </text>
        );
      })}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="#9ca3af">Spend (USDC)</text>
      <line x1={PAD} y1={curY} x2={W - PAD} y2={curY}
        stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.5" />
      <path d={toPath(yesLine)} fill="none" stroke="#16a34a" strokeWidth="1.5" />
      <path d={toPath(noLine)} fill="none" stroke="#ef4444" strokeWidth="1.5" />
      <rect x={PAD + 8} y={8} width="50" height="14" rx="3" fill="white" />
      <circle cx={PAD + 14} cy={15} r={3} fill="#16a34a" />
      <text x={PAD + 20} y={18} fontSize="8" fill="#374151">YES</text>
      <circle cx={PAD + 44} cy={15} r={3} fill="#ef4444" />
      <text x={PAD + 50} y={18} fontSize="8" fill="#374151">NO</text>
    </svg>
  );
}

// ── Options pricing (Black-Scholes–style for binary options) ──
type OptionLeg = { type: "Call" | "Put"; strike: number; qty: number; premium: number };
type StrategyDef = {
  id: string; name: string; sentiment: string; sentimentColor: string;
  desc: string; legs: (prob: number) => OptionLeg[];
};

function binaryPrice(prob: number, strike: number, type: "Call" | "Put", iv: number, dte: number): number {
  const t = dte / 365;
  const drift = iv * Math.sqrt(t) * 0.5;
  if (type === "Call") {
    const d = (prob - strike) / (iv * Math.sqrt(t) + 0.001);
    const nd = 0.5 * (1 + Math.tanh(d * 0.7071));
    return Math.max(0.001, Math.min(0.999, nd)) * Math.exp(-0.02 * t);
  }
  const d = (strike - prob) / (iv * Math.sqrt(t) + 0.001);
  const nd = 0.5 * (1 + Math.tanh(d * 0.7071));
  return Math.max(0.001, Math.min(0.999, nd)) * Math.exp(-0.02 * t);
}

const STRATEGIES: StrategyDef[] = [
  {
    id: "custom", name: "Custom", sentiment: "NEUTRAL", sentimentColor: "#111",
    desc: "Build your own multi-leg strategy",
    legs: (p) => [{ type: "Call", strike: Math.round(p * 100) / 100, qty: 1, premium: 0 }],
  },
  {
    id: "bull-call", name: "Bull Call Spread", sentiment: "BULLISH", sentimentColor: "#16a34a",
    desc: "Profit if probability rises. Capped risk and reward.",
    legs: (p) => [
      { type: "Call", strike: Math.max(0.05, p - 0.10), qty: 1, premium: 0 },
      { type: "Call", strike: Math.min(0.95, p + 0.10), qty: -1, premium: 0 },
    ],
  },
  {
    id: "bear-put", name: "Bear Put Spread", sentiment: "BEARISH", sentimentColor: "#ef4444",
    desc: "Profit if probability falls. Capped risk and reward.",
    legs: (p) => [
      { type: "Put", strike: Math.min(0.95, p + 0.10), qty: 1, premium: 0 },
      { type: "Put", strike: Math.max(0.05, p - 0.10), qty: -1, premium: 0 },
    ],
  },
  {
    id: "straddle", name: "Straddle", sentiment: "VOLATILE", sentimentColor: "#d97706",
    desc: "Profit from big moves in either direction.",
    legs: (p) => [
      { type: "Call", strike: p, qty: 1, premium: 0 },
      { type: "Put", strike: p, qty: 1, premium: 0 },
    ],
  },
  {
    id: "strangle", name: "Strangle", sentiment: "VOLATILE", sentimentColor: "#d97706",
    desc: "Cheaper volatility bet with wider breakevens.",
    legs: (p) => [
      { type: "Call", strike: Math.min(0.95, p + 0.10), qty: 1, premium: 0 },
      { type: "Put", strike: Math.max(0.05, p - 0.10), qty: 1, premium: 0 },
    ],
  },
];

// ── Payoff chart SVG ──
function PayoffChart({ legs, prob }: { legs: OptionLeg[]; prob: number }) {
  const W = 400, H = 200, PAD = 24;
  const pts: [number, number][] = [];
  const netPremium = legs.reduce((s, l) => s + l.premium * l.qty, 0);

  for (let i = 0; i <= 100; i++) {
    const outcome = i / 100;
    let pnl = -netPremium;
    for (const leg of legs) {
      const intrinsic = leg.type === "Call"
        ? Math.max(0, outcome > leg.strike ? 1 : 0)
        : Math.max(0, outcome < leg.strike ? 1 : 0);
      pnl += (intrinsic - leg.premium) * leg.qty;
    }
    pts.push([i / 100, pnl]);
  }

  const minPnl = Math.min(...pts.map((p) => p[1]));
  const maxPnl = Math.max(...pts.map((p) => p[1]));
  const range = Math.max(maxPnl - minPnl, 0.01);

  const toX = (v: number) => PAD + v * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((v - minPnl) / range) * (H - PAD * 2);

  const zeroY = toY(0);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`).join(" ");

  const profitFill = pts.map((p, i) => {
    if (p[1] >= 0) return `${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`;
    return `${toX(p[0]).toFixed(1)},${zeroY.toFixed(1)}`;
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="td-payoff-svg">
      <defs>
        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {zeroY >= PAD && zeroY <= H - PAD && (
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="4,3" />
      )}
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={Math.max(0, zeroY - PAD)} fill="url(#profitGrad)" />
      <rect x={PAD} y={zeroY} width={W - PAD * 2} height={Math.max(0, H - PAD - zeroY)} fill="url(#lossGrad)" />
      <line x1={toX(prob)} y1={PAD} x2={toX(prob)} y2={H - PAD}
        stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" />
      <text x={toX(prob)} y={H - PAD + 12} textAnchor="middle" fontSize="8" fill="#6366f1" fontWeight="700">
        {(prob * 100).toFixed(0)}%
      </text>
      <path d={path} fill="none" stroke="#ef4444" strokeWidth="2" />
      <text x={PAD} y={H - 2} fontSize="8" fill="#9ca3af">0%</text>
      <text x={W - PAD} y={H - 2} textAnchor="end" fontSize="8" fill="#9ca3af">100%</text>
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="#9ca3af">Outcome Probability at Expiry</text>
      <text x={2} y={PAD + 4} fontSize="7" fill="#9ca3af">P/L</text>
    </svg>
  );
}

// ── Solana TX Simulator ──
function SolanaSimulator({ active, side, amount, onDone }: {
  active: boolean; side: Side; amount: number; onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const steps = [
    "Building transaction...", "Deriving PDAs...", "Serializing Borsh args...",
    "Signing with wallet...", "Sending to Solana devnet...",
    "Awaiting confirmation...", "Confirmed! 1 block.",
  ];
  useEffect(() => {
    if (!active) { setStep(0); return; }
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i >= steps.length) { clearInterval(timer); setTimeout(onDone, 600); setStep(steps.length - 1); }
      else setStep(i);
    }, 400);
    return () => clearInterval(timer);
  }, [active]);
  if (!active) return null;
  return (
    <div className="td-sim">
      <div className="td-sim-header">Solana Transaction</div>
      <div className="td-sim-steps">
        {steps.map((s, i) => (
          <div key={i} className={`td-sim-step ${i < step ? "done" : i === step ? "active" : ""}`}>
            <span className="td-sim-dot">
              {i < step ? "" : i === step ? "" : ""}
            </span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TradePage() {
  const router = useRouter();
  const { connected, markets, positions, balanceUsdc, placeBet, liveBets } = useApp();

  const openMarkets = useMemo(() => markets.filter((m) => m.status === "OPEN"), [markets]);
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const selectedMarket = useMemo(
    () => openMarkets.find((m) => m.id === selectedMarketId) ?? openMarkets[0],
    [openMarkets, selectedMarketId]
  );

  useEffect(() => {
    if (!selectedMarketId && openMarkets.length > 0) setSelectedMarketId(openMarkets[0].id);
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

  // Tab state
  const [tab, setTab] = useState<"order" | "positions" | "options">("order");

  // Order state
  const [side, setSide] = useState<Side>("YES");
  const [spendStr, setSpendStr] = useState("10");
  const [slippage, setSlippage] = useState(2);
  const [simulating, setSimulating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const spend = parseFloat(spendStr) || 0;
  const QUICK_AMOUNTS = [5, 10, 25, 50, 100];

  // Options state
  const [selectedStrategy, setSelectedStrategy] = useState("custom");
  const [ivPct, setIvPct] = useState(80);
  const [showGreeks, setShowGreeks] = useState(false);
  const [optionLegs, setOptionLegs] = useState<OptionLeg[]>([]);

  const spotYes = selectedMarket ? LMSR.price(b, qYes, qNo, "YES") : 0.5;
  const spotNo = selectedMarket ? LMSR.price(b, qYes, qNo, "NO") : 0.5;
  const pctYes = spotYes * 100;
  const pctNo = spotNo * 100;

  // Initialize option legs when strategy/market changes
  useEffect(() => {
    const strat = STRATEGIES.find((s) => s.id === selectedStrategy) ?? STRATEGIES[0];
    const dte = selectedMarket
      ? Math.max(1, Math.ceil((new Date(selectedMarket.closesAt).getTime() - Date.now()) / 86400000))
      : 7;
    const legs = strat.legs(spotYes).map((l) => ({
      ...l,
      premium: Math.abs(binaryPrice(spotYes, l.strike, l.type, ivPct / 100, dte)),
    }));
    setOptionLegs(legs);
  }, [selectedStrategy, selectedMarket, spotYes, ivPct]);

  const daysToExpiry = selectedMarket
    ? Math.max(0, Math.ceil((new Date(selectedMarket.closesAt).getTime() - Date.now()) / 86400000))
    : 0;

  const quote = useMemo(() => {
    if (spend <= 0 || !selectedMarket) return null;
    const spotBefore = LMSR.price(b, qYes, qNo, side);
    const contracts = spend / spotBefore;
    const rawShares = LMSR.sharesToBuy(b, qYes, qNo, side, spend);
    if (rawShares <= 0) return null;
    const newYes = side === "YES" ? qYes + rawShares : qYes;
    const newNo = side === "NO" ? qNo + rawShares : qNo;
    const spotAfter = LMSR.price(b, newYes, newNo, side);
    const impact = (Math.abs(spotAfter - spotBefore) / spotBefore) * 100;
    const newProbYes = LMSR.price(b, newYes, newNo, "YES") * 100;
    const lpFee = spend * 0.003;
    const potentialPayout = contracts * 1;
    const potentialProfit = potentialPayout - spend;
    return { shares: contracts, spotBefore, spotAfter, impact, newProbYes, lpFee, potentialPayout, potentialProfit };
  }, [spend, b, qYes, qNo, side, selectedMarket]);

  const myPositions = useMemo(
    () => positions.filter((p) => p.userId === CURRENT_USER_ID && markets.some((m) => m.id === p.marketId && m.status !== "SETTLED")),
    [positions, markets]
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
    if (result.ok) { setShowSuccess(true); setTimeout(() => setShowSuccess(false), 3000); }
    else setBetError(result.error ?? "Transaction failed");
  }, [selectedMarket, side, spend, placeBet]);

  // Options helpers
  const netPremium = optionLegs.reduce((s, l) => s + l.premium * l.qty, 0);
  const optionPayoff = useMemo(() => {
    let maxProfit = -Infinity, maxLoss = Infinity, breakeven = 0.5;
    for (let i = 0; i <= 100; i++) {
      const outcome = i / 100;
      let pnl = 0;
      for (const leg of optionLegs) {
        const intrinsic = leg.type === "Call" ? (outcome > leg.strike ? 1 : 0) : (outcome < leg.strike ? 1 : 0);
        pnl += (intrinsic - leg.premium) * leg.qty;
      }
      if (pnl > maxProfit) maxProfit = pnl;
      if (pnl < maxLoss) maxLoss = pnl;
      if (i > 0) {
        const prevOutcome = (i - 1) / 100;
        let prevPnl = 0;
        for (const leg of optionLegs) {
          const intrinsic = leg.type === "Call" ? (prevOutcome > leg.strike ? 1 : 0) : (prevOutcome < leg.strike ? 1 : 0);
          prevPnl += (intrinsic - leg.premium) * leg.qty;
        }
        if ((prevPnl < 0 && pnl >= 0) || (prevPnl >= 0 && pnl < 0)) breakeven = outcome;
      }
    }
    return { maxProfit, maxLoss, breakeven };
  }, [optionLegs]);

  if (!connected) {
    return (
      <div className="td-shell">
        <div className="td-header">
          <div>
            <h1 className="td-title">Trade</h1>
            <p className="td-subtitle">Solana Prediction Markets Devnet</p>
          </div>
          <button className="td-connect-btn" onClick={() => router.push("/login")}>Connect Phantom</button>
        </div>
        <div className="td-empty">
          <p>Connect your wallet to start trading prediction markets on Solana.</p>
        </div>
      </div>
    );
  }

  if (!selectedMarket) {
    return (
      <div className="td-shell">
        <div className="td-header">
          <div><h1 className="td-title">Trade</h1><p className="td-subtitle">Solana Prediction Markets Devnet</p></div>
        </div>
        <div className="td-empty"><p>No open markets available for trading right now.</p></div>
      </div>
    );
  }

  const vol = volume(selectedMarket);
  const timeLeft = relativeTime(selectedMarket.closesAt);

  return (
    <div className="td-shell">
      {/* Header */}
      <div className="td-header">
        <div>
          <h1 className="td-title">Trade</h1>
          <p className="td-subtitle">Solana Prediction Markets Devnet</p>
        </div>
        <button className="td-connect-btn" onClick={() => router.push("/login")}>Connect Phantom</button>
      </div>

      {/* Market selector */}
      <div className="td-market-select-row">
        <select
          className="td-market-select"
          value={selectedMarketId}
          onChange={(e) => setSelectedMarketId(e.target.value)}
        >
          {openMarkets.map((m) => (
            <option key={m.id} value={m.id}>{m.question}</option>
          ))}
        </select>
        <ProbRing yes={pctYes} size={72} />
      </div>

      <div className="td-market-badges">
        <span className="td-badge-open">OPEN</span>
        <span className="td-badge-meta">{daysToExpiry}d remaining</span>
        <span className="td-badge-meta"></span>
        <span className="td-badge-meta">${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })} volume</span>
      </div>

      {/* Tabs */}
      <div className="td-tabs">
        <button className={`td-tab ${tab === "order" ? "active" : ""}`} onClick={() => setTab("order")}>Order</button>
        <button className={`td-tab ${tab === "positions" ? "active" : ""}`} onClick={() => setTab("positions")}>
          Positions {myPositions.length > 0 && <span className="td-tab-badge">{myPositions.length}</span>}
        </button>
        <button className={`td-tab ${tab === "options" ? "active" : ""}`} onClick={() => setTab("options")}>Options Desk</button>
      </div>

      {/* ═══ ORDER TAB ═══ */}
      {tab === "order" && (
        <div className="td-order-grid">
          {/* Left: Place Order */}
          <div className="td-card">
            <h2 className="td-card-title">Place Order</h2>

            <div className="td-sides">
              <button className={`td-side-box ${side === "YES" ? "active-yes" : ""}`} onClick={() => setSide("YES")}>
                <div className="td-side-label yes">YES</div>
                <div className="td-side-pct">{pctYes.toFixed(1)}%</div>
                <div className="td-side-sub">Pays $1 if YES</div>
              </button>
              <button className={`td-side-box ${side === "NO" ? "active-no" : ""}`} onClick={() => setSide("NO")}>
                <div className="td-side-label no">NO</div>
                <div className="td-side-pct">{pctNo.toFixed(1)}%</div>
                <div className="td-side-sub">Pays $1 if NO</div>
              </button>
            </div>

            <div className="td-amount-row">
              <span className="td-field-label">Amount (USDC)</span>
              <span className="td-field-label" style={{ textAlign: "right" }}>Balance: ${balanceUsdc.toFixed(2)}</span>
            </div>
            <input
              type="number" min="0.01" step="0.01"
              value={spendStr} onChange={(e) => setSpendStr(e.target.value)}
              className="td-amount-input" placeholder="0.00"
            />
            <div className="td-quick-row">
              {QUICK_AMOUNTS.map((v) => (
                <button key={v} className={`td-quick-btn ${spend === v ? "active" : ""}`} onClick={() => setSpendStr(String(v))}>
                  ${v}
                </button>
              ))}
            </div>

            {quote && !simulating && !showSuccess && (
              <div className="td-quote-box">
                <div className="td-quote-line highlight">
                  <span>Potential payout</span>
                  <span className="td-green">${quote.potentialPayout.toFixed(2)}</span>
                </div>
                <div className="td-quote-line highlight">
                  <span>Potential profit</span>
                  <span className={quote.potentialProfit >= 0 ? "td-green" : "td-red"}>
                    {quote.potentialProfit >= 0 ? "+" : ""}${quote.potentialProfit.toFixed(2)}
                  </span>
                </div>
                <div className="td-quote-sep" />
                <div className="td-quote-line"><span>Outcome tokens</span><span>{quote.shares.toFixed(2)}</span></div>
                <div className="td-quote-line"><span>Avg entry probability</span><span>{(quote.spotBefore * 100).toFixed(1)}%</span></div>
                <div className="td-quote-line"><span>Probability after trade</span><span>{quote.newProbYes.toFixed(1)}%</span></div>
                <div className="td-quote-line"><span>Price impact</span><span>{quote.impact.toFixed(2)}%</span></div>
                <div className="td-quote-line"><span>Protocol fee</span><span>${quote.lpFee.toFixed(4)}</span></div>
              </div>
            )}

            <SolanaSimulator active={simulating} side={side} amount={spend} onDone={handleSimDone} />

            {showSuccess && (
              <div className="td-success">
                <span>Trade confirmed on Solana! Bought {side} shares for ${spend.toFixed(2)} USDC</span>
              </div>
            )}
            {betError && <div className="td-error">{betError}</div>}

            <div className="td-slip-row">
              <span>Slippage tolerance: {slippage}%</span>
            </div>
            <div className="td-slip-bar">
              <div className="td-slip-fill" style={{ width: `${(slippage / 10) * 100}%` }} />
              <input
                type="range" min="0.5" max="10" step="0.5"
                value={slippage} onChange={(e) => setSlippage(parseFloat(e.target.value))}
                className="td-slip-range"
              />
            </div>

            {!simulating && !showSuccess && (
              <button
                className={`td-trade-btn ${side.toLowerCase()}`}
                disabled={!quote || spend > balanceUsdc || spend <= 0}
                onClick={handleTrade}
              >
                Buy {side} ${spend.toFixed(2)}
              </button>
            )}

            <div className="td-solana-badge">
              <strong>Solana Program Devnet</strong>
              <p>All trades settle on-chain via the echo_protocol Anchor program. Tokens are SPL mints derived from market PDAs.</p>
            </div>
          </div>

          {/* Right column */}
          <div className="td-right-col">
            <div className="td-card">
              <h2 className="td-card-title">Market Depth</h2>
              <p className="td-card-sub">How probability shifts as money enters the market</p>
              <DepthChart b={b} qYes={qYes} qNo={qNo} />
            </div>

            <div className="td-card">
              <h2 className="td-card-title">Market Info</h2>
              <div className="td-info-table">
                <div className="td-info-row"><span>YES Pool</span><span>${selectedMarket.yesPool.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="td-info-row"><span>NO Pool</span><span>${selectedMarket.noPool.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="td-info-row"><span>Total Volume</span><span>${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="td-info-row"><span>Participants</span><span>{selectedMarket.participants}</span></div>
                <div className="td-info-row"><span>Closes</span><span>{selectedMarket.closesAt.split("T")[0]}</span></div>
                <div className="td-info-row"><span>Network</span><span>Solana Devnet</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ POSITIONS TAB ═══ */}
      {tab === "positions" && (
        <div className="td-positions">
          {myPositions.length === 0 && (
            <div className="td-empty"><p>You have no open positions. Place a trade to get started.</p></div>
          )}
          {myPositions.map((p) => {
            const m = markets.find((mk) => mk.id === p.marketId);
            if (!m) return null;
            const mB = Math.max(20, (m.yesPool + m.noPool) * 0.15);
            const markPrice = LMSR.price(mB, m.yesPool, m.noPool, p.side);
            const currentProb = LMSR.price(mB, m.yesPool, m.noPool, "YES") * 100;
            const markValue = p.amount * markPrice;
            const pnl = markValue - p.amount;
            const costPct = p.amount > 0 ? (markValue / p.amount) * 100 : 0;
            return (
              <div key={p.id} className="td-position-card" onClick={() => router.push(`/market/${m.id}`)}>
                <div className="td-pos-header">
                  <span className={`td-pos-side ${p.side.toLowerCase()}`}>{p.side}</span>
                  <span className="td-pos-q">{m.question}</span>
                </div>
                <div className="td-pos-stats">
                  <div className="td-pos-stat">
                    <div className="td-pos-stat-val">${p.amount.toFixed(2)}</div>
                    <div className="td-pos-stat-label">COST BASIS</div>
                  </div>
                  <div className="td-pos-stat">
                    <div className="td-pos-stat-val">{currentProb.toFixed(1)}%</div>
                    <div className="td-pos-stat-label">CURRENT PROB.</div>
                  </div>
                  <div className="td-pos-stat">
                    <div className="td-pos-stat-val">${markValue.toFixed(2)}</div>
                    <div className="td-pos-stat-label">MARK VALUE</div>
                  </div>
                  <div className="td-pos-stat">
                    <div className={`td-pos-stat-val ${pnl >= 0 ? "td-green" : "td-red"}`}>
                      ${pnl >= 0 ? "" : ""}{pnl.toFixed(2)}
                    </div>
                    <div className="td-pos-stat-label">P/L</div>
                  </div>
                </div>
                <div className="td-pos-bar">
                  <div className="td-pos-bar-fill green" style={{ width: `${Math.min(100, Math.max(0, costPct))}%` }} />
                  {pnl < 0 && <div className="td-pos-bar-fill red" style={{ width: `${Math.min(100, Math.abs(pnl / p.amount) * 100)}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ OPTIONS DESK TAB ═══ */}
      {tab === "options" && (
        <div className="td-options">
          <div className="td-card">
            <div className="td-opts-header">
              <div>
                <h2 className="td-card-title">Options Desk</h2>
                <p className="td-card-sub">Trade binary options on outcome probabilities</p>
              </div>
              <div className="td-opts-meta">
                <div>Current: {pctYes.toFixed(1)}%</div>
                <div>{daysToExpiry} days to expiry</div>
              </div>
            </div>

            <div className="td-strat-row">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  className={`td-strat-card ${selectedStrategy === s.id ? "active" : ""}`}
                  onClick={() => setSelectedStrategy(s.id)}
                >
                  <div className="td-strat-name">{s.name}</div>
                  <div className="td-strat-desc">{s.desc}</div>
                  <div className="td-strat-tag" style={{ color: s.sentimentColor }}>{s.sentiment}</div>
                </button>
              ))}
            </div>

            <div className="td-iv-row">
              <span>Implied Volatility: {ivPct}%</span>
              <div className="td-slip-bar" style={{ flex: 1, marginLeft: "1rem" }}>
                <div className="td-slip-fill" style={{ width: `${ivPct}%` }} />
                <input type="range" min="10" max="150" step="5" value={ivPct}
                  onChange={(e) => setIvPct(parseInt(e.target.value))}
                  className="td-slip-range" />
              </div>
            </div>

            <div className="td-legs-section">
              <div className="td-legs-header">
                <h3>Legs</h3>
                <div className="td-legs-actions">
                  <button className="td-leg-add call" onClick={() => setOptionLegs([...optionLegs, { type: "Call", strike: Math.round(spotYes * 100) / 100, qty: 1, premium: binaryPrice(spotYes, spotYes, "Call", ivPct / 100, Math.max(1, daysToExpiry)) }])}>+ Call</button>
                  <button className="td-leg-add put" onClick={() => setOptionLegs([...optionLegs, { type: "Put", strike: Math.round(spotYes * 100) / 100, qty: 1, premium: binaryPrice(spotYes, spotYes, "Put", ivPct / 100, Math.max(1, daysToExpiry)) }])}>+ Put</button>
                  <button className="td-greeks-btn" onClick={() => setShowGreeks(!showGreeks)}>
                    {showGreeks ? "Hide" : "Show"} Greeks
                  </button>
                </div>
              </div>

              <div className="td-legs-table">
                <div className="td-legs-thead">
                  <span>TYPE</span><span>STRIKE</span><span>QTY</span><span>PREMIUM</span><span></span>
                </div>
                {optionLegs.map((leg, i) => (
                  <div key={i} className="td-legs-row">
                    <select value={leg.type} onChange={(e) => {
                      const next = [...optionLegs];
                      next[i] = { ...leg, type: e.target.value as "Call" | "Put", premium: binaryPrice(spotYes, leg.strike, e.target.value as any, ivPct / 100, Math.max(1, daysToExpiry)) };
                      setOptionLegs(next);
                    }} className="td-leg-sel">
                      <option>Call</option><option>Put</option>
                    </select>
                    <input type="number" step="0.01" min="0.01" max="0.99" value={leg.strike}
                      onChange={(e) => {
                        const next = [...optionLegs];
                        const s = parseFloat(e.target.value) || 0.5;
                        next[i] = { ...leg, strike: s, premium: binaryPrice(spotYes, s, leg.type, ivPct / 100, Math.max(1, daysToExpiry)) };
                        setOptionLegs(next);
                      }} className="td-leg-input" />
                    <input type="number" step="1" min="-10" max="10" value={leg.qty}
                      onChange={(e) => {
                        const next = [...optionLegs];
                        next[i] = { ...leg, qty: parseInt(e.target.value) || 1 };
                        setOptionLegs(next);
                      }} className="td-leg-input" />
                    <span className="td-leg-prem">${leg.premium.toFixed(4)}</span>
                    <button className="td-leg-rm" onClick={() => setOptionLegs(optionLegs.filter((_, j) => j !== i))}>&times;</button>
                  </div>
                ))}
              </div>

              <div className="td-net-row">
                <span>Net</span>
                <span className={netPremium >= 0 ? "td-red" : "td-green"}>${netPremium.toFixed(4)}</span>
              </div>
            </div>

            <div className="td-payoff-section">
              <h3>Payoff at Expiry</h3>
              <div className="td-payoff-stats">
                <span>Max Profit <b className="td-green">${optionPayoff.maxProfit.toFixed(4)}</b></span>
                <span>Max Loss <b className="td-red">${optionPayoff.maxLoss.toFixed(4)}</b></span>
                <span>Breakeven <b>{(optionPayoff.breakeven * 100).toFixed(1)}%</b></span>
                <span>Net Premium <b className={netPremium >= 0 ? "td-red" : "td-green"}>${netPremium.toFixed(4)}</b></span>
              </div>
              <PayoffChart legs={optionLegs} prob={spotYes} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
