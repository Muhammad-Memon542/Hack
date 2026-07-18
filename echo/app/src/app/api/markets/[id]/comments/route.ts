import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { awardReputation, REP } from "@/lib/reputation";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const comments = await prisma.comment.findMany({
    where: { marketId: params.id },
    include: { user: { select: { username: true, publicKey: true, reputationScore: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content: unknown = body?.content;
  if (typeof content !== "string" || !content.trim() || content.length > 2000) {
    return NextResponse.json({ error: "content must be 1-2000 chars" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { marketId: params.id, userId: session.sub, content: content.trim() },
    include: { user: { select: { username: true, publicKey: true, reputationScore: true } } },
  });
  await awardReputation(session.sub, REP.COMMENT);
  return NextResponse.json({ comment }, { status: 201 });
}
