//! Echo Protocol — socially-gated parimutuel prediction markets on Solana
//! with Programmable Yield Routing (PYR).
//!
//! Bipartite state model: deterministic financial state lives here (Sealevel);
//! high-frequency social state lives off-chain in PostgreSQL, synchronized by
//! an ingestion daemon subscribed to the events emitted by these instructions.

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("ELThikt285QiyLBWPNiGbgTTzGvjvQhYjrV33VC8ZyoD");

#[program]
pub mod echo_protocol {
    use super::*;

    /// One-time protocol bootstrap: fee schedule, jury authority, treasury.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        jury_authority: Pubkey,
        fee_bps: u16,
        dispute_window_secs: i64,
        min_dispute_stake: u64,
    ) -> Result<()> {
        instructions::initialize_config(ctx, jury_authority, fee_bps, dispute_window_secs, min_dispute_stake)
    }

    /// Allocates the market PDA + vault and initializes parimutuel pools to 0.
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_uuid: String,
        resolution_ts: i64,
        target_wallet: Option<Pubkey>,
    ) -> Result<()> {
        instructions::initialize_market(ctx, market_uuid, resolution_ts, target_wallet)
    }

    /// Transfers SPL tokens to the vault and increments the parimutuel pool.
    pub fn mint_position(ctx: Context<MintPosition>, outcome: u8, amount: u64) -> Result<()> {
        instructions::mint_position(ctx, outcome, amount)
    }

    /// Permissionless crank: Open -> Locked once resolution_ts has passed.
    pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
        instructions::lock_market(ctx)
    }

    /// Opens the optimistic resolution window (TimeLock of T + dispute_window).
    pub fn propose_state_transition(
        ctx: Context<ProposeStateTransition>,
        outcome: u8,
    ) -> Result<()> {
        instructions::propose_state_transition(ctx, outcome)
    }

    /// Any wallet with an active position may dispute by staking collateral.
    pub fn dispute_transition(ctx: Context<DisputeTransition>) -> Result<()> {
        instructions::dispute_transition(ctx)
    }

    /// Permissionless crank: settles an undisputed proposal after the window.
    pub fn finalize_transition(ctx: Context<FinalizeTransition>) -> Result<()> {
        instructions::finalize_transition(ctx)
    }

    /// Jury fallback for disputed markets; slashes or refunds the dispute stake.
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, outcome: u8) -> Result<()> {
        instructions::resolve_dispute(ctx, outcome)
    }

    /// Settlement claim: parimutuel payout with routing_bps of net yield
    /// routed to the market's target wallet via atomic CPI transfers.
    pub fn execute_yield_routing(ctx: Context<ExecuteYieldRouting>, routing_bps: u16) -> Result<()> {
        instructions::execute_yield_routing(ctx, routing_bps)
    }
}
