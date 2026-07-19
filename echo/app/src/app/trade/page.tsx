"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useApp } from "@/app/providers";
import { useRouter } from "next/navigation";
import { CURRENT_USER_ID, type Market, type Side } from "@/lib/mock";

// ══════════════════════════════════════════════════════════════════════
// LMSR Engine
// ══════════════════════════════════════════════════════════════════════
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
      const cost = LMSR.costForShares(b, qYes, qNo, side, mid);
      if (cost < spend) lo = mid; else hi = mid;
    }
    return lo;
  },
  depthLadder(b: number, qYes: number, qNo: number, levels: number = 5): { size: number; bidYes: number; askYes: number; bidNo: number; askNo: number }[] {
    const ladder: { size: number; bidYes: number; askYes: number; bidNo: number; askNo: number }[] = [];
    // Use $ spend amounts as "size" and show effective price per contract
    const spendLevels = [5, 10, 25, 50, 100];
    for (let i = 0; i < Math.min(levels, spendLevels.length); i++) {
      const spend = spendLevels[i];
      const sharesYes = LMSR.sharesToBuy(b, qYes, qNo, "YES", spend);
      const sharesNo = LMSR.sharesToBuy(b, qYes, qNo, "NO", spend);
      const pYes = LMSR.price(b, qYes, qNo, "YES");
      const pNo = LMSR.price(b, qYes, qNo, "NO");
      // After buying: new price is the effective ask
      const newYesY = qYes + sharesYes, newNoY = qNo;
      const newYesN = qYes, newNoN = qNo + sharesNo;
      const askYes = LMSR.price(b, newYesY, newNoY, "YES");
      const askNo = LMSR.price(b, newYesN, newNoN, "NO");
      ladder.push({
        size: spend,
        bidYes: pYes,
        askYes,
        bidNo: pNo,
        askNo,
      });
    }
    return ladder;
  },
};

// ══════════════════════════════════════════════════════════════════════
// Black-Scholes for binary options on shares priced [0, 1]
// ══════════════════════════════════════════════════════════════════════
function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

interface Greeks { delta: number; gamma: number; theta: number; vega: number; rho: number; price: number }

function blackScholes(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean): Greeks {
  if (T <= 0.0001) {
    const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
    return { delta: isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0, price: intrinsic };
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const nd1 = normCDF(d1), nd2 = normCDF(d2), nnd1 = normCDF(-d1), nnd2 = normCDF(-d2);
  const pdf1 = normPDF(d1);
  const disc = Math.exp(-r * T);

  if (isCall) {
    return {
      price: S * nd1 - K * disc * nd2,
      delta: nd1,
      gamma: pdf1 / (S * sigma * Math.sqrt(T)),
      theta: -(S * pdf1 * sigma) / (2 * Math.sqrt(T)) - r * K * disc * nd2,
      vega: S * pdf1 * Math.sqrt(T),
      rho: K * T * disc * nd2,
    };
  }
  return {
    price: K * disc * nnd2 - S * nnd1,
    delta: -nnd1,
    gamma: pdf1 / (S * sigma * Math.sqrt(T)),
    theta: -(S * pdf1 * sigma) / (2 * Math.sqrt(T)) + r * K * disc * nnd2,
    vega: S * pdf1 * Math.sqrt(T),
    rho: -K * T * disc * nnd2,
  };
}

// ── Leg & Strategy types ──
interface OptionLeg {
  id: string;
  type: "call" | "put";
  strike: number;
  qty: number; // +buy, -sell
  premium: number;
  greeks: Greeks;
}

type StrategyPreset = "custom" | "bull_spread" | "bear_spread" | "straddle" | "strangle";

const STRATEGY_PRESETS: Record<StrategyPreset, { label: string; build: (S: number) => Omit<OptionLeg, "id" | "premium" | "greeks">[] }> = {
  custom: { label: "Custom", build: () => [] },
  bull_spread: {
    label: "Bull Call Spread",
    build: (S) => [
      { type: "call", strike: Math.max(0.05, S - 0.1), qty: 1 },
      { type: "call", strike: Math.min(0.95, S + 0.1), qty: -1 },
    ],
  },
  bear_spread: {
    label: "Bear Put Spread",
    build: (S) => [
      { type: "put", strike: Math.min(0.95, S + 0.1), qty: 1 },
      { type: "put", strike: Math.max(0.05, S - 0.1), qty: -1 },
    ],
  },
  straddle: {
    label: "Straddle",
    build: (S) => [
      { type: "call", strike: S, qty: 1 },
      { type: "put", strike: S, qty: 1 },
    ],
  },
  strangle: {
    label: "Strangle",
    build: (S) => [
      { type: "call", strike: Math.min(0.95, S + 0.15), qty: 1 },
      { type: "put", strike: Math.max(0.05, S - 0.15), qty: 1 },
    ],
  },
};

const uid = () => Math.random().toString(36).slice(2, 8);

// ══════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════
export default function TradePage() {
  const router = useRouter();
  const { connected, markets, positions, balanceUsdc } = useApp();

  const openMarkets = useMemo(() => markets.filter(m => m.status === "OPEN"), [markets]);
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const selectedMarket = useMemo(() => openMarkets.find(m => m.id === selectedMarketId) ?? openMarkets[0], [openMarkets, selectedMarketId]);

  useEffect(() => {
    if (!selectedMarketId && openMarkets.length > 0) setSelectedMarketId(openMarkets[0].id);
  }, [openMarkets, selectedMarketId]);

  // LMSR state: normalize market pools to reasonable share quantities.
  // Raw pools are dollar amounts (e.g. $39k); we scale them down so the
  // LMSR math produces sensible per-dollar quotes.
  const { b, qYes, qNo } = useMemo(() => {
    if (!selectedMarket) return { b: 100, qYes: 50, qNo: 50 };
    const total = selectedMarket.yesPool + selectedMarket.noPool || 1;
    const scale = 100 / total;
    const qY = selectedMarket.yesPool * scale;
    const qN = selectedMarket.noPool * scale;
    const liq = Math.max(10, (qY + qN) * 0.5);
    return { b: liq, qYes: qY, qNo: qN };
  }, [selectedMarket]);

  // Order ticket
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<Side>("YES");
  const [spendStr, setSpendStr] = useState("10");
  const [slippage, setSlippage] = useState(2);
  const spend = parseFloat(spendStr) || 0;

  // Quote — shares are displayed as "contracts" (1 contract pays $1 if correct).
  // Internally the LMSR works in normalized units; we convert for display.
  const quote = useMemo(() => {
    if (spend <= 0 || !selectedMarket) return null;
    const spotBefore = LMSR.price(b, qYes, qNo, side);
    const rawShares = LMSR.sharesToBuy(b, qYes, qNo, side, spend);
    if (rawShares <= 0) return null;
    // Display shares as contracts: spend / spot ≈ number of $1-payout contracts
    const contracts = spend / spotBefore;
    const avgPrice = spotBefore; // cents per contract at entry
    const newYes = side === "YES" ? qYes + rawShares : qYes;
    const newNo = side === "NO" ? qNo + rawShares : qNo;
    const spotAfter = LMSR.price(b, newYes, newNo, side);
    const impact = Math.abs(spotAfter - spotBefore) / spotBefore * 100;
    const newProbYes = LMSR.price(b, newYes, newNo, "YES") * 100;
    const lpFee = spend * 0.003;
    const minContracts = contracts * (1 - slippage / 100);
    return { shares: contracts, avgPrice, spotBefore, spotAfter, impact, newProbYes, lpFee, minShares: minContracts };
  }, [spend, b, qYes, qNo, side, slippage, selectedMarket]);

  // Depth ladder
  const ladder = useMemo(() => LMSR.depthLadder(b, qYes, qNo), [b, qYes, qNo]);

  // Position panel
  const myPositions = useMemo(
    () => positions.filter(p => p.userId === CURRENT_USER_ID && markets.some(m => m.id === p.marketId && m.status !== "SETTLED")),
    [positions, markets]
  );

  // Options desk
  const [showOptions, setShowOptions] = useState(false);
  const [impliedVol, setImpliedVol] = useState(80);
  const [legs, setLegs] = useState<OptionLeg[]>([]);
  const [stratPreset, setStratPreset] = useState<StrategyPreset>("custom");

  const underlying = selectedMarket ? LMSR.price(b, qYes, qNo, "YES") : 0.5;
  const T = selectedMarket ? Math.max(0.01, (new Date(selectedMarket.closesAt).getTime() - Date.now()) / (365.25 * 86400_000)) : 0.1;
  const sigma = impliedVol / 100;
  const r = 0.05;

  const applyPreset = useCallback((preset: StrategyPreset) => {
    setStratPreset(preset);
    if (preset === "custom") return;
    const defs = STRATEGY_PRESETS[preset].build(underlying);
    const newLegs = defs.map(d => {
      const g = blackScholes(underlying, d.strike, T, r, sigma, d.type === "call");
      return { id: uid(), ...d, premium: g.price * Math.abs(d.qty), greeks: g };
    });
    setLegs(newLegs);
  }, [underlying, T, sigma]);

  const addLeg = useCallback((type: "call" | "put") => {
    const strike = Math.round(underlying * 20) / 20;
    const g = blackScholes(underlying, strike, T, r, sigma, type === "call");
    setLegs(prev => [...prev, { id: uid(), type, strike, qty: 1, premium: g.price, greeks: g }]);
    setStratPreset("custom");
  }, [underlying, T, sigma]);

  const updateLeg = useCallback((id: string, patch: Partial<OptionLeg>) => {
    setLegs(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, ...patch };
      const g = blackScholes(underlying, updated.strike, T, r, sigma, updated.type === "call");
      return { ...updated, premium: g.price * Math.abs(updated.qty), greeks: g };
    }));
    setStratPreset("custom");
  }, [underlying, T, sigma]);

  const removeLeg = useCallback((id: string) => {
    setLegs(prev => prev.filter(l => l.id !== id));
    setStratPreset("custom");
  }, []);

  // Payoff computation for SVG
  const payoffData = useMemo(() => {
    if (legs.length === 0) return null;
    const points: { x: number; y: number }[] = [];
    const netPremium = legs.reduce((s, l) => s + (l.qty > 0 ? -l.premium : l.premium), 0);
    let maxProfit = -Infinity, maxLoss = Infinity;
    const breakevens: number[] = [];

    for (let i = 0; i <= 100; i++) {
      const S = i / 100;
      let payoff = 0;
      for (const leg of legs) {
        const intrinsic = leg.type === "call" ? Math.max(0, S - leg.strike) : Math.max(0, leg.strike - S);
        payoff += leg.qty * intrinsic;
      }
      const pnl = payoff + netPremium;
      points.push({ x: S, y: pnl });
      if (pnl > maxProfit) maxProfit = pnl;
      if (pnl < maxLoss) maxLoss = pnl;

      if (i > 0) {
        const prev = points[i - 1].y;
        if ((prev <= 0 && pnl >= 0) || (prev >= 0 && pnl <= 0)) {
          breakevens.push(S);
        }
      }
    }
    return { points, maxProfit, maxLoss, breakevens, netPremium };
  }, [legs]);

  // Solana wiring preview
  const solanaPreview = useMemo(() => {
    if (!selectedMarket || !quote) return null;
    const marketIdBuf = selectedMarket.id;
    const ammPoolPDA = `PDA("amm_pool", ${marketIdBuf})`;
    const shareMintPDA = `PDA("share_mint", ${marketIdBuf}, "${side}")`;
    return {
      program: "ELThikt285QiyLBWPNiGbgTTzGvjvQhYjrV33VC8ZyoD",
      ix: "swap_shares",
      discriminator: "sha256('global:swap_shares')[0..8]",
      args: `{ side: ${side === "YES" ? 1 : 0}, amount: ${Math.floor(spend * 1e6)}u64, min_shares: ${Math.floor((quote.minShares) * 1e6)}u64 }`,
      accounts: [
        { name: "amm_pool", pda: ammPoolPDA, writable: true, signer: false },
        { name: "share_mint", pda: shareMintPDA, writable: true, signer: false },
        { name: "user_share_ata", pda: "ATA(user, share_mint)", writable: true, signer: false },
        { name: "user_usdc_ata", pda: "ATA(user, USDC_MINT)", writable: true, signer: false },
        { name: "pool_usdc_vault", pda: "PDA('vault', amm_pool)", writable: true, signer: false },
        { name: "user", pda: "wallet", writable: true, signer: true },
        { name: "usdc_mint", pda: "EPjFWdd5...Dt1v", writable: false, signer: false },
        { name: "token_program", pda: "TokenkegQ...5DA", writable: false, signer: false },
        { name: "system_program", pda: "1111...1111", writable: false, signer: false },
      ],
    };
  }, [selectedMarket, quote, side, spend]);

  if (!connected) {
    return (
      <div className="shell">
        <div className="empty" style={{ marginTop: "3rem" }}>
          <strong>Connect to start trading</strong>
          <p style={{ marginTop: "0.5rem" }}>Log in to trade outcome shares on the LMSR exchange.</p>
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => router.push("/login")}>Log in</button>
        </div>
      </div>
    );
  }

  if (!selectedMarket) {
    return (
      <div className="shell">
        <div className="empty" style={{ marginTop: "3rem" }}>
          <strong>No open markets</strong>
          <p style={{ marginTop: "0.5rem" }}>There are no markets available for trading right now.</p>
        </div>
      </div>
    );
  }

  const spotYes = LMSR.price(b, qYes, qNo, "YES");
  const spotNo = LMSR.price(b, qYes, qNo, "NO");

  return (
    <div className="shell">
      <div className="page-head">
        <div>
          <h1>Trade</h1>
          <div className="page-sub">LMSR Exchange · Devnet Sandbox</div>
        </div>
        <button className={`btn ${showOptions ? "btn-primary" : ""}`} onClick={() => setShowOptions(!showOptions)}>
          {showOptions ? "✕ Close Options" : "📊 Options Desk"}
        </button>
      </div>

      {/* Market selector */}
      <div className="field" style={{ maxWidth: 500, marginBottom: "1.25rem" }}>
        <label>Select Market</label>
        <select className="select" value={selectedMarketId} onChange={e => setSelectedMarketId(e.target.value)} style={{ width: "100%" }}>
          {openMarkets.map(m => (
            <option key={m.id} value={m.id}>{m.question.slice(0, 70)}</option>
          ))}
        </select>
      </div>

      {/* Spot prices */}
      <div className="pools" style={{ marginBottom: "1.25rem" }}>
        <div className="pool yes">
          <div className="pct">{(spotYes * 100).toFixed(1)}¢</div>
          <div className="lbl">YES spot price</div>
        </div>
        <div className="pool no">
          <div className="pct">{(spotNo * 100).toFixed(1)}¢</div>
          <div className="lbl">NO spot price</div>
        </div>
        <div className="pool">
          <div className="pct num" style={{ fontSize: "1.2rem" }}>b={b.toFixed(0)}</div>
          <div className="lbl">Liquidity param</div>
        </div>
      </div>

      <div className="t-layout">
        {/* ── Order Ticket ── */}
        <div className="t-ticket">
          <div className="panel">
            <h2>Order Ticket</h2>

            {/* Buy / Sell toggle */}
            <div className="side-toggle" style={{ marginBottom: "0.75rem" }}>
              <button className={`btn ${action === "buy" ? "btn-yes" : ""}`} onClick={() => setAction("buy")}>Buy</button>
              <button className={`btn ${action === "sell" ? "btn-no" : ""}`} onClick={() => setAction("sell")}>Sell</button>
            </div>

            {/* YES / NO selector */}
            <div className="side-toggle" style={{ marginBottom: "0.75rem" }}>
              <button className={`btn ${side === "YES" ? "selected-yes" : "btn-yes-outline"}`} onClick={() => setSide("YES")}>
                YES <span className="odd">{(spotYes * 100).toFixed(1)}¢</span>
              </button>
              <button className={`btn ${side === "NO" ? "selected-no" : "btn-no-outline"}`} onClick={() => setSide("NO")}>
                NO <span className="odd">{(spotNo * 100).toFixed(1)}¢</span>
              </button>
            </div>

            {/* Spend amount */}
            <div className="field">
              <label>Spend (USD)</label>
              <input type="number" min="0.01" step="0.01" value={spendStr}
                onChange={e => setSpendStr(e.target.value)}
                style={{ fontSize: "1.1rem", fontWeight: 800 }} />
            </div>

            {/* Quote */}
            {quote && (
              <div className="t-quote">
                <div className="est"><span>Shares received</span><b className="num">{quote.shares.toFixed(4)}</b></div>
                <div className="est"><span>Avg price</span><b className="num">{(quote.avgPrice * 100).toFixed(2)}¢</b></div>
                <div className="est"><span>Spot price (before)</span><b className="num">{(quote.spotBefore * 100).toFixed(2)}¢</b></div>
                <div className="est"><span>Spot price (after)</span><b className="num">{(quote.spotAfter * 100).toFixed(2)}¢</b></div>
                <div className="est"><span>Price impact</span><b className={`num ${quote.impact > 5 ? "accent" : ""}`}>{quote.impact.toFixed(2)}%</b></div>
                <div className="est"><span>New probability (YES)</span><b className="num">{quote.newProbYes.toFixed(1)}%</b></div>
                <div className="est"><span>LP fee (0.3%)</span><b className="num">${quote.lpFee.toFixed(4)}</b></div>
              </div>
            )}

            {/* Slippage */}
            <div className="field" style={{ marginTop: "0.5rem" }}>
              <label>Slippage tolerance: {slippage}%</label>
              <input type="range" min="0.1" max="10" step="0.1" value={slippage}
                onChange={e => setSlippage(parseFloat(e.target.value))}
                style={{ accentColor: "var(--accent)" }} />
              {quote && <div className="hint">Min shares: {quote.minShares.toFixed(4)}</div>}
            </div>

            <button className="btn btn-primary btn-block" style={{ marginTop: "0.5rem" }}
              disabled={!quote || spend > balanceUsdc}>
              {action === "buy" ? "Buy" : "Sell"} {side} Shares
            </button>
            {spend > balanceUsdc && <div className="hint err">Insufficient balance</div>}

            <div className="info-box" style={{ marginTop: "0.75rem", fontSize: "0.78rem" }}>
              🧪 Devnet sandbox — no real funds are at risk. Transactions are simulated client-side.
            </div>
          </div>

          {/* ── Solana Instruction Preview ── */}
          {solanaPreview && (
            <div className="panel" style={{ marginTop: "1rem" }}>
              <h3>Solana Instruction Preview</h3>
              <div className="t-solana-preview">
                <div className="t-sol-row"><span className="dim">Program</span><span className="mono" style={{ fontSize: "0.75rem" }}>{solanaPreview.program}</span></div>
                <div className="t-sol-row"><span className="dim">Instruction</span><span className="mono">{solanaPreview.ix}</span></div>
                <div className="t-sol-row"><span className="dim">Discriminator</span><span className="mono" style={{ fontSize: "0.75rem" }}>{solanaPreview.discriminator}</span></div>
                <div className="t-sol-row"><span className="dim">Args (Borsh)</span><span className="mono" style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>{solanaPreview.args}</span></div>
                <div style={{ marginTop: "0.5rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Accounts:</div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="board" style={{ fontSize: "0.75rem" }}>
                      <thead>
                        <tr><th>#</th><th>Name</th><th>PDA / Key</th><th>W</th><th>S</th></tr>
                      </thead>
                      <tbody>
                        {solanaPreview.accounts.map((a, i) => (
                          <tr key={i}>
                            <td className="faint">{i}</td>
                            <td style={{ fontWeight: 600 }}>{a.name}</td>
                            <td className="mono" style={{ fontSize: "0.68rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{a.pda}</td>
                            <td>{a.writable ? "✓" : ""}</td>
                            <td>{a.signer ? "✓" : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="t-right">
          {/* Depth Ladder */}
          <div className="panel">
            <h3>Depth Ladder</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="board">
                <thead>
                  <tr>
                    <th>Spend</th>
                    <th className="right" style={{ color: "var(--yes)" }}>YES Spot</th>
                    <th className="right" style={{ color: "var(--yes)" }}>YES After</th>
                    <th className="right" style={{ color: "var(--no)" }}>NO Spot</th>
                    <th className="right" style={{ color: "var(--no)" }}>NO After</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map(l => (
                    <tr key={l.size}>
                      <td className="num" style={{ fontWeight: 700 }}>${l.size}</td>
                      <td className="right num">{(l.bidYes * 100).toFixed(2)}¢</td>
                      <td className="right num">{(l.askYes * 100).toFixed(2)}¢</td>
                      <td className="right num">{(l.bidNo * 100).toFixed(2)}¢</td>
                      <td className="right num">{(l.askNo * 100).toFixed(2)}¢</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Position Panel */}
          <div className="panel">
            <h3>Your Positions</h3>
            {myPositions.length === 0 ? (
              <div className="faint" style={{ fontSize: "0.88rem" }}>No open positions</div>
            ) : (
              <div className="stack" style={{ gap: "0.35rem" }}>
                {myPositions.slice(0, 8).map(p => {
                  const m = markets.find(mk => mk.id === p.marketId);
                  if (!m) return null;
                  const mB = Math.max(20, (m.yesPool + m.noPool) * 0.15);
                  const markPrice = LMSR.price(mB, m.yesPool, m.noPool, p.side);
                  const markValue = p.amount * markPrice / (p.side === "YES"
                    ? LMSR.price(mB, m.yesPool, m.noPool, "YES")
                    : LMSR.price(mB, m.yesPool, m.noPool, "NO"));
                  return (
                    <div key={p.id} className="w-exposure-row" onClick={() => router.push(`/market/${m.id}`)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.question.slice(0, 42)}{m.question.length > 42 ? "…" : ""}
                        </div>
                        <div className="faint" style={{ fontSize: "0.78rem" }}>{p.side} · {p.amount.toFixed(2)} shares</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>${markValue.toFixed(2)}</div>
                        <div className="faint" style={{ fontSize: "0.72rem" }}>mark value</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         Options Desk
         ══════════════════════════════════════════════════════════════════ */}
      {showOptions && (
        <div className="t-options" style={{ marginTop: "1.5rem" }}>
          <div className="panel">
            <div className="between" style={{ marginBottom: "1rem" }}>
              <h2 style={{ margin: 0 }}>Options Desk</h2>
              <div className="faint" style={{ fontSize: "0.82rem" }}>
                Underlying: {(underlying * 100).toFixed(1)}¢ · T: {(T * 365).toFixed(0)}d · σ: {impliedVol}%
              </div>
            </div>

            {/* Implied vol slider */}
            <div className="field" style={{ maxWidth: 400 }}>
              <label>Implied Volatility: {impliedVol}%</label>
              <input type="range" min="10" max="200" step="1" value={impliedVol}
                onChange={e => setImpliedVol(parseInt(e.target.value))}
                style={{ accentColor: "var(--accent)" }} />
            </div>

            {/* Strategy presets */}
            <div style={{ marginBottom: "1rem" }}>
              <label>Strategy</label>
              <div className="pills">
                {(Object.entries(STRATEGY_PRESETS) as [StrategyPreset, typeof STRATEGY_PRESETS["custom"]][]).map(([k, v]) => (
                  <button key={k} className={`pill ${stratPreset === k ? "active" : ""}`}
                    onClick={() => applyPreset(k as StrategyPreset)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leg builder */}
            <div className="between" style={{ marginBottom: "0.5rem" }}>
              <h3 style={{ margin: 0 }}>Legs</h3>
              <div className="row" style={{ gap: "0.35rem" }}>
                <button className="btn btn-sm btn-yes-outline" onClick={() => addLeg("call")}>+ Call</button>
                <button className="btn btn-sm btn-no-outline" onClick={() => addLeg("put")}>+ Put</button>
              </div>
            </div>

            {legs.length === 0 ? (
              <div className="faint" style={{ fontSize: "0.88rem", marginBottom: "1rem" }}>Add legs or select a strategy preset above</div>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
                <table className="board">
                  <thead>
                    <tr>
                      <th>Type</th><th>Strike</th><th>Qty</th><th className="right">Premium</th>
                      <th className="right">Δ</th><th className="right">Γ</th><th className="right">Θ</th><th className="right">V</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.map(l => (
                      <tr key={l.id}>
                        <td>
                          <select className="select" value={l.type} onChange={e => updateLeg(l.id, { type: e.target.value as "call" | "put" })}
                            style={{ width: 70, padding: "0.2rem 0.3rem", fontSize: "0.8rem" }}>
                            <option value="call">Call</option>
                            <option value="put">Put</option>
                          </select>
                        </td>
                        <td>
                          <input type="number" min="0.01" max="0.99" step="0.05" value={l.strike}
                            onChange={e => updateLeg(l.id, { strike: parseFloat(e.target.value) || 0.5 })}
                            style={{ width: 70, padding: "0.2rem 0.3rem", fontSize: "0.8rem" }} />
                        </td>
                        <td>
                          <input type="number" min="-10" max="10" step="1" value={l.qty}
                            onChange={e => updateLeg(l.id, { qty: parseInt(e.target.value) || 1 })}
                            style={{ width: 60, padding: "0.2rem 0.3rem", fontSize: "0.8rem" }} />
                        </td>
                        <td className="right num" style={{ fontWeight: 700 }}>${l.premium.toFixed(4)}</td>
                        <td className="right num">{l.greeks.delta.toFixed(3)}</td>
                        <td className="right num">{l.greeks.gamma.toFixed(3)}</td>
                        <td className="right num">{l.greeks.theta.toFixed(4)}</td>
                        <td className="right num">{l.greeks.vega.toFixed(4)}</td>
                        <td><button className="x-btn" onClick={() => removeLeg(l.id)}>✕</button></td>
                      </tr>
                    ))}
                    {legs.length > 0 && (
                      <tr style={{ fontWeight: 800 }}>
                        <td colSpan={3}>Net</td>
                        <td className="right num">${legs.reduce((s, l) => s + (l.qty > 0 ? -l.premium : l.premium), 0).toFixed(4)}</td>
                        <td className="right num">{legs.reduce((s, l) => s + l.greeks.delta * l.qty, 0).toFixed(3)}</td>
                        <td className="right num">{legs.reduce((s, l) => s + l.greeks.gamma * l.qty, 0).toFixed(3)}</td>
                        <td className="right num">{legs.reduce((s, l) => s + l.greeks.theta * l.qty, 0).toFixed(4)}</td>
                        <td className="right num">{legs.reduce((s, l) => s + l.greeks.vega * l.qty, 0).toFixed(4)}</td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SVG Payoff Diagram */}
            {payoffData && (
              <div>
                <h3>Payoff at Expiry</h3>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
                  <div><span className="dim">Max Profit: </span><strong style={{ color: "var(--yes)" }}>${payoffData.maxProfit.toFixed(4)}</strong></div>
                  <div><span className="dim">Max Loss: </span><strong style={{ color: "var(--no)" }}>${payoffData.maxLoss.toFixed(4)}</strong></div>
                  {payoffData.breakevens.length > 0 && (
                    <div><span className="dim">Breakeven: </span><strong>{payoffData.breakevens.map(be => (be * 100).toFixed(1) + "¢").join(", ")}</strong></div>
                  )}
                  <div><span className="dim">Net Premium: </span><strong>${payoffData.netPremium.toFixed(4)}</strong></div>
                </div>

                <svg viewBox="0 0 600 250" style={{ width: "100%", maxWidth: 700, background: "var(--card-2)", borderRadius: "var(--r-card)", border: "1px solid var(--border)" }}>
                  {/* Grid */}
                  <line x1="50" y1="20" x2="50" y2="220" stroke="var(--border-bright)" strokeWidth="1" />
                  <line x1="50" y1="220" x2="580" y2="220" stroke="var(--border-bright)" strokeWidth="1" />

                  {/* Zero line */}
                  {(() => {
                    const range = payoffData.maxProfit - payoffData.maxLoss;
                    const pad = range * 0.1 || 0.01;
                    const yMin = payoffData.maxLoss - pad;
                    const yMax = payoffData.maxProfit + pad;
                    const zeroY = 220 - ((0 - yMin) / (yMax - yMin)) * 200;
                    return <line x1="50" y1={zeroY} x2="580" y2={zeroY} stroke="var(--text-faint)" strokeWidth="1" strokeDasharray="4,4" />;
                  })()}

                  {/* P/L curve */}
                  {(() => {
                    const range = payoffData.maxProfit - payoffData.maxLoss;
                    const pad = range * 0.1 || 0.01;
                    const yMin = payoffData.maxLoss - pad;
                    const yMax = payoffData.maxProfit + pad;
                    const pts = payoffData.points.map(p => {
                      const px = 50 + p.x * 530;
                      const py = 220 - ((p.y - yMin) / (yMax - yMin)) * 200;
                      return `${px},${py}`;
                    });
                    return <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" />;
                  })()}

                  {/* Fill above/below zero */}
                  {(() => {
                    const range = payoffData.maxProfit - payoffData.maxLoss;
                    const pad = range * 0.1 || 0.01;
                    const yMin = payoffData.maxLoss - pad;
                    const yMax = payoffData.maxProfit + pad;
                    const zeroY = 220 - ((0 - yMin) / (yMax - yMin)) * 200;

                    const pts = payoffData.points.map(p => ({
                      x: 50 + p.x * 530,
                      y: 220 - ((p.y - yMin) / (yMax - yMin)) * 200,
                    }));

                    const abovePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${Math.min(p.y, zeroY)}`).join(" ")
                      + `L${pts[pts.length - 1].x},${zeroY}L${pts[0].x},${zeroY}Z`;
                    const belowPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${Math.max(p.y, zeroY)}`).join(" ")
                      + `L${pts[pts.length - 1].x},${zeroY}L${pts[0].x},${zeroY}Z`;

                    return (
                      <>
                        <path d={abovePath} fill="rgba(22,163,74,0.12)" />
                        <path d={belowPath} fill="rgba(239,68,68,0.12)" />
                      </>
                    );
                  })()}

                  {/* Breakeven markers */}
                  {payoffData.breakevens.map((be, i) => {
                    const x = 50 + be * 530;
                    return (
                      <g key={i}>
                        <line x1={x} y1="20" x2={x} y2="220" stroke="var(--amber)" strokeWidth="1" strokeDasharray="3,3" />
                        <text x={x} y="235" textAnchor="middle" fill="var(--amber)" fontSize="9" fontWeight="700">{(be * 100).toFixed(0)}¢</text>
                      </g>
                    );
                  })}

                  {/* Underlying marker */}
                  {(() => {
                    const x = 50 + underlying * 530;
                    return <line x1={x} y1="20" x2={x} y2="220" stroke="var(--accent)" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />;
                  })()}

                  {/* Axis labels */}
                  <text x="315" y="248" textAnchor="middle" fill="var(--text-faint)" fontSize="10">Underlying Price at Expiry</text>
                  <text x="55" y="15" fill="var(--text-faint)" fontSize="9">P/L</text>
                  <text x="55" y="232" fill="var(--text-faint)" fontSize="9">0¢</text>
                  <text x="575" y="232" fill="var(--text-faint)" fontSize="9">100¢</text>
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
