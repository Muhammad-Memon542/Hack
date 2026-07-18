import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: [{ reputationScore: "desc" }, { createdAt: "asc" }],
    take: 50,
    select: {
      id: true,
      username: true,
      publicKey: true,
      reputationScore: true,
      _count: { select: { marketsCreated: true } },
    },
  });
  return NextResponse.json({ users });
}
