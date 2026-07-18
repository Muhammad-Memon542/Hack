# Echo

Socially-gated parimutuel prediction markets on Solana with **Programmable Yield Routing (PYR)** —
winners can route a chosen percentage of their net yield straight to the wallet of the person the
market is about, turning gossip-tier bets into a funding mechanism.

Implements `ECHO-ARCH-SPEC-v1.0.0` with a bipartite state model:

- **Episodic financial state** — an Anchor program (`programs/echo_protocol`) on the Sealevel
  runtime: PDA-mapped markets, isolated parimutuel pools (no LP bootstrap needed), an optimistic
  oracle with staked dispute escalation, and atomic CPI settlement.
- **High-frequency social state** — a Next.js 14 App Router app (`app/`) over PostgreSQL/Prisma:
  SIWS (Sign-In With Solana) auth, market metadata, comments, an off-chain reputation system
  (leaderboard + jury gating), and a Helius webhook ingestor that mirrors on-chain state into the
  database.

## Screens

- **Home** — hero, live protocol stats (markets / open / volume / forecasters), status filter
  tabs, and a responsive market grid with parimutuel odds bars and PYR badges.
- **Market** — live on-chain pool split read straight from RPC, trade / propose / dispute / claim
  controls that follow the market's status, the PYR claim modal, and a Postgres-backed comment
  thread showing each author's reputation.
- **Leaderboard** — forecasters ranked by reputation, which accrues off-chain for durable
  contributions (creating markets: +5, a market you made settling: +12, seeding discussion: +1).
  In the full protocol this score gates the top-quartile jury (spec §3.3).

## Layout

```
programs/echo_protocol/   Anchor program (state.rs / instructions.rs / errors.rs)
tests/echo_protocol.ts    anchor-test integration suite (localnet)
app/                      Next.js 14 + Prisma + wallet-adapter client
```

## On-chain state machine

```
OPEN --lock_market/resolution_ts--> LOCKED --propose_state_transition--> RESOLVING
RESOLVING --dispute_transition (staked, position holders only)--> DISPUTED
RESOLVING --finalize_transition (after dispute window)--> SETTLED
DISPUTED  --resolve_dispute (jury authority; slashes or refunds stake)--> SETTLED
SETTLED   --execute_yield_routing--> payout = (S_user / S_win) * (P_total - fee),
            split fee -> treasury, routing_bps -> target wallet, rest -> claimant;
            position account is closed (double-claim impossible)
```

Degenerate markets (empty winning pool) refund each position its own contribution.
All pool math is u128 checked arithmetic; transfers use `token_interface::transfer_checked`
so the program works with both SPL Token and Token-2022 mints.

## Prerequisites

| Tool | Version | Status on this machine |
|---|---|---|
| Rust | stable ≥1.85 (verified 1.97.1) | ✅ installed via rustup |
| Solana CLI | 1.18.x | ❌ install: `sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.26/install)"` |
| Anchor CLI | 0.29.0 | ❌ install: `cargo install --git https://github.com/coral-xyz/anchor avm && avm install 0.29.0 && avm use 0.29.0` |
| Node | ≥18.17 | ✅ v25 |
| PostgreSQL | 15+ (Supabase) | bring your own `DATABASE_URL` |

> Cargo note: the program's dependency tree resolves against the 2026 crates.io index, which
> includes edition2024 manifests — `rust-toolchain.toml` therefore pins `stable`, not the
> era-correct 1.75. `cargo check` passes; `anchor build` additionally needs the Solana
> platform tools above.

## Program (Anchor)

```bash
cargo check                 # verified passing (host target)
anchor build                # produces target/deploy/echo_protocol.so + IDL
solana-test-validator       # in another terminal
anchor deploy && anchor test
```

Program ID (keypair committed at `target/deploy/echo_protocol-keypair.json`, dev-only):
`ELThikt285QiyLBWPNiGbgTTzGvjvQhYjrV33VC8ZyoD`

After deploying, bootstrap the protocol once with `initialize_config(jury_authority, fee_bps,
dispute_window_secs, min_dispute_stake)` — the treasury token account passed there collects
protocol fees and slashed dispute stakes. Mainnet parameters per spec: `dispute_window_secs =
86400`, USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.

## App

```bash
cd app
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, RPC urls
npm install
npx prisma migrate dev      # provision the social-state schema
npm run dev
```

`npm run build` is verified passing. Without a reachable database the UI renders a setup notice;
chain state (pools, odds, positions) is read client-side straight from RPC, so the trading
surface works as soon as the program is deployed to the cluster in `NEXT_PUBLIC_RPC_URL`.

`npm run seed` (`node prisma/seed.mjs`) loads five demo forecasters and five markets across every
status so the home grid, filters, stats, and leaderboard are populated for local development.

> Dev-server note: don't run `npm run build` while `npm run dev` is live — the production build
> overwrites `.next` and the running dev server then 404s its own chunks. Stop dev first, or
> `rm -rf .next` and restart.

### Sync daemon

Point a Helius enhanced-transaction webhook (auth header = `HELIUS_WEBHOOK_SECRET`) at
`POST /api/webhooks/helius`. The handler treats payloads as change notifications only: it
re-fetches every touched market PDA from RPC, decodes it, and mirrors `status` + pool sizes
into PostgreSQL — deterministic sync without trusting webhook contents.

### Client-side program bindings

The app does not depend on `@coral-xyz/anchor`; `app/src/lib/program.ts` builds instructions
manually (sha256 discriminators + Borsh) and `app/src/lib/accounts.ts` decodes accounts. Account
ordering and layouts mirror the Rust structs — **if you reorder fields in `state.rs` or contexts
in `instructions.rs`, update those two files.**

## Verification status

- ✅ `cargo check` — program compiles (rustc 1.97.1, anchor-lang 0.29.0)
- ✅ `npm run build` — app compiles, strict TypeScript, all 9 routes
- ✅ UI smoke-tested in a browser (renders without DB; graceful setup notice)
- ⬜ `anchor test` — requires Solana + Anchor CLIs (not installed here); suite written in
  `tests/echo_protocol.ts` covering PDA derivation, CPI transfers, time-lock boundaries,
  dispute slashing, PYR payout math, and double-claim prevention
- ⬜ Reputation-weighted jury selection is off-chain per spec §3.3; on-chain it is a single
  `jury_authority` signer — point it at a Squads multisig

## Known limitations / next steps

- Rounding dust from floor division accrues in market vaults by design; a `sweep_dust`
  admin instruction would let the treasury reclaim it after all positions close.
- The webhook ingestor covers Market accounts; PositionMinted events could also feed a
  leaderboard/reputation pipeline (spec leaves reputation scoring off-chain).
- SIWS messages pin domain + nonce but not a chain id; add one if you deploy multi-cluster.
