"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/app/providers";
import { subjectByWallet } from "@/lib/mock";
import { StatusBadge, OddsBar } from "./primitives";

// Loose base58 Solana address check (32–44 chars, no 0/O/I/l).
const isValidAddress = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

export function CreateMarketModal() {
  const { createOpen, setCreateOpen, createMarket, me } = useApp();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [criteria, setCriteria] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [subjectWallet, setSubjectWallet] = useState("");
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const subjectMatch = useMemo(
    () => (isValidAddress(subjectWallet) ? subjectByWallet(subjectWallet.trim()) : undefined),
    [subjectWallet]
  );
  const subjectFormatValid = subjectWallet.trim() === "" || isValidAddress(subjectWallet);

  const questionValid = question.trim().length >= 10;
  const criteriaValid = criteria.trim().length >= 10;
  const dateValid = closesAt !== "" && new Date(closesAt).getTime() > Date.now();
  const canSubmit =
    questionValid && criteriaValid && dateValid && subjectFormatValid && !submitting;

  if (!createOpen) return null;

  const close = () => {
    setCreateOpen(false);
    setQuestion("");
    setCriteria("");
    setClosesAt("");
    setSubjectWallet("");
    setSubjectTouched(false);
    setSubmitting(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const wallet = subjectWallet.trim() === "" ? null : subjectWallet.trim();
    const id = await createMarket({
      question: question.trim(),
      description: criteria.trim(),
      closesAt: new Date(closesAt).toISOString(),
      subjectWallet: wallet,
    });
    close();
    if (id) router.push(`/market/${id}`);
  };

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>Create a market</h2>
            <div className="page-sub">Bet on the people around you.</div>
          </div>
          <button className="x-btn" onClick={close} aria-label="close">
            ✕
          </button>
        </div>

        <div className="field">
          <label>Question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will Amir land the backflip at Saturday's meetup?"
          />
          {question.length > 0 && !questionValid && (
            <div className="hint err">Give it at least a few words.</div>
          )}
        </div>

        <div className="field">
          <label>Resolution criteria</label>
          <textarea
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder="How will this resolve? Be specific — this is what proposers and disputers argue over."
          />
        </div>

        <div className="field">
          <label>Trading closes / resolution time</label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
          {closesAt !== "" && !dateValid && (
            <div className="hint err">Pick a time in the future.</div>
          )}
        </div>

        <div className="field">
          <label>Subject wallet (optional)</label>
          <input
            className={subjectTouched && !subjectFormatValid ? "invalid" : ""}
            value={subjectWallet}
            onChange={(e) => setSubjectWallet(e.target.value)}
            onBlur={() => setSubjectTouched(true)}
            placeholder="Solana address that winners can route a cut of their yield to"
          />
          {subjectTouched && subjectWallet.trim() !== "" && !subjectFormatValid && (
            <div className="hint err">That doesn&apos;t look like a valid Solana address.</div>
          )}
          {subjectMatch && subjectMatch.verified && (
            <div className="hint ok">✓ Verified subject: {subjectMatch.name}</div>
          )}
          {subjectFormatValid && subjectWallet.trim() !== "" && !subjectMatch && (
            <div className="hint warn">Unverified — subject can claim later</div>
          )}
          <div className="hint">
            If the person this market is about has a wallet, add it here. Winners can optionally send
            them a portion of their winnings.
          </div>
        </div>

        {/* Live preview */}
        <label>Preview</label>
        <div className="card" style={{ marginTop: "0.35rem", marginBottom: "1rem" }}>
          <div className="card-top">
            <StatusBadge status="OPEN" />
            <div className="card-vol num">
              0.00 <small>USDC</small>
            </div>
          </div>
          <div className="card-q">{question.trim() || "Your question will appear here"}</div>
          <OddsBar yesPct={50} />
          <div className="card-meta">
            <span>@{me.username}</span>
            <span>·</span>
            <span>just now</span>
          </div>
          {subjectWallet.trim() !== "" && subjectFormatValid && (
            <div className={`pyr ${subjectMatch?.verified ? "" : "unverified"}`}>
              Yield routes to {subjectMatch?.verified ? subjectMatch.name : "unverified wallet"}
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-block" disabled={!canSubmit} onClick={submit}>
          {submitting ? "Creating…" : "Create market"}
        </button>
      </div>
    </div>
  );
}
