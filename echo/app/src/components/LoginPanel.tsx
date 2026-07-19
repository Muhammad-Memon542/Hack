"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0";
import { useApp } from "@/app/providers";
import { PinIcon } from "./icons";

/**
 * Branded login surface. Auth0 mounts /auth/login, /auth/logout and
 * /auth/callback via middleware — those are full-page navigations (plain <a>),
 * not client-routed Links. When Auth0 isn't configured yet, we still let the
 * user into the demo so the app is usable before credentials are added.
 */
export function LoginPanel({ configured }: { configured: boolean }) {
  const { user, isLoading } = useUser();
  const { connect } = useApp();
  const router = useRouter();

  const enterDemo = () => {
    connect();
    router.push("/");
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <PinIcon size={30} />
          <span>Better</span>
        </div>
        <h1 className="auth-title">Your takes. Your stakes.</h1>
        <p className="auth-sub">
          A better way to bet. 50% of winning profits go to charity, and every transaction
          offsets its carbon footprint. Predict, trade, and make a difference — all on Solana.
        </p>

        {!configured ? (
          <div className="auth-actions">
            <div className="info-box warn" style={{ textAlign: "left" }}>
              <strong>Auth0 isn&apos;t configured yet.</strong>
              <div className="faint" style={{ marginTop: "0.35rem", fontSize: "0.82rem" }}>
                Add <code>AUTH0_DOMAIN</code>, <code>AUTH0_CLIENT_ID</code> and{" "}
                <code>AUTH0_CLIENT_SECRET</code> to <code>.env</code>, set{" "}
                <code>NEXT_PUBLIC_AUTH0_ENABLED=true</code>, and restart. Until then you can
                explore in demo mode.
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={enterDemo}>
              Continue in demo mode
            </button>
          </div>
        ) : isLoading ? (
          <div className="auth-actions">
            <div className="auth-spinner" aria-label="loading" />
          </div>
        ) : user ? (
          <div className="auth-actions">
            <div className="auth-me">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="" className="auth-avatar" />
              ) : (
                <div className="auth-avatar auth-avatar-fallback">
                  {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div className="auth-me-name">{user.name ?? user.email}</div>
                {user.email && user.name && <div className="faint auth-me-mail">{user.email}</div>}
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => router.push("/")}>
              Continue to Better
            </button>
            <a className="btn btn-ghost btn-lg" href="/auth/logout">
              Log out
            </a>
          </div>
        ) : (
          <div className="auth-actions">
            <a className="btn btn-primary btn-lg" href="/auth/login?returnTo=/">
              Log in
            </a>
            <a className="btn btn-ghost btn-lg" href="/auth/login?screen_hint=signup&returnTo=/">
              Create an account
            </a>
            <p className="faint auth-fineprint">
              Secured by Auth0 · we never see your password.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
