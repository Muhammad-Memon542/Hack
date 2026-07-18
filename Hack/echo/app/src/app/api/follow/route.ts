import { NextRequest, NextResponse } from "next/server";
import { toggleFollow } from "@/lib/store";

export const dynamic = "force-dynamic";

/** POST /api/follow — follow/unfollow another user (persisted follow graph). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();
  const targetUserId = String(body?.targetUserId ?? "").trim();
  if (!userId || !targetUserId) {
    return NextResponse.json({ error: "userId and targetUserId required" }, { status: 400 });
  }
  const res = await toggleFollow({ userId, targetUserId });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, following: res.following });
}
