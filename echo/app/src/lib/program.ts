/**
 * Minimal Anchor-compatible client for better_protocol.
 *
 * Instruction data = 8-byte discriminator (sha256("global:<ix_name>")[0..8])
 * followed by Borsh-encoded args. Account ordering mirrors the #[derive(Accounts)]
 * struct field order in programs/better_protocol/src/instructions.rs — keep in sync.
 */
import { sha256 } from "@noble/hashes/sha256";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "ELThikt285QiyLBWPNiGbgTTzGvjvQhYjrV33VC8ZyoD"
);
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
export const USDC_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS ?? "6");

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export const OUTCOME_NO = 0;
export const OUTCOME_YES = 1;
export const BPS_DENOMINATOR = 10_000;

// ---------------------------------------------------------------------------
// Encoding helpers (Borsh)
// ---------------------------------------------------------------------------

function discriminator(ixName: string): Uint8Array {
  return sha256(new TextEncoder().encode(`global:${ixName}`)).slice(0, 8);
}

function u16Le(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u64Le(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

function i64Le(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, n, true);
  return b;
}

function borshString(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

function borshOptionPubkey(pk: PublicKey | null): Uint8Array {
  if (!pk) return new Uint8Array([0]);
  const out = new Uint8Array(33);
  out[0] = 1;
  out.set(pk.toBytes(), 1);
  return out;
}

function concat(...parts: Uint8Array[]): Buffer {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------
// PDA derivation (seeds mirror state.rs)
// ---------------------------------------------------------------------------

export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];
}

export function marketPda(creator: PublicKey, marketUuid: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), creator.toBuffer(), Buffer.from(marketUuid)],
    PROGRAM_ID
  )[0];
}

export function vaultPda(market: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM_ID)[0];
}

export function positionPda(market: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), owner.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function associatedTokenAddress(owner: PublicKey, mint: PublicKey = USDC_MINT): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

function meta(pubkey: PublicKey, isWritable: boolean, isSigner = false): AccountMeta {
  return { pubkey, isWritable, isSigner };
}

export function buildInitializeMarketIx(params: {
  creator: PublicKey;
  marketUuid: string;
  resolutionTs: bigint;
  targetWallet: PublicKey | null;
  mint?: PublicKey;
}): { instruction: TransactionInstruction; market: PublicKey } {
  const mint = params.mint ?? USDC_MINT;
  const market = marketPda(params.creator, params.marketUuid);
  const keys: AccountMeta[] = [
    meta(configPda(), false),
    meta(market, true),
    meta(vaultPda(market), true),
    meta(mint, false),
    meta(params.creator, true, true),
    meta(TOKEN_PROGRAM_ID, false),
    meta(SystemProgram.programId, false),
  ];
  const data = concat(
    discriminator("initialize_market"),
    borshString(params.marketUuid),
    i64Le(params.resolutionTs),
    borshOptionPubkey(params.targetWallet)
  );
  return {
    instruction: new TransactionInstruction({ programId: PROGRAM_ID, keys, data }),
    market,
  };
}

export function buildMintPositionIx(params: {
  market: PublicKey;
  user: PublicKey;
  outcome: number;
  amount: bigint;
  mint?: PublicKey;
}): TransactionInstruction {
  const mint = params.mint ?? USDC_MINT;
  const keys: AccountMeta[] = [
    meta(params.market, true),
    meta(positionPda(params.market, params.user), true),
    meta(params.user, true, true),
    meta(associatedTokenAddress(params.user, mint), true),
    meta(vaultPda(params.market), true),
    meta(mint, false),
    meta(TOKEN_PROGRAM_ID, false),
    meta(SystemProgram.programId, false),
  ];
  const data = concat(
    discriminator("mint_position"),
    new Uint8Array([params.outcome]),
    u64Le(params.amount)
  );
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

export function buildProposeStateTransitionIx(params: {
  market: PublicKey;
  proposer: PublicKey;
  outcome: number;
}): TransactionInstruction {
  const keys: AccountMeta[] = [meta(params.market, true), meta(params.proposer, false, true)];
  const data = concat(discriminator("propose_state_transition"), new Uint8Array([params.outcome]));
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

export function buildDisputeTransitionIx(params: {
  market: PublicKey;
  disputer: PublicKey;
  mint?: PublicKey;
}): TransactionInstruction {
  const mint = params.mint ?? USDC_MINT;
  const keys: AccountMeta[] = [
    meta(configPda(), false),
    meta(params.market, true),
    meta(positionPda(params.market, params.disputer), false),
    meta(params.disputer, true, true),
    meta(associatedTokenAddress(params.disputer, mint), true),
    meta(vaultPda(params.market), true),
    meta(mint, false),
    meta(TOKEN_PROGRAM_ID, false),
  ];
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: concat(discriminator("dispute_transition")),
  });
}

export function buildExecuteYieldRoutingIx(params: {
  market: PublicKey;
  owner: PublicKey;
  routingBps: number;
  treasuryToken: PublicKey;
  targetWallet: PublicKey | null;
  mint?: PublicKey;
}): TransactionInstruction {
  const mint = params.mint ?? USDC_MINT;
  // Anchor optional accounts: pass the program id in place of a None account.
  const targetToken = params.targetWallet
    ? associatedTokenAddress(params.targetWallet, mint)
    : PROGRAM_ID;
  const keys: AccountMeta[] = [
    meta(configPda(), false),
    meta(params.market, true),
    meta(positionPda(params.market, params.owner), true),
    meta(params.owner, true, true),
    meta(associatedTokenAddress(params.owner, mint), true),
    meta(targetToken, params.targetWallet !== null),
    meta(params.treasuryToken, true),
    meta(vaultPda(params.market), true),
    meta(mint, false),
    meta(TOKEN_PROGRAM_ID, false),
  ];
  const data = concat(discriminator("execute_yield_routing"), u16Le(params.routingBps));
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}
