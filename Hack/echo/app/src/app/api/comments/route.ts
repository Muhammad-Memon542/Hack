import { NextRequest, NextResponse } from "next/server";
import { addComment } from "@/lib/store";

export const dynamic = "force-dynamic";

/** POST /api/comments — add a comment/reply to a market (persisted). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();
  const marketId = String(body?.marketId ?? "").trim();
  const content = String(body?.content ?? "").trim();
  const parentId = body?.parentId ? String(body.parentId).trim() : null;

  if (!userId || !marketId || !content) {
    return NextResponse.json({ error: "userId, marketId and content required" }, { status: 400 });
  }
  const res = await addComment({ userId, marketId, parentId, content });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, comment: res.comment });
}
