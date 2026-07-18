import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { awardReputation, REP } from "@/lib/reputation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const markets = await prisma.market.findMany({
    where: status ? { status: status as never } : undefined,
    include: { creator: { select: { username: true, publicKey: true } } },
    orderBy: { resolutionDate: "asc" },
    take: 100,
  });
  return NextResponse.json({ markets });
}

/**
 * Registers the off-chain row for a market whose PDA was just initialized
 * on-chain by the caller's wallet.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { pdaAddress, metadata, resolutionDate, targetWallet } = body ?? {};
  if (typeof pdaAddress !== "string" || !metadata || typeof resolutionDate !== "string") {
    return NextResponse.json(
      { error: "pdaAddress, metadata, resolutionDate required" },
      { status: 400 }
    );
  }
  const resolution = new Date(resolutionDate);
  if (Number.isNaN(resolution.getTime())) {
    return NextResponse.json({ error: "invalid resolutionDate" }, { status: 400 });
  }

  const market = await prisma.market.create({
    data: {
      pdaAddress,
      creatorId: session.sub,
      metadata,
      resolutionDate: resolution,
      targetWallet: typeof targetWallet === "string" && targetWallet ? targetWallet : null,
    },
  });
  await awardReputation(session.sub, REP.CREATE_MARKET);
  return NextResponse.json({ market }, { status: 201 });
}
