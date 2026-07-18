import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import { EchoProtocol } from "../target/types/echo_protocol";

/** Local-validator integration tests: PDA derivations, SPL CPI transfers,
 *  optimistic time-lock boundaries, dispute slashing, and PYR settlement. */
describe("echo_protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.EchoProtocol as Program<EchoProtocol>;
  const connection = provider.connection;

  const admin = Keypair.generate();
  const jury = Keypair.generate();
  const alice = Keypair.generate(); // YES bettor
  const bob = Keypair.generate(); // NO bettor + disputer
  const subject = Keypair.generate(); // PYR target wallet

  const USDC_DECIMALS = 6;
  const FEE_BPS = 100; // 1%
  const DISPUTE_WINDOW_SECS = 6;
  const MIN_DISPUTE_STAKE = 1_000_000; // 1 USDC

  let mint: PublicKey;
  const atas: Record<string, PublicKey> = {};

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const marketPda = (creator: PublicKey, uuid: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("market"), creator.toBuffer(), Buffer.from(uuid)],
      program.programId
    )[0];
  const vaultPda = (market: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), market.toBuffer()],
      program.programId
    )[0];
  const positionPda = (market: PublicKey, owner: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("position"), market.toBuffer(), owner.toBuffer()],
      program.programId
    )[0];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const nowSecs = () => Math.floor(Date.now() / 1000);
  const balance = async (ata: PublicKey) => Number((await getAccount(connection, ata)).amount);

  before(async () => {
    for (const kp of [admin, jury, alice, bob, subject]) {
      const sig = await connection.requestAirdrop(kp.publicKey, 10 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig);
    }
    mint = await createMint(connection, admin, admin.publicKey, null, USDC_DECIMALS);
    for (const [name, kp] of Object.entries({ admin, alice, bob, subject })) {
      const ata = await getOrCreateAssociatedTokenAccount(connection, kp, mint, kp.publicKey);
      atas[name] = ata.address;
      await mintTo(connection, admin, mint, ata.address, admin, 1_000_000_000); // 1000 USDC
    }
  });

  it("initializes the config", async () => {
    await program.methods
      .initializeConfig(
        jury.publicKey,
        FEE_BPS,
        new BN(DISPUTE_WINDOW_SECS),
        new BN(MIN_DISPUTE_STAKE)
      )
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        treasuryToken: atas.admin,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const config = await program.account.config.fetch(configPda);
    assert.equal(config.feeBps, FEE_BPS);
    assert.ok(config.juryAuthority.equals(jury.publicKey));
    assert.ok(config.treasuryToken.equals(atas.admin));
  });

  const initMarket = async (uuid: string, resolutionTs: number, target: PublicKey | null) => {
    const market = marketPda(admin.publicKey, uuid);
    await program.methods
      .initializeMarket(uuid, new BN(resolutionTs), target)
      .accounts({
        config: configPda,
        market,
        vault: vaultPda(market),
        mint,
        creator: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    return market;
  };

  const mintPosition = async (
    market: PublicKey,
    user: Keypair,
    userAta: PublicKey,
    outcome: number,
    amount: number
  ) =>
    program.methods
      .mintPosition(outcome, new BN(amount))
      .accounts({
        market,
        position: positionPda(market, user.publicKey),
        user: user.publicKey,
        userToken: userAta,
        vault: vaultPda(market),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

  it("rejects a market with an invalid uuid", async () => {
    try {
      await initMarket("not-a-uuid", nowSecs() + 60, null);
      assert.fail("expected InvalidUuid");
    } catch (err: any) {
      assert.include(err.toString(), "InvalidUuid");
    }
  });

  it("runs the happy path: trade -> propose -> finalize -> PYR settlement", async () => {
    const uuid = "11111111-2222-3333-4444-555555555555";
    const resolutionTs = nowSecs() + 4;
    const market = await initMarket(uuid, resolutionTs, subject.publicKey);

    const state = await program.account.market.fetch(market);
    assert.equal(state.poolYes.toNumber(), 0);
    assert.equal(state.poolNo.toNumber(), 0);
    assert.deepEqual(state.status, { open: {} });

    // Alice 100 USDC on YES, Bob 50 USDC on NO.
    await mintPosition(market, alice, atas.alice, 1, 100_000_000);
    await mintPosition(market, bob, atas.bob, 0, 50_000_000);

    const funded = await program.account.market.fetch(market);
    assert.equal(funded.poolYes.toNumber(), 100_000_000);
    assert.equal(funded.poolNo.toNumber(), 50_000_000);
    assert.equal(await balance(vaultPda(market)), 150_000_000);

    // Time-lock boundary: trading must close at resolution_ts.
    await sleep(5_000);
    try {
      await mintPosition(market, alice, atas.alice, 1, 1_000_000);
      assert.fail("expected TradingClosed");
    } catch (err: any) {
      assert.include(err.toString(), "TradingClosed");
    }

    await program.methods.lockMarket().accounts({ market }).rpc();
    await program.methods
      .proposeStateTransition(1)
      .accounts({ market, proposer: alice.publicKey })
      .signers([alice])
      .rpc();

    // Finalize must fail while the dispute window is open.
    try {
      await program.methods.finalizeTransition().accounts({ config: configPda, market }).rpc();
      assert.fail("expected DisputeWindowActive");
    } catch (err: any) {
      assert.include(err.toString(), "DisputeWindowActive");
    }

    await sleep((DISPUTE_WINDOW_SECS + 1) * 1000);
    await program.methods.finalizeTransition().accounts({ config: configPda, market }).rpc();
    const settled = await program.account.market.fetch(market);
    assert.deepEqual(settled.status, { settled: {} });
    assert.equal(settled.finalOutcome, 1);

    // PYR settlement: Alice routes 10% of net yield to the subject.
    // gross = 100 * 150/100 = 150; fee = 1% = 1.5; net = 148.5;
    // routed = 14.85; user = 133.65 (all * 1e6).
    const aliceBefore = await balance(atas.alice);
    const subjectBefore = await balance(atas.subject);
    const treasuryBefore = await balance(atas.admin);

    await program.methods
      .executeYieldRouting(1000)
      .accounts({
        config: configPda,
        market,
        position: positionPda(market, alice.publicKey),
        owner: alice.publicKey,
        userToken: atas.alice,
        targetToken: atas.subject,
        treasuryToken: atas.admin,
        vault: vaultPda(market),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([alice])
      .rpc();

    assert.equal((await balance(atas.alice)) - aliceBefore, 133_650_000);
    assert.equal((await balance(atas.subject)) - subjectBefore, 14_850_000);
    assert.equal((await balance(atas.admin)) - treasuryBefore, 1_500_000);

    // Position is nullified (closed) — double-claim must fail.
    try {
      await program.methods
        .executeYieldRouting(0)
        .accounts({
          config: configPda,
          market,
          position: positionPda(market, alice.publicKey),
          owner: alice.publicKey,
          userToken: atas.alice,
          targetToken: null,
          treasuryToken: atas.admin,
          vault: vaultPda(market),
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();
      assert.fail("expected double-claim to fail");
    } catch {
      /* expected: position account no longer exists */
    }

    // Bob backed the losing side: claim pays nothing but closes his position.
    const bobBefore = await balance(atas.bob);
    await program.methods
      .executeYieldRouting(0)
      .accounts({
        config: configPda,
        market,
        position: positionPda(market, bob.publicKey),
        owner: bob.publicKey,
        userToken: atas.bob,
        targetToken: null,
        treasuryToken: atas.admin,
        vault: vaultPda(market),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bob])
      .rpc();
    assert.equal(await balance(atas.bob), bobBefore);
  });

  it("escalates a disputed market to the jury and slashes a wrong disputer", async () => {
    const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const market = await initMarket(uuid, nowSecs() + 3, null);

    await mintPosition(market, alice, atas.alice, 1, 20_000_000);
    await mintPosition(market, bob, atas.bob, 0, 20_000_000);
    await sleep(4_000);

    await program.methods
      .proposeStateTransition(1)
      .accounts({ market, proposer: alice.publicKey })
      .signers([alice])
      .rpc();

    // Bob disputes within the window, staking max(min_stake, 1% of pool).
    const bobBefore = await balance(atas.bob);
    await program.methods
      .disputeTransition()
      .accounts({
        config: configPda,
        market,
        position: positionPda(market, bob.publicKey),
        disputer: bob.publicKey,
        disputerToken: atas.bob,
        vault: vaultPda(market),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bob])
      .rpc();
    const expectedStake = Math.max(MIN_DISPUTE_STAKE, 40_000_000 * 0.01);
    assert.equal(bobBefore - (await balance(atas.bob)), expectedStake);

    const disputed = await program.account.market.fetch(market);
    assert.deepEqual(disputed.status, { disputed: {} });

    // A non-jury signer must not be able to resolve.
    try {
      await program.methods
        .resolveDispute(0)
        .accounts({
          config: configPda,
          market,
          jury: alice.publicKey,
          disputerToken: atas.bob,
          treasuryToken: atas.admin,
          vault: vaultPda(market),
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();
      assert.fail("expected UnauthorizedJury");
    } catch (err: any) {
      assert.include(err.toString(), "UnauthorizedJury");
    }

    // Jury upholds the original proposal -> disputer stake is slashed to treasury.
    const treasuryBefore = await balance(atas.admin);
    await program.methods
      .resolveDispute(1)
      .accounts({
        config: configPda,
        market,
        jury: jury.publicKey,
        disputerToken: atas.bob,
        treasuryToken: atas.admin,
        vault: vaultPda(market),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([jury])
      .rpc();

    assert.equal((await balance(atas.admin)) - treasuryBefore, expectedStake);
    const settled = await program.account.market.fetch(market);
    assert.deepEqual(settled.status, { settled: {} });
    assert.equal(settled.finalOutcome, 1);
  });
});
