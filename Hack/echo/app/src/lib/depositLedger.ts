import "server-only";
import { mongoEnabled } from "@/lib/mongo";
import * as fileLedger from "@/lib/depositLedger.file";
import * as mongoLedger from "@/lib/depositLedger.mongo";

/**
 * Deposit-ledger dispatcher. Uses MongoDB when MONGODB_URI is set, otherwise the
 * file-backed ledger. Both expose an identical API so the deposit/bet/webhook
 * routes stay backend-agnostic.
 */

const backend = mongoEnabled ? mongoLedger : fileLedger;

export type { DepositRecord, DebitRecord } from "@/lib/depositLedger.file";

export const applyExecution = backend.applyExecution;
export const creditAdjustment = backend.creditAdjustment;
export const getBalance = backend.getBalance;
export const recordDebit = backend.recordDebit;
export const listDeposits = backend.listDeposits;
