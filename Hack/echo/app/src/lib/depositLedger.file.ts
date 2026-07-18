import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * Minimal file-backed ledger for deposit executions + per-user balances.
 *
 * This branch runs off mock/localStorage rather than Postgres, so we persist
 * deposit records server-side in a gitignored JSON file. It gives us a real
 * reconciliation surface — every Unifold DirectExecution is recorded, status
 * transitions are idempotent, and balances are derived from settled deposits —
 * without standing up a database for the demo. Swap this module for Prisma to
 * productionize.
 *
 * Keyed by Unifold execution id (`exec_*`). Both the poll path (GET
 * /api/deposits) and the push path (webhook) funnel through applyExecution, so
 * a deposit is credited exactly once regardless of which observes it first.
 */

export interface DepositRecord {
  id: string; // Unifold DirectExecution id
  externalUserId: string;
  amountUsdc: number;
  status: string; // Unifold DirectExecutionStatus
  credited: boolean; // added to the balance yet?
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DebitRecord {
  id: string;
  externalUserId: string;
  amountUsdc: number;
  marketId: string;
  side: string;
  createdAt: string;
}

interface LedgerShape {
  deposits: Record<string, DepositRecord>;
  debits?: Record<string, DebitRecord>;
  processedEvents: string[]; // webhook event ids already applied
}

const DATA_DIR = path.join(process.cwd(), ".data");
const LEDGER_PATH = path.join(DATA_DIR, "deposits.json");

async function read(): Promise<LedgerShape> {
  try {
    return JSON.parse(await fs.readFile(LEDGER_PATH, "utf8")) as LedgerShape;
  } catch {
    return { deposits: {}, processedEvents: [] };
  }
}

async function write(data: LedgerShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LEDGER_PATH, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Record/update a deposit execution and credit the balance exactly once when
 * it first reaches `succeeded`. Idempotent on `eventId` (webhook replay) and on
 * the credited flag (poll + webhook racing).
 */
export async function applyExecution(
  exec: {
    id: string;
    externalUserId: string;
    amountUsdc: number;
    status: string;
    txHash?: string | null;
  },
  opts?: { eventId?: string }
): Promise<{ record: DepositRecord; creditedNow: boolean }> {
  const data = await read();

  if (opts?.eventId) {
    if (data.processedEvents.includes(opts.eventId)) {
      const existing = data.deposits[exec.id];
      if (existing) return { record: existing, creditedNow: false };
    } else {
      data.processedEvents.push(opts.eventId);
    }
  }

  const now = new Date().toISOString();
  const prev = data.deposits[exec.id];
  const record: DepositRecord = {
    id: exec.id,
    externalUserId: exec.externalUserId,
    amountUsdc: exec.amountUsdc || prev?.amountUsdc || 0,
    status: exec.status,
    credited: prev?.credited ?? false,
    txHash: exec.txHash ?? prev?.txHash ?? null,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };

  let creditedNow = false;
  if (exec.status === "succeeded" && !record.credited) {
    record.credited = true;
    creditedNow = true;
  }

  data.deposits[exec.id] = record;
  await write(data);
  return { record, creditedNow };
}

/**
 * Credit an adjustment back to a user's balance — used to refund a bet debit if
 * the downstream bet write fails, so money is never lost. Recorded as a
 * synthetic credited deposit.
 */
export async function creditAdjustment(
  externalUserId: string,
  amountUsdc: number,
  note: string
): Promise<void> {
  const data = await read();
  const id = "adj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  data.deposits[id] = {
    id,
    externalUserId,
    amountUsdc,
    status: "succeeded",
    credited: true,
    txHash: note,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await write(data);
}

export async function getBalance(externalUserId: string): Promise<number> {
  const data = await read();
  const credited = Object.values(data.deposits)
    .filter((d) => d.externalUserId === externalUserId && d.credited)
    .reduce((sum, d) => sum + d.amountUsdc, 0);
  const spent = Object.values(data.debits ?? {})
    .filter((d) => d.externalUserId === externalUserId)
    .reduce((sum, d) => sum + d.amountUsdc, 0);
  return Math.round((credited - spent) * 1e6) / 1e6;
}

/**
 * Debit the balance to fund a bet. Rejects if funds are insufficient — the
 * balance can never go negative. Returns the resulting balance on success.
 */
export async function recordDebit(debit: {
  externalUserId: string;
  amountUsdc: number;
  marketId: string;
  side: string;
}): Promise<{ ok: boolean; balanceUsdc: number; error?: string }> {
  const balance = await getBalance(debit.externalUserId);
  if (debit.amountUsdc <= 0) {
    return { ok: false, balanceUsdc: balance, error: "amount must be positive" };
  }
  if (debit.amountUsdc > balance) {
    return { ok: false, balanceUsdc: balance, error: "insufficient balance" };
  }
  const data = await read();
  data.debits = data.debits ?? {};
  const id = "bet_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  data.debits[id] = {
    id,
    externalUserId: debit.externalUserId,
    amountUsdc: debit.amountUsdc,
    marketId: debit.marketId,
    side: debit.side,
    createdAt: new Date().toISOString(),
  };
  await write(data);
  return { ok: true, balanceUsdc: Math.round((balance - debit.amountUsdc) * 1e6) / 1e6 };
}

export async function listDeposits(externalUserId: string): Promise<DepositRecord[]> {
  const data = await read();
  return Object.values(data.deposits)
    .filter((d) => d.externalUserId === externalUserId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
