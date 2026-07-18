import "server-only";
import { getDb } from "@/lib/mongo";

/**
 * MongoDB-backed deposit/balance ledger — production counterpart to
 * depositLedger.file.ts. Deposits and debits live in their own collections;
 * balances are derived (sum of credited deposits minus debits). Crediting is
 * made exactly-once with a conditional update so the poll path and the webhook
 * can't double-credit.
 */

export interface DepositRecord {
  id: string;
  externalUserId: string;
  amountUsdc: number;
  status: string;
  credited: boolean;
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

async function collections() {
  const db = await getDb();
  return {
    deposits: db.collection<DepositRecord & { _id: string }>("deposits"),
    debits: db.collection<DebitRecord & { _id: string }>("debits"),
    processed: db.collection<{ _id: string }>("processedEvents"),
  };
}

export async function applyExecution(
  exec: { id: string; externalUserId: string; amountUsdc: number; status: string; txHash?: string | null },
  opts?: { eventId?: string }
): Promise<{ record: DepositRecord; creditedNow: boolean }> {
  const c = await collections();

  if (opts?.eventId) {
    const ins = await c.processed.updateOne(
      { _id: opts.eventId },
      { $setOnInsert: { _id: opts.eventId } },
      { upsert: true }
    );
    const alreadyProcessed = !ins.upsertedCount;
    if (alreadyProcessed) {
      const existing = await c.deposits.findOne({ _id: exec.id });
      if (existing) return { record: strip(existing), creditedNow: false };
    }
  }

  const now = new Date().toISOString();
  // Upsert base fields (never downgrade amount/txHash we already have).
  const prev = await c.deposits.findOne({ _id: exec.id });
  await c.deposits.updateOne(
    { _id: exec.id },
    {
      $set: {
        externalUserId: exec.externalUserId,
        amountUsdc: exec.amountUsdc || prev?.amountUsdc || 0,
        status: exec.status,
        txHash: exec.txHash ?? prev?.txHash ?? null,
        updatedAt: now,
      },
      $setOnInsert: { id: exec.id, credited: false, createdAt: now },
    },
    { upsert: true }
  );

  // Credit exactly once: only flips when currently succeeded and not yet credited.
  let creditedNow = false;
  if (exec.status === "succeeded") {
    const res = await c.deposits.updateOne(
      { _id: exec.id, credited: { $ne: true } },
      { $set: { credited: true, updatedAt: now } }
    );
    creditedNow = res.modifiedCount === 1;
  }

  const record = (await c.deposits.findOne({ _id: exec.id }))!;
  return { record: strip(record), creditedNow };
}

export async function creditAdjustment(externalUserId: string, amountUsdc: number, note: string): Promise<void> {
  const c = await collections();
  const id = "adj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  await c.deposits.insertOne({
    _id: id, id, externalUserId, amountUsdc, status: "succeeded", credited: true, txHash: note, createdAt: now, updatedAt: now,
  });
}

export async function getBalance(externalUserId: string): Promise<number> {
  const c = await collections();
  const [creditedAgg, spentAgg] = await Promise.all([
    c.deposits.aggregate([
      { $match: { externalUserId, credited: true } },
      { $group: { _id: null, sum: { $sum: "$amountUsdc" } } },
    ]).toArray(),
    c.debits.aggregate([
      { $match: { externalUserId } },
      { $group: { _id: null, sum: { $sum: "$amountUsdc" } } },
    ]).toArray(),
  ]);
  const credited = creditedAgg[0]?.sum ?? 0;
  const spent = spentAgg[0]?.sum ?? 0;
  return Math.round((credited - spent) * 1e6) / 1e6;
}

export async function recordDebit(debit: {
  externalUserId: string;
  amountUsdc: number;
  marketId: string;
  side: string;
}): Promise<{ ok: boolean; balanceUsdc: number; error?: string }> {
  const balance = await getBalance(debit.externalUserId);
  if (debit.amountUsdc <= 0) return { ok: false, balanceUsdc: balance, error: "amount must be positive" };
  if (debit.amountUsdc > balance) return { ok: false, balanceUsdc: balance, error: "insufficient balance" };
  const c = await collections();
  const id = "bet_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  await c.debits.insertOne({
    _id: id, id, externalUserId: debit.externalUserId, amountUsdc: debit.amountUsdc,
    marketId: debit.marketId, side: debit.side, createdAt: new Date().toISOString(),
  });
  return { ok: true, balanceUsdc: Math.round((balance - debit.amountUsdc) * 1e6) / 1e6 };
}

export async function listDeposits(externalUserId: string): Promise<DepositRecord[]> {
  const c = await collections();
  const docs = await c.deposits.find({ externalUserId }).sort({ createdAt: -1 }).toArray();
  return docs.map(strip);
}

function strip(doc: DepositRecord & { _id?: string }): DepositRecord {
  const { _id, ...rest } = doc;
  void _id;
  return rest as DepositRecord;
}
