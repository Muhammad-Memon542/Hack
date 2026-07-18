// Echo — money layer.
//
// A social prediction market takes custody of pooled stakes, so it needs a
// trustworthy payment system: funding in, bet debits, parimutuel settlement,
// winnings payout, and cash-out — each a tracked transaction with a status
// lifecycle, idempotency, and a reconcilable running balance. Everything here
// is sandbox/synthetic (USDC on testnet via Unifold); no real money moves.

import { NOW, type Market, type Position } from "@/lib/mock";

export type TxnType = "deposit" | "bet" | "winnings" | "refund" | "withdrawal" | "fee";
export type TxnStatus = "settled" | "processing" | "pending" | "failed" | "reversed";
export type FundingMethod = "unifold" | "card" | "bank";

export interface TxnEvent {
  label: string;
  at: number; // epoch ms
}

export interface Txn {
  id: string;
  type: TxnType;
  direction: "credit" | "debit";
  amount: number; // positive USDC
  status: TxnStatus;
  method?: FundingMethod;
  marketId?: string;
  side?: "YES" | "NO";
  note: string;
  idempotencyKey: string;
  createdAt: number;
  events: TxnEvent[];
}

// ---------- money ----------
export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export const round2 = (n: number) => Math.round(n * 1e6) / 1e6;

// ---------- funding methods (fees / rewards / speed) ----------
export interface MethodSpec {
  key: FundingMethod;
  label: string;
  sublabel: string;
  depositFeePct: number; // charged on deposits
  withdrawFeePct: number; // charged on cash-outs
  rewardsPct: number; // loyalty value earned (card only)
  etaLabel: string;
  buildsHistory: boolean;
}

export const METHODS: Record<FundingMethod, MethodSpec> = {
  bank: {
    key: "bank",
    label: "Bank transfer",
    sublabel: "EFT / ACH · no fee, slower",
    depositFeePct: 0,
    withdrawFeePct: 0,
    rewardsPct: 0,
    etaLabel: "1–2 business days",
    buildsHistory: true,
  },
  card: {
    key: "card",
    label: "Debit / credit card",
    sublabel: "Instant · earns rewards",
    depositFeePct: 0.025,
    withdrawFeePct: 0,
    rewardsPct: 0.01,
    etaLabel: "Instant",
    buildsHistory: true,
  },
  unifold: {
    key: "unifold",
    label: "USDC · any chain",
    sublabel: "Multi-chain via Unifold",
    depositFeePct: 0.01,
    withdrawFeePct: 0.01,
    rewardsPct: 0,
    etaLabel: "~1 minute",
    buildsHistory: true,
  },
};

// Decisioning helper: net cost of funding `amount` via a method.
export function fundingQuote(method: FundingMethod, amount: number) {
  const m = METHODS[method];
  const fee = round2(amount * m.depositFeePct);
  const rewards = round2(amount * m.rewardsPct);
  const credited = round2(amount - fee);
  const netCost = round2(fee - rewards);
  return { fee, rewards, credited, netCost, spec: m };
}

// ---------- status metadata ----------
export const STATUS_META: Record<TxnStatus, { label: string; cls: string }> = {
  settled: { label: "Settled", cls: "OPEN" }, // green
  processing: { label: "Processing", cls: "RESOLVING" }, // amber-ish accent
  pending: { label: "Pending", cls: "RESOLVING" },
  failed: { label: "Failed", cls: "DISPUTED" }, // red
  reversed: { label: "Reversed", cls: "SETTLED" }, // gray
};

export const TYPE_META: Record<TxnType, { label: string; icon: string }> = {
  deposit: { label: "Deposit", icon: "↓" },
  bet: { label: "Bet placed", icon: "◆" },
  winnings: { label: "Winnings", icon: "★" },
  refund: { label: "Refund", icon: "↩" },
  withdrawal: { label: "Cash out", icon: "↑" },
  fee: { label: "Platform fee", icon: "%" },
};

// ---------- parimutuel settlement + escrow reconciliation ----------
export const PLATFORM_FEE_PCT = 0.02; // taken from the losing pool at settlement

export interface Settlement {
  marketId: string;
  question: string;
  outcome: "YES" | "NO";
  totalPool: number;
  winningPool: number;
  losingPool: number;
  platformFee: number;
  distributed: number; // paid back to winners (stakes + net winnings)
  // Escrow invariant: staked in === distributed + platformFee (± rounding).
  reconciles: boolean;
  yourStake: number;
  yourPayout: number; // 0 if you didn't win
  yourProfit: number;
}

export function settleMarket(market: Market, myPositions: Position[]): Settlement | null {
  if (market.status !== "SETTLED" || !market.outcome) return null;
  const outcome = market.outcome;
  const winningPool = outcome === "YES" ? market.yesPool : market.noPool;
  const losingPool = outcome === "YES" ? market.noPool : market.yesPool;
  const totalPool = round2(winningPool + losingPool);
  const platformFee = round2(losingPool * PLATFORM_FEE_PCT);
  const prizePool = round2(losingPool - platformFee); // net winnings shared pro-rata
  // Winners get their stake back plus a pro-rata slice of the prize pool.
  const distributed = round2(winningPool + prizePool);
  const reconciles = Math.abs(totalPool - (distributed + platformFee)) < 0.01;

  const yourStake = round2(
    myPositions.filter((p) => p.marketId === market.id && p.side === outcome).reduce((s, p) => s + p.amount, 0)
  );
  const share = winningPool > 0 ? yourStake / winningPool : 0;
  const yourPayout = yourStake > 0 ? round2(yourStake + prizePool * share) : 0;
  const yourProfit = round2(yourPayout - yourStake);

  return {
    marketId: market.id,
    question: market.question,
    outcome,
    totalPool,
    winningPool,
    losingPool,
    platformFee,
    distributed,
    reconciles,
    yourStake,
    yourPayout,
    yourProfit,
  };
}

// ---------- responsible gaming ----------
export interface Limits {
  weeklyDepositCap: number;
  perBetCap: number;
  coolOff: boolean;
}
export const DEFAULT_LIMITS: Limits = { weeklyDepositCap: 500, perBetCap: 100, coolOff: false };

export interface Decision {
  allow: boolean;
  reason?: string;
  severity?: "block" | "warn";
}

// Pre-authorization decisioning for a deposit, given the week's prior deposits.
export function decideDeposit(amount: number, weekTotal: number, limits: Limits): Decision {
  if (limits.coolOff) return { allow: false, severity: "block", reason: "Cool-off period is active." };
  if (amount <= 0) return { allow: false, severity: "block", reason: "Amount must be positive." };
  if (weekTotal + amount > limits.weeklyDepositCap)
    return {
      allow: false,
      severity: "block",
      reason: `Exceeds your weekly deposit cap (${usd(limits.weeklyDepositCap)}). This week: ${usd(weekTotal)}.`,
    };
  if (weekTotal + amount > limits.weeklyDepositCap * 0.8)
    return { allow: true, severity: "warn", reason: "You're near your weekly deposit cap." };
  return { allow: true };
}

// ---------- deterministic opening statement ----------
// Build a coherent, reconciled transaction history from the user's real
// positions + current balance. The opening deposit is sized so the ledger
// reconciles exactly to the live balance (opening + credits − debits === balance).
export function buildStatement(opts: {
  balance: number;
  positions: Position[];
  markets: Market[];
  userId: string;
}): Txn[] {
  const { balance, positions, markets, userId } = opts;
  const mine = positions.filter((p) => p.userId === userId);
  const txns: Txn[] = [];

  const min = (h: number) => NOW - h * 3600_000;

  // Bets (debits) from real positions.
  let betsTotal = 0;
  let winsTotal = 0;
  mine.forEach((p, i) => {
    betsTotal = round2(betsTotal + p.amount);
    const m = markets.find((mk) => mk.id === p.marketId);
    txns.push({
      id: `tx_bet_${p.id}`,
      type: "bet",
      direction: "debit",
      amount: p.amount,
      status: "settled",
      marketId: p.marketId,
      side: p.side,
      note: m ? m.question : "Bet",
      idempotencyKey: `bet:${p.id}`,
      createdAt: new Date(p.createdAt).getTime() || min(30 + i),
      events: [
        { label: "Authorized", at: new Date(p.createdAt).getTime() || min(30 + i) },
        { label: "Escrowed in market pool", at: (new Date(p.createdAt).getTime() || min(30 + i)) + 1500 },
      ],
    });
    // If that market settled in the user's favour, add a winnings credit.
    if (m && m.status === "SETTLED" && m.outcome === p.side) {
      const s = settleMarket(m, mine);
      if (s && s.yourPayout > 0) {
        winsTotal = round2(winsTotal + s.yourPayout);
        txns.push({
          id: `tx_win_${p.id}`,
          type: "winnings",
          direction: "credit",
          amount: s.yourPayout,
          status: "settled",
          marketId: p.marketId,
          side: p.side,
          note: `Settled ${m.outcome} · ${m.question}`,
          idempotencyKey: `win:${m.id}:${userId}`,
          createdAt: (new Date(m.resolvedAt ?? m.closesAt).getTime() || min(6)) + i,
          events: [
            { label: "Market resolved", at: new Date(m.resolvedAt ?? m.closesAt).getTime() || min(6) },
            { label: "Payout settled to balance", at: (new Date(m.resolvedAt ?? m.closesAt).getTime() || min(6)) + 2000 },
          ],
        });
      }
    }
  });

  // Opening deposit sized so the statement reconciles to the live balance, and
  // dated before every other entry so the running balance can't start negative.
  const opening = round2(balance + betsTotal - winsTotal);
  const earliest = txns.length ? Math.min(...txns.map((t) => t.createdAt)) : min(72);
  const openAt = earliest - 3600_000;
  txns.push({
    id: "tx_open_deposit",
    type: "deposit",
    direction: "credit",
    amount: Math.max(opening, 0),
    status: "settled",
    method: "unifold",
    note: "Initial deposit · USDC via Unifold",
    idempotencyKey: "deposit:opening",
    createdAt: openAt,
    events: [
      { label: "Deposit address funded", at: openAt },
      { label: "Bridged to treasury", at: openAt + 40_000 },
      { label: "Credited to balance", at: openAt + 60_000 },
    ],
  });

  return txns.sort((a, b) => b.createdAt - a.createdAt);
}

// Running balance + reconciliation over a time-ascending statement.
export function reconcile(txns: Txn[]) {
  const asc = [...txns].sort((a, b) => a.createdAt - b.createdAt);
  let running = 0;
  const withRunning = asc.map((t) => {
    if (t.status === "settled") running = round2(running + (t.direction === "credit" ? t.amount : -t.amount));
    return { txn: t, running };
  });
  const credits = round2(
    asc.filter((t) => t.status === "settled" && t.direction === "credit").reduce((s, t) => s + t.amount, 0)
  );
  const debits = round2(
    asc.filter((t) => t.status === "settled" && t.direction === "debit").reduce((s, t) => s + t.amount, 0)
  );
  const derived = round2(credits - debits);
  return { rows: withRunning.reverse(), credits, debits, derived };
}
