import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store";
import { getBalance, listDeposits } from "@/lib/depositLedger";

export const dynamic = "force-dynamic";

/**
 * GET /api/state?userId=... — full app snapshot from the server store, plus the
 * requesting user's Unifold-funded balance + deposit history. The client
 * hydrates its entire world from this one call.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "u_you";
  const [snap, balanceUsdc, deposits] = await Promise.all([
    getSnapshot(),
    getBalance(userId),
    listDeposits(userId),
  ]);
  return NextResponse.json({ ...snap, balanceUsdc, deposits });
}
