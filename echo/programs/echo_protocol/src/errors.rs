use anchor_lang::prelude::*;

#[error_code]
pub enum EchoError {
    #[msg("Market UUID must be a 36-character ASCII string")]
    InvalidUuid,
    #[msg("Resolution timestamp must be in the future")]
    ResolutionInPast,
    #[msg("Fee basis points exceed the protocol maximum")]
    InvalidFeeBps,
    #[msg("Dispute window must be positive")]
    InvalidDisputeWindow,
    #[msg("Outcome must be 0 (NO) or 1 (YES)")]
    InvalidOutcome,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Market is not open for trading")]
    MarketNotOpen,
    #[msg("Trading is closed: resolution timestamp has passed")]
    TradingClosed,
    #[msg("Resolution timestamp has not been reached yet")]
    ResolutionNotReached,
    #[msg("Market is not awaiting resolution")]
    MarketNotResolvable,
    #[msg("Market is not in the Resolving state")]
    MarketNotResolving,
    #[msg("Market is not in the Disputed state")]
    MarketNotDisputed,
    #[msg("Market is not settled")]
    MarketNotSettled,
    #[msg("The optimistic dispute window has expired")]
    DisputeWindowExpired,
    #[msg("The optimistic dispute window is still active")]
    DisputeWindowActive,
    #[msg("Disputer holds no active position in this market")]
    NoActivePosition,
    #[msg("Routing basis points exceed 10000")]
    InvalidRoutingBps,
    #[msg("Market has no yield-routing target wallet")]
    NoTargetWallet,
    #[msg("Target token account is required when routing_bps > 0")]
    MissingTargetTokenAccount,
    #[msg("Target token account does not belong to the market's target wallet")]
    InvalidTargetTokenAccount,
    #[msg("Token account mint does not match the market mint")]
    InvalidMint,
    #[msg("Vault does not match the market vault")]
    InvalidVault,
    #[msg("Treasury token account does not match the config")]
    InvalidTreasury,
    #[msg("Signer is not the configured jury authority")]
    UnauthorizedJury,
    #[msg("Token account owner mismatch")]
    OwnerMismatch,
    #[msg("Numerical overflow")]
    NumericalOverflow,
}
