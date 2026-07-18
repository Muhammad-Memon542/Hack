use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const MARKET_SEED: &[u8] = b"market";
pub const VAULT_SEED: &[u8] = b"vault";
pub const POSITION_SEED: &[u8] = b"position";

pub const BPS_DENOMINATOR: u64 = 10_000;
/// Dispute collateral as bps of the total pool (floor of `Config::min_dispute_stake`).
pub const DISPUTE_STAKE_BPS: u64 = 100;
pub const MAX_FEE_BPS: u16 = 1_000;
pub const MARKET_UUID_LEN: usize = 36;

pub const OUTCOME_NO: u8 = 0;
pub const OUTCOME_YES: u8 = 1;
pub const OUTCOME_NONE: u8 = u8::MAX;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum MarketStatus {
    Open,
    Locked,
    Resolving,
    Disputed,
    Settled,
}

/// Global protocol configuration. Singleton PDA: seeds = ["config"].
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    /// Multi-sig authority (e.g. a Squads vault) that arbitrates disputed markets.
    pub jury_authority: Pubkey,
    /// SPL token account that accrues protocol fees and slashed dispute stakes.
    pub treasury_token: Pubkey,
    pub fee_bps: u16,
    /// Optimistic escalation window (spec: T+86400 seconds on mainnet).
    pub dispute_window_secs: i64,
    pub min_dispute_stake: u64,
    pub bump: u8,
}

/// One binary parimutuel market. PDA: seeds = ["market", creator, market_uuid].
///
/// Field order is load-bearing: the TypeScript decoder in `app/src/lib/accounts.ts`
/// reads this layout positionally. Keep both in sync.
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub creator: Pubkey,
    #[max_len(36)]
    pub market_uuid: String,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub status: MarketStatus,
    /// Unix timestamp after which trading closes and resolution may begin.
    pub resolution_ts: i64,
    /// Optional Programmable Yield Routing target (the market subject's wallet).
    pub target_wallet: Option<Pubkey>,
    /// Snapshot of `Config::fee_bps` at market creation.
    pub fee_bps: u16,
    pub pool_yes: u64,
    pub pool_no: u64,
    pub proposed_outcome: u8,
    pub proposer: Pubkey,
    pub proposal_ts: i64,
    pub dispute_stake: u64,
    pub disputer: Pubkey,
    pub final_outcome: u8,
    pub bump: u8,
}

impl Market {
    pub fn total_pool(&self) -> Option<u64> {
        self.pool_yes.checked_add(self.pool_no)
    }

    pub fn signer_seeds<'a>(&'a self, bump_slice: &'a [u8]) -> [&'a [u8]; 4] {
        [
            MARKET_SEED,
            self.creator.as_ref(),
            self.market_uuid.as_bytes(),
            bump_slice,
        ]
    }
}

/// Per-user, per-market position. PDA: seeds = ["position", market, owner].
/// Closed (rent refunded to owner) when settled via `execute_yield_routing`,
/// which nullifies the state and prevents double-claims.
#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub amount_yes: u64,
    pub amount_no: u64,
    pub bump: u8,
}

impl Position {
    pub fn total(&self) -> u64 {
        self.amount_yes.saturating_add(self.amount_no)
    }
}

// ---- Events consumed by the off-chain ingestion daemon (Helius webhooks) ----

#[event]
pub struct MarketInitialized {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub market_uuid: String,
    pub mint: Pubkey,
    pub resolution_ts: i64,
    pub target_wallet: Option<Pubkey>,
}

#[event]
pub struct PositionMinted {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome: u8,
    pub amount: u64,
    pub pool_yes: u64,
    pub pool_no: u64,
}

#[event]
pub struct MarketLocked {
    pub market: Pubkey,
}

#[event]
pub struct StateProposed {
    pub market: Pubkey,
    pub proposer: Pubkey,
    pub outcome: u8,
    pub proposal_ts: i64,
}

#[event]
pub struct TransitionDisputed {
    pub market: Pubkey,
    pub disputer: Pubkey,
    pub stake: u64,
}

#[event]
pub struct MarketSettled {
    pub market: Pubkey,
    pub final_outcome: u8,
    pub via_dispute: bool,
}

#[event]
pub struct YieldRouted {
    pub market: Pubkey,
    pub user: Pubkey,
    pub gross_payout: u64,
    pub protocol_fee: u64,
    pub routed_amount: u64,
    pub user_amount: u64,
    pub routing_bps: u16,
    pub target_wallet: Option<Pubkey>,
}
