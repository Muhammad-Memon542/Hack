import { NextRequest, NextResponse } from "next/server";
import { createMarket, resolveMarket, placeBet } from "@/lib/store";

export const dynamic = "force-dynamic";

interface SeedBet {
  botId: string;
  side: "YES" | "NO";
  amount: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();
  const question = String(body?.question ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const delaySec = Number(body?.delaySec) || 30;
  const outcome = body?.outcome === "NO" ? "NO" as const : "YES" as const;
  const image = body?.image ? String(body.image).trim() : undefined;
  const seedBets: SeedBet[] = Array.isArray(body?.seedBets) ? body.seedBets : [];

  if (!userId || question.length < 6 || description.length < 6) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const closesAt = new Date(Date.now() + delaySec * 1000).toISOString();
  const res = await createMarket({ userId, question, description, closesAt, subjectWallet: null, image });
  if (!res.ok || !res.market) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  const marketId = res.market.id;

  for (const bet of seedBets) {
    await placeBet({
      userId: bet.botId,
      marketId,
      side: bet.side,
      amount: bet.amount,
    });
  }

  setTimeout(async () => {
    try {
      await resolveMarket({ marketId, outcome });
      console.log(`[demo] auto-resolved ${marketId} → ${outcome}`);
    } catch (e) {
      console.error(`[demo] failed to resolve ${marketId}:`, e);
    }
  }, delaySec * 1000);

  return NextResponse.json({ ok: true, market: res.market, resolvesIn: delaySec, outcome });
}
