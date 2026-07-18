import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { issueSessionJwt, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { parseSiwsMessage } from "@/lib/siws";

export const dynamic = "force-dynamic";

/**
 * Step 2 of SIWS: verify the Ed25519 signature over the SIWS message,
 * check the nonce, rotate it, and issue a session JWT cookie.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { publicKey, message, signature } = body ?? {};
  if (
    typeof publicKey !== "string" ||
    typeof message !== "string" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "publicKey, message, signature required" }, { status: 400 });
  }

  const fields = parseSiwsMessage(message);
  if (!fields || fields.address !== publicKey) {
    return NextResponse.json({ error: "malformed SIWS message" }, { status: 400 });
  }

  let verified = false;
  try {
    verified = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(publicKey)
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { publicKey } });
  if (!user || user.nonce !== fields.nonce) {
    return NextResponse.json({ error: "unknown wallet or stale nonce" }, { status: 401 });
  }

  // Rotate the nonce so the signed message cannot be replayed.
  await prisma.user.update({ where: { id: user.id }, data: { nonce: randomUUID() } });

  const token = await issueSessionJwt({ sub: user.id, pk: publicKey, username: user.username });
  const res = NextResponse.json({
    user: { id: user.id, publicKey, username: user.username, reputationScore: user.reputationScore },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
