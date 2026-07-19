import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "better_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "better-dev-secret");
}

export interface SessionPayload {
  /** DB user id */
  sub: string;
  /** Wallet public key (base58) */
  pk: string;
  username: string;
}

export async function issueSessionJwt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ pk: payload.pk, username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.pk !== "string") return null;
    return {
      sub: payload.sub,
      pk: payload.pk,
      username: typeof payload.username === "string" ? payload.username : "",
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
