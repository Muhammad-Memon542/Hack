import "server-only";
import Unifold from "@unifold/node";

/**
 * Server-side Unifold client. The SECRET key never leaves the server — the
 * browser only ever talks to our own /api/deposits routes, which proxy to
 * Unifold. This keeps the credential off the client and lets us reconcile
 * every deposit against our own ledger before crediting an Echo balance.
 */
const secretKey = process.env.UNIFOLD_SECRET_KEY;
if (!secretKey) {
  console.warn("[unifold] UNIFOLD_SECRET_KEY is not set — deposit routes will 503.");
}

export const unifold = secretKey ? new Unifold(secretKey) : null;

/**
 * Where bridged funds land. Echo settles in USDC; the Unifold sandbox only
 * supports EVM testnets, so the demo treasury receives USDC on Base Sepolia
 * (chain id 84532). In live mode this would be Solana USDC
 * (destinationChainType: "solana", the USDC mint as tokenAddress).
 *
 * We use the Deposit Addresses product (explicit chain id + token address),
 * which is what the headless SDK's useDeposit hook drives — the currency/network
 * PaymentIntents product is not enabled on this sandbox project.
 */
export const DEPOSIT_DESTINATION = {
  chainType: process.env.UNIFOLD_DESTINATION_CHAIN_TYPE ?? "ethereum",
  chainId: process.env.UNIFOLD_DESTINATION_CHAIN_ID ?? "84532", // Base Sepolia
  tokenAddress:
    process.env.UNIFOLD_DESTINATION_TOKEN_ADDRESS ??
    "0x036cbd53842c5426634e7929541ec2318f3dcf7e", // Base Sepolia USDC
  recipient:
    process.env.UNIFOLD_TREASURY_ADDRESS ?? "0x000000000000000000000000000000000000dEaD",
} as const;

/** USDC has 6 decimals. */
export function usdcFromBaseUnits(base: string | number | null | undefined): number {
  if (base == null) return 0;
  const n = Number(base) / 1_000_000;
  return Number.isFinite(n) ? n : 0;
}

/** A Unifold API error is resolved (not thrown), so detect it by shape. */
export function isUnifoldError(
  v: unknown
): v is { status_code: number; error_type: string; message: string; details?: unknown } {
  return (
    typeof v === "object" &&
    v !== null &&
    ("error_type" in v || "status_code" in v) &&
    !("data" in v)
  );
}

/** Deposit address returned to the browser. */
export interface DepositAddressView {
  address: string;
  chainType: string;
  destinationChainId: string;
  tokenAddress: string;
  recipient: string;
}
