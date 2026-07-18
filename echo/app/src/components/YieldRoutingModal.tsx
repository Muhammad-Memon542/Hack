"use client";

import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import type { MarketAccount } from "@/lib/accounts";
import { buildExecuteYieldRoutingIx, BPS_DENOMINATOR } from "@/lib/program";
import { useEchoStore } from "@/store/useEchoStore";

/**
 * PYR modal (spec Phase 4): captures routing_bps, packages it into the
 * execute_yield_routing instruction buffer, and requests the user signature.
 */
export function YieldRoutingModal({
  market,
  marketPda,
  treasuryToken,
}: {
  market: MarketAccount;
  marketPda: string;
  treasuryToken: PublicKey | null;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();
  const { pyr, setRoutingBps, pyrSigning, pyrConfirmed, pyrFailed, closePyrModal } = useEchoStore();

  if (pyr.phase === "closed" || pyr.marketPda !== marketPda) return null;

  const hasTarget = market.targetWallet !== null;
  const routingPct = pyr.routingBps / 100;

  const claim = async () => {
    if (!publicKey) return pyrFailed("connect a wallet first");
    if (!treasuryToken) return pyrFailed("protocol config not found on this cluster");
    pyrSigning();
    try {
      const ix = buildExecuteYieldRoutingIx({
        market: new PublicKey(marketPda),
        owner: publicKey,
        routingBps: hasTarget ? pyr.routingBps : 0,
        treasuryToken,
        targetWallet: market.targetWallet,
        mint: market.mint,
      });
      const signature = await sendTransaction(new Transaction().add(ix), connection);
      await connection.confirmTransaction(signature, "confirmed");
      pyrConfirmed(signature);
      queryClient.invalidateQueries({ queryKey: ["chain-market", marketPda] });
      queryClient.invalidateQueries({ queryKey: ["chain-position", marketPda] });
    } catch (e) {
      pyrFailed(e instanceof Error ? e.message : "claim failed");
    }
  };

  return (
    <div className="modal-backdrop" onClick={closePyrModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Claim payout</h2>
        <p className="dim">
          Settlement executes atomic CPI transfers from the market vault: protocol fee, routed
          yield, then your share.
        </p>

        {hasTarget ? (
          <>
            <div className="field" style={{ marginTop: "1rem" }}>
              <label htmlFor="routing-bps">
                Route {routingPct.toFixed(1)}% of net yield to the market subject
              </label>
              <input
                id="routing-bps"
                type="range"
                min={0}
                max={BPS_DENOMINATOR}
                step={50}
                value={pyr.routingBps}
                disabled={pyr.phase === "signing"}
                onChange={(e) => setRoutingBps(Number(e.target.value))}
              />
            </div>
            <div className="split-preview">
              <div className="spread">
                <span className="dim">To subject</span>
                <span>{routingPct.toFixed(1)}%</span>
              </div>
              <div className="spread">
                <span className="dim">To you</span>
                <span>{(100 - routingPct).toFixed(1)}%</span>
              </div>
            </div>
          </>
        ) : (
          <p className="dim" style={{ margin: "0.8rem 0" }}>
            This market has no yield-routing target; the full net payout goes to you.
          </p>
        )}

        {pyr.phase === "error" && <p className="error-text">{pyr.errorMessage}</p>}
        {pyr.phase === "confirmed" ? (
          <>
            <p className="success-text">
              Claimed! <code>{pyr.signature?.slice(0, 20)}…</code>
            </p>
            <button className="btn-primary" style={{ marginTop: "0.8rem" }} onClick={closePyrModal}>
              Done
            </button>
          </>
        ) : (
          <div className="row" style={{ marginTop: "0.8rem" }}>
            <button className="btn-primary" disabled={pyr.phase === "signing"} onClick={claim}>
              {pyr.phase === "signing" ? "Awaiting signature…" : "Sign & claim"}
            </button>
            <button disabled={pyr.phase === "signing"} onClick={closePyrModal}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
