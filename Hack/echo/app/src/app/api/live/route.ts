import { NextRequest, NextResponse } from "next/server";
import { simulateBets } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/live?n=3 — advance the live bot-trading simulation by placing `n`
 * random bot bets on open markets. Returns the live bets (with actor identity
 * for the trade tape) and the touched markets' new pools so the client can
 * animate odds shifting in real time. The client polls this on an interval.
 */
export async function GET(req: NextRequest) {
  const n = Math.min(8, Math.max(1, Number(req.nextUrl.searchParams.get("n")) || 3));
  const { events, markets } = await simulateBets(n);
  return NextResponse.json({ events, markets });
}
