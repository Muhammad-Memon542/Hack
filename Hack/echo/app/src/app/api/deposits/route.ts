import { NextRequest, NextResponse } from "next/server";
import {
  unifold,
  DEPOSIT_DESTINATION,
  usdcFromBaseUnits,
  isUnifoldError,
  type DepositAddressView,
} from "@/lib/unifold";
import { applyExecution, getBalance, listDeposits } from "@/lib/depositLedger";

export const dynamic = "force-dynamic";

function serviceUnavailable() {
  return NextResponse.json(
    { error: "Unifold not configured (set UNIFOLD_SECRET_KEY)" },
    { status: 503 }
  );
}

/**
 * POST /api/deposits — create (or return) the deposit address for a user.
 *
 * Deposit addresses are per (user, destination) tuple and reusable: the payer
 * sends any supported token on any supported chain to this address and Unifold
 * bridges it to USDC at our treasury. The amount is captured when funds arrive
 * (as a DirectExecution), so no amount is needed here.
 */
export async function POST(req: NextRequest) {
  if (!unifold) return serviceUnavailable();

  const body = await req.json().catch(() => ({}));
  const externalUserId = String(body?.externalUserId ?? "").trim();
  if (!externalUserId) {
    return NextResponse.json({ error: "externalUserId is required" }, { status: 400 });
  }

  try {
    const res = await unifold.depositAddresses.create({
      external_user_id: externalUserId,
      destination_chain_type: DEPOSIT_DESTINATION.chainType as "ethereum",
      destination_chain_id: DEPOSIT_DESTINATION.chainId,
      destination_token_address: DEPOSIT_DESTINATION.tokenAddress,
      recipient_address: DEPOSIT_DESTINATION.recipient,
    });

    if (isUnifoldError(res)) {
      console.error("[deposits] create address error", res);
      return NextResponse.json({ error: res.message ?? "Unifold error" }, { status: 502 });
    }

    const primary = res.data?.find((a) => a.is_primary) ?? res.data?.[0];
    if (!primary) {
      return NextResponse.json({ error: "no deposit address returned" }, { status: 502 });
    }

    const view: DepositAddressView = {
      address: primary.address,
      chainType: primary.chain_type,
      destinationChainId: DEPOSIT_DESTINATION.chainId,
      tokenAddress: DEPOSIT_DESTINATION.tokenAddress,
      recipient: DEPOSIT_DESTINATION.recipient,
    };
    return NextResponse.json(view);
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    console.error("[deposits] create failed", e);
    return NextResponse.json({ error: e?.message ?? "Unifold request failed" }, { status: 502 });
  }
}

/**
 * GET /api/deposits?userId=... — reconcile the user's deposit executions from
 * Unifold into our ledger, then return the derived balance + history. This is
 * the poll path the deposit modal uses; the webhook is the push path.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }
  if (!unifold) return serviceUnavailable();

  try {
    const res = await unifold.directExecutions.list({
      external_user_id: userId,
      action_type: "deposit",
    });
    if (!isUnifoldError(res)) {
      for (const ex of res.data ?? []) {
        await applyExecution({
          id: ex.id,
          externalUserId: userId,
          amountUsdc: usdcFromBaseUnits(ex.destination_amount_base_unit),
          status: ex.status,
          txHash: ex.transaction_hash ?? null,
        });
      }
    }
  } catch (err) {
    // Reconciliation is best-effort; still return the last-known ledger state.
    console.error("[deposits] reconcile failed", err);
  }

  const [balanceUsdc, deposits] = await Promise.all([getBalance(userId), listDeposits(userId)]);
  return NextResponse.json({ balanceUsdc, deposits });
}
