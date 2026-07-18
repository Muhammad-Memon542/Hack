import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

/**
 * Auth0 v4 mounts its routes as middleware. When Auth0 isn't configured, the
 * client is null and we pass every request through so the app still runs.
 */
export async function middleware(request: NextRequest) {
  if (!auth0) return NextResponse.next();
  return auth0.middleware(request);
}

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static asset files.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
