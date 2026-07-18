import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { decodeMarket } from "@/lib/accounts";
import { awardReputation, REP } from "@/lib/reputation";

export const dynamic = "force-dynamic";

/**
 * Ingestion endpoint for Helius enhanced-transaction webhooks.
 *
 * Deterministic sync strategy: rather than trusting the webhook payload's
 * event parsing, we treat it purely as a change notification — collect every
 * account key our program touched, re-fetch those accounts from RPC, decode
 * the Market state, and mirror status + pool sizes into PostgreSQL.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret && req.headers.get("authorization") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "expected transaction array" }, { status: 400 });
  }

  const touched = new Set<string>();
  for (const tx of payload) {
    const accounts: unknown[] = Array.isArray(tx?.accountData)
      ? tx.accountData.map((a: { account?: string }) => a?.account)
      : [];
    for (const instr of tx?.instructions ?? []) {
      for (const key of instr?.accounts ?? []) accounts.push(key);
    }
    for (const key of accounts) if (typeof key === "string") touched.add(key);
  }
  if (touched.size === 0) return NextResponse.json({ synced: 0 });

  const known = await prisma.market.findMany({
    where: { pdaAddress: { in: [...touched] } },
    select: { id: true, pdaAddress: true, metadata: true, status: true, creatorId: true },
  });
  if (known.length === 0) return NextResponse.json({ synced: 0 });

  const connection = new Connection(
    process.env.RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );

  let synced = 0;
  for (const row of known) {
    try {
      const info = await connection.getAccountInfo(new PublicKey(row.pdaAddress));
      if (!info) continue;
      const market = decodeMarket(info.data);
      const metadata =
        typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {};
      await prisma.market.update({
        where: { id: row.id },
        data: {
          status: market.status,
          metadata: {
            ...metadata,
            pools: { yes: market.poolYes.toString(), no: market.poolNo.toString() },
            finalOutcome: market.finalOutcome,
          },
        },
      });

      // Reward the creator once, on the transition into SETTLED.
      if (market.status === "SETTLED" && row.status !== "SETTLED") {
        await awardReputation(row.creatorId, REP.MARKET_SETTLED);
      }
      synced++;
    } catch (err) {
      console.error(`helius sync failed for ${row.pdaAddress}`, err);
    }
  }

  return NextResponse.json({ synced });
}
