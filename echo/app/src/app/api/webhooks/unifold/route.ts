import { NextRequest, NextResponse } from "next/server";
import { unifold, usdcFromBaseUnits } from "@/lib/unifold";
import { applyExecution } from "@/lib/depositLedger";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/unifold — push-based deposit reconciliation.
 *
 * Unifold signs every webhook (unifold-id / unifold-timestamp /
 * unifold-signature). We verify the signature against the RAW body before
 * trusting anything, reject stale events (replay window), and apply the status
 * idempotently by event id. On `deposit.direct_execution.completed` the deposit
 * is credited to the user's Better balance exactly once.
 *
 * Point a Unifold webhook endpoint at this URL and set UNIFOLD_WEBHOOK_SECRET
 * to the endpoint's signing secret. For local testing without a public tunnel,
 * unifold.webhooks.generateTestHeaders() produces valid signed headers.
 */

// deposit.direct_execution.<x> -> ledger status
const STATUS_BY_EVENT: Record<string, string> = {
  "deposit.direct_execution.completed": "succeeded",
  "deposit.direct_execution.pending": "pending",
  "deposit.direct_execution.delayed": "delayed",
};

export async function POST(req: NextRequest) {
  if (!unifold) {
    return NextResponse.json({ error: "Unifold not configured" }, { status: 503 });
  }
  const secret = process.env.UNIFOLD_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[unifold webhook] UNIFOLD_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const headers = {
    "unifold-id": req.headers.get("unifold-id") ?? "",
    "unifold-timestamp": req.headers.get("unifold-timestamp") ?? "",
    "unifold-signature": req.headers.get("unifold-signature") ?? "",
  };

  let event;
  try {
    event = unifold.webhooks.constructEvent(rawBody, headers, secret);
  } catch (err: unknown) {
    console.error("[unifold webhook] signature verification failed:", (err as Error)?.message);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const status = typeof event.type === "string" ? STATUS_BY_EVENT[event.type] : undefined;
  if (status) {
    const obj = event.data?.object as {
      id: string;
      external_user_id?: string | null;
      user_id?: string | null;
      amount?: string | null;
    };
    const externalUserId = obj.external_user_id ?? obj.user_id ?? "unknown";
    const { creditedNow } = await applyExecution(
      {
        id: obj.id,
        externalUserId,
        amountUsdc: usdcFromBaseUnits(obj.amount),
        status,
      },
      { eventId: event.id }
    );
    console.log(
      `[unifold webhook] ${event.type} ${obj.id} -> ${status}${creditedNow ? " (credited)" : ""}`
    );
  }

  // Always 200 on a verified event so Unifold stops retrying.
  return NextResponse.json({ received: true });
}
