import "server-only";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 client (SDK v4). The constructor validates its config and throws when
 * AUTH0_DOMAIN / CLIENT_ID / CLIENT_SECRET / SECRET are missing, which would
 * crash the middleware and take down the whole app. So we only instantiate it
 * when fully configured and otherwise export `null` — the middleware then
 * passes requests through untouched, and the /login page shows a setup notice.
 * This mirrors how the Mongo and Unifold integrations degrade gracefully.
 *
 * When `auth0` is non-null the SDK auto-mounts these routes (via middleware):
 *   /auth/login  /auth/logout  /auth/callback  /auth/profile  /auth/access-token
 */
export const auth0Enabled = Boolean(
  process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET &&
    process.env.AUTH0_SECRET
);

export const auth0 = auth0Enabled ? new Auth0Client() : null;
