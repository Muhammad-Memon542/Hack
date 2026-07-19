import { NextRequest, NextResponse } from "next/server";
import { simulateBets, getSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/live?n=3 — advance the live bot-trading simulation by placing `n`
 * random bot bets on open markets. Returns the live bets (with actor identity
 * for the trade tape) and the touched markets' new pools so the client can
 * animate odds shifting in real time. The client polls this on an interval.
 *
 * Also returns settled markets so the client can detect resolution transitions.
 */
export async function GET(req: NextRequest) {
  const n = Math.min(8, Math.max(1, Number(req.nextUrl.searchParams.get("n")) || 3));
  const { events, markets } = await simulateBets(n);

  const snap = await getSnapshot();
  const settled = snap.markets
    .filter((m) => m.status === "SETTLED")
    .map((m) => ({ id: m.id, status: m.status, outcome: m.outcome, resolvedAt: m.resolvedAt }));

  return NextResponse.json({ events, markets, settled });
}
