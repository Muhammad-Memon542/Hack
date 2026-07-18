"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { buildInitializeMarketIx } from "@/lib/program";
import { useEchoStore } from "@/store/useEchoStore";

export function CreateMarketForm() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const session = useEchoStore((s) => s.session);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionDate, setResolutionDate] = useState("");
  const [targetWallet, setTargetWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!publicKey) return setError("connect a wallet first");
    if (!session) return setError("sign in first (top right) so the market gets a social page");
    if (!title.trim()) return setError("title required");

    const resolution = new Date(resolutionDate);
    if (Number.isNaN(resolution.getTime()) || resolution.getTime() <= Date.now()) {
      return setError("resolution date must be in the future");
    }

    let target: PublicKey | null = null;
    if (targetWallet.trim()) {
      try {
        target = new PublicKey(targetWallet.trim());
      } catch {
        return setError("target wallet is not a valid Solana address");
      }
    }

    setBusy(true);
    try {
      const marketUuid = crypto.randomUUID();
      const { instruction, market } = buildInitializeMarketIx({
        creator: publicKey,
        marketUuid,
        resolutionTs: BigInt(Math.floor(resolution.getTime() / 1000)),
        targetWallet: target,
      });
      const signature = await sendTransaction(new Transaction().add(instruction), connection);
      await connection.confirmTransaction(signature, "confirmed");

      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdaAddress: market.toBase58(),
          metadata: { title: title.trim(), description: description.trim(), marketUuid },
          resolutionDate: resolution.toISOString(),
          targetWallet: target?.toBase58() ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed to register market");
      const { market: row } = await res.json();
      router.push(`/market/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "market creation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="mk-title">Question</label>
        <input
          id="mk-title"
          placeholder="Will Amir land the backflip at Saturday's meetup?"
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="mk-desc">Resolution criteria</label>
        <textarea
          id="mk-desc"
          rows={3}
          placeholder="How will this resolve? Be specific — this is what proposers and disputers argue over."
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="mk-date">Trading closes / resolution time</label>
        <input
          id="mk-date"
          type="datetime-local"
          value={resolutionDate}
          onChange={(e) => setResolutionDate(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="mk-target">Subject wallet — optional, enables yield routing</label>
        <input
          id="mk-target"
          placeholder="Solana address that winners can route a cut of their yield to"
          value={targetWallet}
          onChange={(e) => setTargetWallet(e.target.value)}
        />
      </div>
      {error && <p className="error-text" style={{ marginBottom: "0.6rem" }}>{error}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Create market"}
      </button>
    </form>
  );
}
