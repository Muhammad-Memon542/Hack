"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/app/providers";
import { CURRENT_USER_ID } from "@/lib/mock";

interface DepositAddress {
  address: string;
  chainType: string;
  destinationChainId: string;
  tokenAddress: string;
  recipient: string;
}

/**
 * Unifold-powered "Add funds" flow. The browser never sees the Unifold secret —
 * it calls our /api/deposits routes, which provision a deposit address and
 * reconcile settled deposits into the balance. The payer can send USDC from any
 * supported chain; Unifold bridges it to the treasury and our webhook credits
 * the Echo balance.
 */
export function DepositModal() {
  const { depositOpen, setDepositOpen, balanceUsdc, refreshState } = useApp();

  const [addr, setAddr] = useState<DepositAddress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [simAmount, setSimAmount] = useState("50");
  const [simulating, setSimulating] = useState(false);
  const startBalance = useRef(balanceUsdc);

  // Provision the deposit address when the modal opens.
  useEffect(() => {
    if (!depositOpen) return;
    startBalance.current = balanceUsdc;
    setError(null);
    setAddr(null);
    setLoading(true);
    fetch("/api/deposits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ externalUserId: CURRENT_USER_ID }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? "Could not create deposit address");
        setAddr(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositOpen]);

  // Poll for settled deposits while the modal is open.
  useEffect(() => {
    if (!depositOpen) return;
    const t = setInterval(() => refreshState(), 4000);
    return () => clearInterval(t);
  }, [depositOpen, refreshState]);

  const close = useCallback(() => {
    setDepositOpen(false);
    setCopied(false);
  }, [setDepositOpen]);

  const copy = async () => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const simulate = async () => {
    const amount = Number(simAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSimulating(true);
    setError(null);
    try {
      const r = await fetch("/api/deposits/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ externalUserId: CURRENT_USER_ID, amountUsdc: amount }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Simulation failed");
      await refreshState();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSimulating(false);
    }
  };

  if (!depositOpen) return null;

  const credited = balanceUsdc > startBalance.current;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>Add funds</h2>
            <div className="page-sub">
              Deposit USDC from any chain — powered by Unifold. Balance:{" "}
              <strong>${balanceUsdc.toFixed(2)}</strong>
            </div>
          </div>
          <button className="x-btn" onClick={close} aria-label="close">
            ✕
          </button>
        </div>

        {loading && <div className="hint">Provisioning your deposit address…</div>}
        {error && <div className="hint err">{error}</div>}

        {addr && (
          <>
            <div className="field">
              <label>Your deposit address (Base Sepolia · USDC)</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input readOnly value={addr.address} style={{ fontFamily: "monospace", fontSize: "0.8rem" }} />
                <button className="btn btn-sm" onClick={copy} style={{ whiteSpace: "nowrap" }}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <div className="hint">
                Send test USDC on Base Sepolia to this address. Unifold detects the transfer,
                bridges it to the treasury, and credits your Echo balance automatically. Send from
                any supported chain — Unifold routes it.
              </div>
            </div>

            {credited && (
              <div className="hint ok">✓ Deposit received — balance updated to ${balanceUsdc.toFixed(2)}</div>
            )}

            <div className="field" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <label>Sandbox simulation (no testnet funds needed)</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="number"
                  min="1"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  placeholder="Amount USDC"
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={simulate}
                  disabled={simulating}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {simulating ? "Simulating…" : "Simulate deposit"}
                </button>
              </div>
              <div className="hint">
                Fires a signed Unifold-format webhook through the real verification + crediting
                pipeline — synthetic data only, for the demo.
              </div>
            </div>
          </>
        )}

        <button className="btn btn-block" onClick={close} style={{ marginTop: "0.5rem" }}>
          Done
        </button>
      </div>
    </div>
  );
}
