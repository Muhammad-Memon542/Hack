import { NextRequest, NextResponse } from "next/server";
import { toggleLike } from "@/lib/store";

export const dynamic = "force-dynamic";

/** POST /api/likes — like/unlike a comment (persisted). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();
  const commentId = String(body?.commentId ?? "").trim();
  if (!userId || !commentId) {
    return NextResponse.json({ error: "userId and commentId required" }, { status: 400 });
  }
  const res = await toggleLike({ userId, commentId });
  return NextResponse.json({ ok: true, likes: res.likes, liked: res.liked });
}
