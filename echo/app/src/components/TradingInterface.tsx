"use client";

import { useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decodeConfig,
  decodeMarket,
  decodePosition,
  formatUsdc,
  impliedYesPercent,
} from "@/lib/accounts";
import {
  buildMintPositionIx,
  buildProposeStateTransitionIx,
  buildDisputeTransitionIx,
  configPda,
  positionPda,
  OUTCOME_NO,
  OUTCOME_YES,
  USDC_DECIMALS,
} from "@/lib/program";
import { useEchoStore } from "@/store/useEchoStore";
import { YieldRoutingModal } from "./YieldRoutingModal";

/**
 * Client Component over the RPC layer: reads live Sealevel state for the
 * market PDA and constructs mint_position / resolution transactions.
 */
export function TradingInterface({ pdaAddress }: { pdaAddress: string }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();
  const openPyrModal = useEchoStore((s) => s.openPyrModal);

  const [amount, setAmount] = useState("5");
  const [txError, setTxError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const marketPk = new PublicKey(pdaAddress);

  const marketQuery = useQuery({
    queryKey: ["chain-market", pdaAddress],
    queryFn: async () => {
      const info = await connection.getAccountInfo(marketPk);
      return info ? decodeMarket(info.data) : null;
    },
  });

  const configQuery = useQuery({
    queryKey: ["chain-config"],
    queryFn: async () => {
      const info = await connection.getAccountInfo(configPda());
      return info ? decodeConfig(info.data) : null;
    },
    staleTime: Infinity,
  });

  const positionQuery = useQuery({
    queryKey: ["chain-position", pdaAddress, publicKey?.toBase58() ?? ""],
    queryFn: async () => {
      if (!publicKey) return null;
      const info = await connection.getAccountInfo(positionPda(marketPk, publicKey));
      return info ? decodePosition(info.data) : null;
    },
    enabled: !!publicKey,
  });

  const sendIx = useMutation({
    mutationFn: async (build: () => Parameters<Transaction["add"]>[0]) => {
      if (!publicKey) throw new Error("connect a wallet first");
      setTxError(null);
      const tx = new Transaction().add(build());
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    onSuccess: (signature) => {
      setLastSig(signature);
      queryClient.invalidateQueries({ queryKey: ["chain-market", pdaAddress] });
      queryClient.invalidateQueries({ queryKey: ["chain-position", pdaAddress] });
    },
    onError: (e) => setTxError(e instanceof Error ? e.message : "transaction failed"),
  });

  const market = marketQuery.data;
  const position = positionQuery.data;

  if (marketQuery.isLoading) return <div className="panel dim">Loading on-chain state…</div>;
  if (!market) {
    return (
      <div className="panel dim">
        Market PDA not found on-chain at <code>{pdaAddress}</code>. It may not be deployed on this
        cluster.
      </div>
    );
  }

  const yesPct = impliedYesPercent(market);
  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  const tradingOpen = market.status === "OPEN" && nowSecs < market.resolutionTs;
  const resolvable =
    (market.status === "OPEN" || market.status === "LOCKED") && nowSecs >= market.resolutionTs;
  const disputeDeadline = configQuery.data
    ? market.proposalTs + configQuery.data.disputeWindowSecs
    : null;
  const disputable =
    market.status === "RESOLVING" &&
    disputeDeadline !== null &&
    nowSecs < disputeDeadline &&
    !!position &&
    position.amountYes + position.amountNo > 0n;

  const mint = (outcome: number) => {
    const base = BigInt(Math.round(Number(amount) * 10 ** USDC_DECIMALS));
    if (base <= 0n || Number.isNaN(Number(amount))) {
      setTxError("enter a positive amount");
      return;
    }
    sendIx.mutate(() =>
      buildMintPositionIx({ market: marketPk, user: publicKey!, outcome, amount: base })
    );
  };

  return (
    <div className="panel">
      <div className="spread">
        <h2>Parimutuel pool</h2>
        <span className="dim num">
          {formatUsdc(market.poolYes + market.poolNo)} USDC · fee {market.feeBps / 100}%
        </span>
      </div>

      <div className="pool-viz">
        <div className="pool-side yes">
          <div className="pct">{yesPct !== null ? `${yesPct.toFixed(0)}%` : "—"}</div>
          <div className="sub">
            YES · <span className="num">{formatUsdc(market.poolYes)}</span>
          </div>
        </div>
        <div className="pool-side no">
          <div className="pct">{yesPct !== null ? `${(100 - yesPct).toFixed(0)}%` : "—"}</div>
          <div className="sub">
            NO · <span className="num">{formatUsdc(market.poolNo)}</span>
          </div>
        </div>
      </div>

      <div className="odds-bar" style={{ marginBottom: "1.2rem" }}>
        <div style={{ width: `${yesPct ?? 50}%` }} />
      </div>

      {position && position.amountYes + position.amountNo > 0n && (
        <p className="dim" style={{ marginBottom: "0.8rem" }}>
          Your position: {formatUsdc(position.amountYes)} YES · {formatUsdc(position.amountNo)} NO
        </p>
      )}

      {tradingOpen && (
        <div className="row">
          <input
            style={{ maxWidth: 140 }}
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount in USDC"
          />
          <button className="btn-yes" disabled={sendIx.isPending} onClick={() => mint(OUTCOME_YES)}>
            Buy YES
          </button>
          <button className="btn-no" disabled={sendIx.isPending} onClick={() => mint(OUTCOME_NO)}>
            Buy NO
          </button>
        </div>
      )}

      {resolvable && (
        <div className="row">
          <span className="dim">Propose resolution:</span>
          <button
            disabled={sendIx.isPending || !publicKey}
            onClick={() =>
              sendIx.mutate(() =>
                buildProposeStateTransitionIx({
                  market: marketPk,
                  proposer: publicKey!,
                  outcome: OUTCOME_YES,
                })
              )
            }
          >
            YES won
          </button>
          <button
            disabled={sendIx.isPending || !publicKey}
            onClick={() =>
              sendIx.mutate(() =>
                buildProposeStateTransitionIx({
                  market: marketPk,
                  proposer: publicKey!,
                  outcome: OUTCOME_NO,
                })
              )
            }
          >
            NO won
          </button>
        </div>
      )}

      {market.status === "RESOLVING" && (
        <p className="dim" style={{ marginTop: "0.6rem" }}>
          Proposed outcome: {market.proposedOutcome === 1 ? "YES" : "NO"}.{" "}
          {disputeDeadline !== null &&
            (nowSecs < disputeDeadline
              ? `Dispute window closes ${new Date(Number(disputeDeadline) * 1000).toLocaleString()}.`
              : "Dispute window elapsed — awaiting finalization crank.")}
          {disputable && (
            <button
              style={{ marginLeft: "0.6rem" }}
              disabled={sendIx.isPending}
              onClick={() =>
                sendIx.mutate(() =>
                  buildDisputeTransitionIx({ market: marketPk, disputer: publicKey! })
                )
              }
            >
              Dispute (stakes collateral)
            </button>
          )}
        </p>
      )}

      {market.status === "DISPUTED" && (
        <p className="dim">Under jury review — resolution escalated to the reputation multisig.</p>
      )}

      {market.status === "SETTLED" && (
        <div className="row">
          <span>
            Settled: <strong>{market.finalOutcome === 1 ? "YES" : "NO"}</strong>
          </span>
          {position && (
            <button className="btn-primary" onClick={() => openPyrModal(pdaAddress)}>
              Claim payout
            </button>
          )}
        </div>
      )}

      {txError && <p className="error-text" style={{ marginTop: "0.6rem" }}>{txError}</p>}
      {lastSig && (
        <p className="success-text" style={{ marginTop: "0.6rem" }}>
          Confirmed: <code>{lastSig.slice(0, 20)}…</code>
        </p>
      )}

      <YieldRoutingModal
        market={market}
        marketPda={pdaAddress}
        treasuryToken={configQuery.data?.treasuryToken ?? null}
      />
    </div>
  );
}
