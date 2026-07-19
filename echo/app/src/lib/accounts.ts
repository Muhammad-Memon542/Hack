/**
 * Borsh decoders for on-chain better_protocol accounts.
 * Field order mirrors programs/better_protocol/src/state.rs — keep in sync.
 */
import { PublicKey } from "@solana/web3.js";

export const MARKET_STATUS = ["OPEN", "LOCKED", "RESOLVING", "DISPUTED", "SETTLED"] as const;
export type MarketStatusName = (typeof MARKET_STATUS)[number];

export interface MarketAccount {
  creator: PublicKey;
  marketUuid: string;
  mint: PublicKey;
  vault: PublicKey;
  status: MarketStatusName;
  resolutionTs: bigint;
  targetWallet: PublicKey | null;
  feeBps: number;
  poolYes: bigint;
  poolNo: bigint;
  proposedOutcome: number;
  proposer: PublicKey;
  proposalTs: bigint;
  disputeStake: bigint;
  disputer: PublicKey;
  finalOutcome: number;
}

export interface PositionAccount {
  market: PublicKey;
  owner: PublicKey;
  amountYes: bigint;
  amountNo: bigint;
}

class Reader {
  private view: DataView;
  private offset = 8; // skip the 8-byte Anchor account discriminator

  constructor(private data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  u8(): number {
    return this.view.getUint8(this.offset++);
  }
  u16(): number {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }
  u64(): bigint {
    const v = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return v;
  }
  i64(): bigint {
    const v = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return v;
  }
  pubkey(): PublicKey {
    const pk = new PublicKey(this.data.slice(this.offset, this.offset + 32));
    this.offset += 32;
    return pk;
  }
  string(): string {
    const len = this.view.getUint32(this.offset, true);
    this.offset += 4;
    const s = new TextDecoder().decode(this.data.slice(this.offset, this.offset + len));
    this.offset += len;
    return s;
  }
  optionPubkey(): PublicKey | null {
    return this.u8() === 1 ? this.pubkey() : null;
  }
}

export function decodeMarket(data: Uint8Array): MarketAccount {
  const r = new Reader(data);
  return {
    creator: r.pubkey(),
    marketUuid: r.string(),
    mint: r.pubkey(),
    vault: r.pubkey(),
    status: MARKET_STATUS[r.u8()] ?? "OPEN",
    resolutionTs: r.i64(),
    targetWallet: r.optionPubkey(),
    feeBps: r.u16(),
    poolYes: r.u64(),
    poolNo: r.u64(),
    proposedOutcome: r.u8(),
    proposer: r.pubkey(),
    proposalTs: r.i64(),
    disputeStake: r.u64(),
    disputer: r.pubkey(),
    finalOutcome: r.u8(),
  };
}

export interface ConfigAccount {
  admin: PublicKey;
  juryAuthority: PublicKey;
  treasuryToken: PublicKey;
  feeBps: number;
  disputeWindowSecs: bigint;
  minDisputeStake: bigint;
}

export function decodeConfig(data: Uint8Array): ConfigAccount {
  const r = new Reader(data);
  return {
    admin: r.pubkey(),
    juryAuthority: r.pubkey(),
    treasuryToken: r.pubkey(),
    feeBps: r.u16(),
    disputeWindowSecs: r.i64(),
    minDisputeStake: r.u64(),
  };
}

export function decodePosition(data: Uint8Array): PositionAccount {
  const r = new Reader(data);
  return {
    market: r.pubkey(),
    owner: r.pubkey(),
    amountYes: r.u64(),
    amountNo: r.u64(),
  };
}

/** Parimutuel implied probability of YES, in percent (0-100). */
export function impliedYesPercent(m: MarketAccount): number | null {
  const total = m.poolYes + m.poolNo;
  if (total === 0n) return null;
  return Number((m.poolYes * 10_000n) / total) / 100;
}

export function formatUsdc(amount: bigint, decimals = 6): string {
  const denom = 10n ** BigInt(decimals);
  const whole = amount / denom;
  const frac = ((amount % denom) * 100n) / denom;
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}
