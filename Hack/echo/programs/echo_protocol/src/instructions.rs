use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::errors::EchoError;
use crate::state::*;

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// Token account that will accrue protocol fees and slashed stakes.
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_uuid: String)]
pub struct InitializeMarket<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, creator.key().as_ref(), market_uuid.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = creator,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = market,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintPosition<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_token.mint == market.mint @ EchoError::InvalidMint,
        constraint = user_token.owner == user.key() @ EchoError::OwnerMismatch
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = vault.key() == market.vault @ EchoError::InvalidVault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = mint.key() == market.mint @ EchoError::InvalidMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct ProposeStateTransition<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub proposer: Signer<'info>,
}

#[derive(Accounts)]
pub struct DisputeTransition<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// Existence of this PDA proves the disputer holds a position in the market.
    #[account(
        seeds = [POSITION_SEED, market.key().as_ref(), disputer.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub disputer: Signer<'info>,
    #[account(
        mut,
        constraint = disputer_token.mint == market.mint @ EchoError::InvalidMint,
        constraint = disputer_token.owner == disputer.key() @ EchoError::OwnerMismatch
    )]
    pub disputer_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = vault.key() == market.vault @ EchoError::InvalidVault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = mint.key() == market.mint @ EchoError::InvalidMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct FinalizeTransition<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(constraint = jury.key() == config.jury_authority @ EchoError::UnauthorizedJury)]
    pub jury: Signer<'info>,
    /// Refund destination if the dispute is upheld.
    #[account(
        mut,
        constraint = disputer_token.mint == market.mint @ EchoError::InvalidMint,
        constraint = disputer_token.owner == market.disputer @ EchoError::OwnerMismatch
    )]
    pub disputer_token: InterfaceAccount<'info, TokenAccount>,
    /// Slash destination if the dispute is rejected.
    #[account(
        mut,
        constraint = treasury_token.key() == config.treasury_token @ EchoError::InvalidTreasury
    )]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = vault.key() == market.vault @ EchoError::InvalidVault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = mint.key() == market.mint @ EchoError::InvalidMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ExecuteYieldRouting<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// Closing the position nullifies its state, preventing double-claims,
    /// and refunds rent to the owner.
    #[account(
        mut,
        close = owner,
        seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = owner,
        constraint = position.market == market.key()
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        constraint = user_token.mint == market.mint @ EchoError::InvalidMint,
        constraint = user_token.owner == owner.key() @ EchoError::OwnerMismatch
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,
    /// Required when the market routes yield and routing_bps > 0.
    #[account(mut)]
    pub target_token: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = treasury_token.key() == config.treasury_token @ EchoError::InvalidTreasury
    )]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = vault.key() == market.vault @ EchoError::InvalidVault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = mint.key() == market.mint @ EchoError::InvalidMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

pub fn initialize_config(
    ctx: Context<InitializeConfig>,
    jury_authority: Pubkey,
    fee_bps: u16,
    dispute_window_secs: i64,
    min_dispute_stake: u64,
) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, EchoError::InvalidFeeBps);
    require!(dispute_window_secs > 0, EchoError::InvalidDisputeWindow);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.jury_authority = jury_authority;
    config.treasury_token = ctx.accounts.treasury_token.key();
    config.fee_bps = fee_bps;
    config.dispute_window_secs = dispute_window_secs;
    config.min_dispute_stake = min_dispute_stake;
    config.bump = ctx.bumps.config;
    Ok(())
}

pub fn initialize_market(
    ctx: Context<InitializeMarket>,
    market_uuid: String,
    resolution_ts: i64,
    target_wallet: Option<Pubkey>,
) -> Result<()> {
    require!(
        market_uuid.len() == MARKET_UUID_LEN && market_uuid.is_ascii(),
        EchoError::InvalidUuid
    );
    let now = Clock::get()?.unix_timestamp;
    require!(resolution_ts > now, EchoError::ResolutionInPast);

    let market = &mut ctx.accounts.market;
    market.creator = ctx.accounts.creator.key();
    market.market_uuid = market_uuid.clone();
    market.mint = ctx.accounts.mint.key();
    market.vault = ctx.accounts.vault.key();
    market.status = MarketStatus::Open;
    market.resolution_ts = resolution_ts;
    market.target_wallet = target_wallet;
    market.fee_bps = ctx.accounts.config.fee_bps;
    market.pool_yes = 0;
    market.pool_no = 0;
    market.proposed_outcome = OUTCOME_NONE;
    market.proposer = Pubkey::default();
    market.proposal_ts = 0;
    market.dispute_stake = 0;
    market.disputer = Pubkey::default();
    market.final_outcome = OUTCOME_NONE;
    market.bump = ctx.bumps.market;

    emit!(MarketInitialized {
        market: market.key(),
        creator: market.creator,
        market_uuid,
        mint: market.mint,
        resolution_ts,
        target_wallet,
    });
    Ok(())
}

pub fn mint_position(ctx: Context<MintPosition>, outcome: u8, amount: u64) -> Result<()> {
    require!(
        outcome == OUTCOME_NO || outcome == OUTCOME_YES,
        EchoError::InvalidOutcome
    );
    require!(amount > 0, EchoError::ZeroAmount);

    let now = Clock::get()?.unix_timestamp;
    require!(
        ctx.accounts.market.status == MarketStatus::Open,
        EchoError::MarketNotOpen
    );
    require!(
        now < ctx.accounts.market.resolution_ts,
        EchoError::TradingClosed
    );

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let position = &mut ctx.accounts.position;
    position.market = ctx.accounts.market.key();
    position.owner = ctx.accounts.user.key();
    position.bump = ctx.bumps.position;

    let market = &mut ctx.accounts.market;
    if outcome == OUTCOME_YES {
        position.amount_yes = position
            .amount_yes
            .checked_add(amount)
            .ok_or(EchoError::NumericalOverflow)?;
        market.pool_yes = market
            .pool_yes
            .checked_add(amount)
            .ok_or(EchoError::NumericalOverflow)?;
    } else {
        position.amount_no = position
            .amount_no
            .checked_add(amount)
            .ok_or(EchoError::NumericalOverflow)?;
        market.pool_no = market
            .pool_no
            .checked_add(amount)
            .ok_or(EchoError::NumericalOverflow)?;
    }

    emit!(PositionMinted {
        market: market.key(),
        user: ctx.accounts.user.key(),
        outcome,
        amount,
        pool_yes: market.pool_yes,
        pool_no: market.pool_no,
    });
    Ok(())
}

/// Permissionless crank: flips an expired Open market to Locked.
pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(market.status == MarketStatus::Open, EchoError::MarketNotOpen);
    let now = Clock::get()?.unix_timestamp;
    require!(now >= market.resolution_ts, EchoError::ResolutionNotReached);

    market.status = MarketStatus::Locked;
    emit!(MarketLocked {
        market: market.key()
    });
    Ok(())
}

pub fn propose_state_transition(ctx: Context<ProposeStateTransition>, outcome: u8) -> Result<()> {
    require!(
        outcome == OUTCOME_NO || outcome == OUTCOME_YES,
        EchoError::InvalidOutcome
    );
    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketStatus::Open || market.status == MarketStatus::Locked,
        EchoError::MarketNotResolvable
    );
    let now = Clock::get()?.unix_timestamp;
    require!(now >= market.resolution_ts, EchoError::ResolutionNotReached);

    market.status = MarketStatus::Resolving;
    market.proposed_outcome = outcome;
    market.proposer = ctx.accounts.proposer.key();
    market.proposal_ts = now;

    emit!(StateProposed {
        market: market.key(),
        proposer: market.proposer,
        outcome,
        proposal_ts: now,
    });
    Ok(())
}

pub fn dispute_transition(ctx: Context<DisputeTransition>) -> Result<()> {
    require!(
        ctx.accounts.market.status == MarketStatus::Resolving,
        EchoError::MarketNotResolving
    );
    let now = Clock::get()?.unix_timestamp;
    require!(
        now < ctx.accounts.market.proposal_ts + ctx.accounts.config.dispute_window_secs,
        EchoError::DisputeWindowExpired
    );
    require!(
        ctx.accounts.position.total() > 0,
        EchoError::NoActivePosition
    );

    let total_pool = ctx
        .accounts
        .market
        .total_pool()
        .ok_or(EchoError::NumericalOverflow)?;
    let stake = std::cmp::max(
        ctx.accounts.config.min_dispute_stake,
        (total_pool as u128 * DISPUTE_STAKE_BPS as u128 / BPS_DENOMINATOR as u128) as u64,
    );

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.disputer_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.disputer.to_account_info(),
            },
        ),
        stake,
        ctx.accounts.mint.decimals,
    )?;

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Disputed;
    market.dispute_stake = stake;
    market.disputer = ctx.accounts.disputer.key();

    emit!(TransitionDisputed {
        market: market.key(),
        disputer: market.disputer,
        stake,
    });
    Ok(())
}

/// Permissionless crank: settles an undisputed proposal after the window elapses.
pub fn finalize_transition(ctx: Context<FinalizeTransition>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketStatus::Resolving,
        EchoError::MarketNotResolving
    );
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= market.proposal_ts + ctx.accounts.config.dispute_window_secs,
        EchoError::DisputeWindowActive
    );

    market.final_outcome = market.proposed_outcome;
    market.status = MarketStatus::Settled;

    emit!(MarketSettled {
        market: market.key(),
        final_outcome: market.final_outcome,
        via_dispute: false,
    });
    Ok(())
}

pub fn resolve_dispute(ctx: Context<ResolveDispute>, outcome: u8) -> Result<()> {
    require!(
        outcome == OUTCOME_NO || outcome == OUTCOME_YES,
        EchoError::InvalidOutcome
    );
    require!(
        ctx.accounts.market.status == MarketStatus::Disputed,
        EchoError::MarketNotDisputed
    );

    let stake = ctx.accounts.market.dispute_stake;
    let dispute_upheld = outcome != ctx.accounts.market.proposed_outcome;

    if stake > 0 {
        let market = &ctx.accounts.market;
        let bump = [market.bump];
        let seeds = market.signer_seeds(&bump);
        let signer_seeds: &[&[&[u8]]] = &[&seeds];

        // Upheld: refund the disputer. Rejected: slash the stake to the treasury.
        let destination = if dispute_upheld {
            ctx.accounts.disputer_token.to_account_info()
        } else {
            ctx.accounts.treasury_token.to_account_info()
        };

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: destination,
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            stake,
            ctx.accounts.mint.decimals,
        )?;
    }

    let market = &mut ctx.accounts.market;
    market.final_outcome = outcome;
    market.status = MarketStatus::Settled;
    market.dispute_stake = 0;

    emit!(MarketSettled {
        market: market.key(),
        final_outcome: outcome,
        via_dispute: true,
    });
    Ok(())
}

/// Settlement claim with Programmable Yield Routing (PYR).
///
/// Payout_user = (S_user / S_winning) * (P_total - f_protocol), computed in
/// u128 with floor division. `routing_bps` of the net payout is routed to the
/// market's target wallet; the remainder goes to the claimant.
pub fn execute_yield_routing(ctx: Context<ExecuteYieldRouting>, routing_bps: u16) -> Result<()> {
    require!(
        ctx.accounts.market.status == MarketStatus::Settled,
        EchoError::MarketNotSettled
    );
    require!(
        routing_bps as u64 <= BPS_DENOMINATOR,
        EchoError::InvalidRoutingBps
    );
    if routing_bps > 0 {
        require!(
            ctx.accounts.market.target_wallet.is_some(),
            EchoError::NoTargetWallet
        );
    }

    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;

    let winning_pool = if market.final_outcome == OUTCOME_YES {
        market.pool_yes
    } else {
        market.pool_no
    };
    let user_winning_stake = if market.final_outcome == OUTCOME_YES {
        position.amount_yes
    } else {
        position.amount_no
    };
    let total_pool = market.total_pool().ok_or(EchoError::NumericalOverflow)? as u128;

    let (gross, fee, routed, user_amount) = if winning_pool == 0 {
        // Degenerate market: nobody backed the winning outcome. Refund each
        // position its own contribution; no fee, no routing.
        let refund = position.total();
        (refund, 0u64, 0u64, refund)
    } else {
        let gross = (user_winning_stake as u128)
            .checked_mul(total_pool)
            .ok_or(EchoError::NumericalOverflow)?
            / winning_pool as u128;
        let fee = gross * market.fee_bps as u128 / BPS_DENOMINATOR as u128;
        let net = gross - fee;
        let routed = if market.target_wallet.is_some() {
            net * routing_bps as u128 / BPS_DENOMINATOR as u128
        } else {
            0
        };
        let user_amount = net - routed;
        (
            u64::try_from(gross).map_err(|_| EchoError::NumericalOverflow)?,
            u64::try_from(fee).map_err(|_| EchoError::NumericalOverflow)?,
            u64::try_from(routed).map_err(|_| EchoError::NumericalOverflow)?,
            u64::try_from(user_amount).map_err(|_| EchoError::NumericalOverflow)?,
        )
    };

    let bump = [market.bump];
    let seeds = market.signer_seeds(&bump);
    let signer_seeds: &[&[&[u8]]] = &[&seeds];
    let decimals = ctx.accounts.mint.decimals;

    if fee > 0 {
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            fee,
            decimals,
        )?;
    }

    if routed > 0 {
        let target_wallet = ctx.accounts.market.target_wallet.unwrap();
        let target_token = ctx
            .accounts
            .target_token
            .as_ref()
            .ok_or(EchoError::MissingTargetTokenAccount)?;
        require!(
            target_token.owner == target_wallet,
            EchoError::InvalidTargetTokenAccount
        );
        require!(
            target_token.mint == ctx.accounts.market.mint,
            EchoError::InvalidMint
        );

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: target_token.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            routed,
            decimals,
        )?;
    }

    if user_amount > 0 {
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            user_amount,
            decimals,
        )?;
    }

    emit!(YieldRouted {
        market: ctx.accounts.market.key(),
        user: ctx.accounts.owner.key(),
        gross_payout: gross,
        protocol_fee: fee,
        routed_amount: routed,
        user_amount,
        routing_bps,
        target_wallet: ctx.accounts.market.target_wallet,
    });
    Ok(())
}
