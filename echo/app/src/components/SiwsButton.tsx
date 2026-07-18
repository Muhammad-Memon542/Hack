"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { buildSiwsMessage } from "@/lib/siws";
import { useEchoStore } from "@/store/useEchoStore";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

/** Wallet connect + Sign-In With Solana. Issues the JWT session for the DB layer. */
export function SiwsButton() {
  const { publicKey, signMessage, connected } = useWallet();
  const { session, setSession } = useEchoStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setError(null);
    try {
      const address = publicKey.toBase58();
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address }),
      });
      if (!nonceRes.ok) throw new Error("nonce request failed");
      const { nonce } = await nonceRes.json();

      const message = buildSiwsMessage({
        domain: window.location.host,
        address,
        nonce,
        issuedAt: new Date().toISOString(),
      });
      const signature = await signMessage(new TextEncoder().encode(message));

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address, message, signature: bs58.encode(signature) }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error ?? "verification failed");
      const { user } = await verifyRes.json();
      setSession({ username: user.username, publicKey: address });
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage, setSession]);

  return (
    <div className="row">
      {connected && !session && (
        <button onClick={signIn} disabled={busy}>
          {busy ? "Signing…" : "Sign in"}
        </button>
      )}
      {session && <span className="dim">@{session.username}</span>}
      {error && <span className="error-text">{error}</span>}
      <WalletMultiButton />
    </div>
  );
}
