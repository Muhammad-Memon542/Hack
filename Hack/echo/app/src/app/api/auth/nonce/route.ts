import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Step 1 of SIWS: upsert the user row for a wallet and hand back the
 * single-use nonce the wallet must include in its signed message.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const publicKey: unknown = body?.publicKey;
  if (typeof publicKey !== "string" || publicKey.length < 32 || publicKey.length > 44) {
    return NextResponse.json({ error: "invalid publicKey" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { publicKey },
    update: {},
    create: {
      publicKey,
      username: `user_${publicKey.slice(0, 8)}`,
    },
  });

  return NextResponse.json({ nonce: user.nonce, username: user.username });
}
