import { NextRequest, NextResponse } from "next/server";
import { recordDebit, creditAdjustment } from "@/lib/depositLedger";
import { placeBet } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/bets — stake a bet, funded by the user's Unifold balance.
 *
 * Two-step, order matters for correctness:
 *  1. Debit the balance ledger (rejects 409 if insufficient — never negative).
 *  2. Record the position and update the market's pool/volume/participants.
 * If step 2 somehow fails we refund the debit so money is never lost.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.externalUserId ?? body?.userId ?? "").trim();
  const marketId = String(body?.marketId ?? "").trim();
  const side = String(body?.side ?? "").trim();
  const amountUsdc = Number(body?.amountUsdc ?? body?.amount);

  if (!userId || !marketId || (side !== "YES" && side !== "NO")) {
    return NextResponse.json(
      { error: "userId, marketId and side (YES|NO) are required" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return NextResponse.json({ error: "amountUsdc must be positive" }, { status: 400 });
  }

  const debit = await recordDebit({ externalUserId: userId, amountUsdc, marketId, side });
  if (!debit.ok) {
    return NextResponse.json(
      { error: debit.error ?? "debit failed", balanceUsdc: debit.balanceUsdc },
      { status: debit.error === "insufficient balance" ? 409 : 400 }
    );
  }

  const res = await placeBet({ userId, marketId, side, amount: amountUsdc });
  if (!res.ok) {
    // Bet write failed after the debit (e.g. market closed between calls) —
    // refund so no money is lost, then surface the error.
    await creditAdjustment(userId, amountUsdc, `refund:${marketId}`);
    return NextResponse.json(
      { error: res.error ?? "bet failed", balanceUsdc: debit.balanceUsdc + amountUsdc },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    balanceUsdc: debit.balanceUsdc,
    market: res.market,
    position: res.position,
  });
}
