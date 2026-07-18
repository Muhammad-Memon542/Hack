import { NextRequest, NextResponse } from "next/server";
import { createMarket } from "@/lib/store";

export const dynamic = "force-dynamic";

/** POST /api/markets — create a market (persisted server-side). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();
  const question = String(body?.question ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const closesAt = String(body?.closesAt ?? "").trim();
  const subjectWallet = body?.subjectWallet ? String(body.subjectWallet).trim() : null;
  const category = body?.category;

  if (!userId || question.length < 6 || description.length < 6 || !closesAt) {
    return NextResponse.json({ error: "missing or too-short fields" }, { status: 400 });
  }

  const res = await createMarket({
    userId,
    question,
    description,
    closesAt,
    subjectWallet,
    category,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, market: res.market });
}
