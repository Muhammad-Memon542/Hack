import { NextRequest, NextResponse } from "next/server";
import { unifold } from "@/lib/unifold";

export const dynamic = "force-dynamic";

/**
 * POST /api/deposits/simulate — DEV ONLY. Fires a synthetic, correctly-signed
 * `deposit.direct_execution.completed` webhook through the real
 * /api/webhooks/unifold pipeline (signature verification + idempotent
 * crediting). Lets the demo credit a balance without needing Base Sepolia
 * testnet USDC. Disabled in production; uses synthetic data only.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }
  if (!unifold) {
    return NextResponse.json({ error: "Unifold not configured" }, { status: 503 });
  }
  const secret = process.env.UNIFOLD_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "UNIFOLD_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const externalUserId = String(body?.externalUserId ?? "").trim();
  const amountUsdc = Number(body?.amountUsdc);
  if (!externalUserId || !Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return NextResponse.json(
      { error: "externalUserId and positive amountUsdc are required" },
      { status: 400 }
    );
  }

  const event = {
    id: "evt_sim_" + Date.now(),
    object: "event",
    type: "deposit.direct_execution.completed",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: "exec_sim_" + Date.now(),
        external_user_id: externalUserId,
        user_id: externalUserId,
        status: "succeeded",
        amount: Math.round(amountUsdc * 1_000_000).toString(),
        amount_usd: amountUsdc.toFixed(2),
      },
    },
  };
  const payload = JSON.stringify(event);
  const headers = unifold.webhooks.generateTestHeaders({ payload, secret });

  const res = await fetch(`${req.nextUrl.origin}/api/webhooks/unifold`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: payload,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: data?.error ?? "webhook rejected simulated event" },
      { status: 502 }
    );
  }
  return NextResponse.json({ simulated: true, amountUsdc });
}
