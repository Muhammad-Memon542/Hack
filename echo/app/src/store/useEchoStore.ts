import { create } from "zustand";

/**
 * Ephemeral client state (Zustand). Server/chain state lives in TanStack Query.
 *
 * The PYR modal is modeled as an explicit state machine, per spec Phase 4:
 * closed -> configuring -> signing -> confirmed | error
 */
export type PyrPhase = "closed" | "configuring" | "signing" | "confirmed" | "error";

interface PyrState {
  phase: PyrPhase;
  /** Market PDA (base58) the modal is claiming against. */
  marketPda: string | null;
  routingBps: number;
  signature: string | null;
  errorMessage: string | null;
}

interface EchoStore {
  session: { username: string; publicKey: string } | null;
  setSession: (s: EchoStore["session"]) => void;

  pyr: PyrState;
  openPyrModal: (marketPda: string) => void;
  setRoutingBps: (bps: number) => void;
  pyrSigning: () => void;
  pyrConfirmed: (signature: string) => void;
  pyrFailed: (message: string) => void;
  closePyrModal: () => void;
}

const PYR_IDLE: PyrState = {
  phase: "closed",
  marketPda: null,
  routingBps: 1000, // default: route 10% of net yield to the subject
  signature: null,
  errorMessage: null,
};

export const useEchoStore = create<EchoStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),

  pyr: PYR_IDLE,
  openPyrModal: (marketPda) =>
    set({ pyr: { ...PYR_IDLE, phase: "configuring", marketPda } }),
  setRoutingBps: (routingBps) =>
    set((s) => ({ pyr: { ...s.pyr, routingBps: Math.max(0, Math.min(10_000, routingBps)) } })),
  pyrSigning: () => set((s) => ({ pyr: { ...s.pyr, phase: "signing", errorMessage: null } })),
  pyrConfirmed: (signature) =>
    set((s) => ({ pyr: { ...s.pyr, phase: "confirmed", signature } })),
  pyrFailed: (errorMessage) =>
    set((s) => ({ pyr: { ...s.pyr, phase: "error", errorMessage } })),
  closePyrModal: () => set({ pyr: PYR_IDLE }),
}));
